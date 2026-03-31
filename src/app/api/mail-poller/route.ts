import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { getMicrosoftSettings, fetchUnreadMails, markMailAsRead } from "@/lib/microsoft"
import { getImapSettings, fetchUnreadImapMails, markImapMailAsRead } from "@/lib/imap"
import { isMailBlacklisted } from "@/lib/zammad"

// Ticket number pattern in subject: e.g. "Re: [TIC-2026-0042] Drucker defekt"
const TICKET_REGEX = /\[([A-Z]+-\d{4}-\d+)\]/

async function processMailToTicket(senderEmail: string, senderName: string, subject: string, body: string, markAsRead: () => Promise<void>) {
  const results: { action: string; subject: string; ticketId?: number; ticketNumber?: string }[] = []

  // Check blacklist
  if (await isMailBlacklisted(subject, senderEmail)) {
    await markAsRead()
    results.push({ action: "filtered", subject })
    return results
  }

  // Check if this is a reply to an existing ticket
  const ticketMatch = subject.match(TICKET_REGEX)

  if (ticketMatch) {
    const ticketNumber = ticketMatch[1]
    const ticket = await queryOne<any>("SELECT id FROM tickets WHERE ticket_number = ?", [ticketNumber])

    if (ticket) {
      await query(
        "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?, ?, ?, 0, 0)",
        [ticket.id, null, `<p><strong>E-Mail von ${senderName} (${senderEmail}):</strong></p>${body}`]
      )
      await markAsRead()
      results.push({ action: "comment", subject, ticketId: ticket.id, ticketNumber })
      return results
    }
  }

  // Find or create user by email
  let user = await queryOne<any>("SELECT id FROM users WHERE email = ?", [senderEmail])
  let requesterId: number

  if (user) {
    requesterId = user.id
  } else {
    const bcrypt = await import("bcryptjs")
    const hash = await bcrypt.hash(crypto.randomUUID(), 10)
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'user', 1)",
      [senderName, senderEmail, hash]
    ) as any
    requesterId = result.insertId
  }

  // Generate ticket number
  const year = new Date().getFullYear()
  await query(
    "INSERT INTO ticket_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = last_number + 1",
    [year]
  )
  const [counter] = await query("SELECT last_number FROM ticket_counters WHERE year = ?", [year]) as any[]
  const { generateTicketNumber } = await import("@/lib/numbering")
  const ticketNumber = await generateTicketNumber(year, counter.last_number)

  const ticketResult = await query(
    "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, status) VALUES (?, ?, ?, 'medium', 'E-Mail', ?, 'open')",
    [ticketNumber, subject, body, requesterId]
  ) as any

  try {
    const { applySlaToTicket } = await import("@/lib/sla")
    await applySlaToTicket(ticketResult.insertId, { category: "E-Mail", department: null, priority: "medium" })
  } catch {}

  await markAsRead()
  results.push({ action: "ticket", subject, ticketId: ticketResult.insertId, ticketNumber })
  return results
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  const { authorization } = Object.fromEntries(req.headers)

  const cronKey = process.env.MAIL_POLL_KEY || "helpdesk-mail-poll"
  const isAuthorized = session?.role.includes("admin") || authorization === `Bearer ${cronKey}`

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const source = url.searchParams.get("source") || "auto"
  const allResults: { action: string; subject: string; ticketId?: number; ticketNumber?: string; source?: string }[] = []

  // ── Microsoft 365 ──
  if (source === "auto" || source === "ms365") {
    try {
      const msSettings = await getMicrosoftSettings()
      if (msSettings.ms_mail_enabled === "true" && msSettings.ms_mailbox && msSettings.ms_client_id) {
        const mails = await fetchUnreadMails(msSettings.ms_mailbox)
        for (const mail of mails) {
          const senderEmail = mail.from?.emailAddress?.address?.toLowerCase() || ""
          const senderName = mail.from?.emailAddress?.name || senderEmail.split("@")[0]
          const subject = mail.subject || "(Kein Betreff)"
          const body = mail.body?.content || mail.bodyPreview || ""
          const results = await processMailToTicket(senderEmail, senderName, subject, body, () => markMailAsRead(msSettings.ms_mailbox, mail.id))
          allResults.push(...results.map(r => ({ ...r, source: "ms365" })))
        }
      }
    } catch (err: any) {
      if (!err.message?.includes("nicht konfiguriert")) {
        console.error("[Mail Poller MS365]", err.message)
      }
    }
  }

  // ── IMAP ──
  if (source === "auto" || source === "imap") {
    try {
      const imapSettings = await getImapSettings()
      if (imapSettings.imap_enabled === "true" && imapSettings.imap_host) {
        const mails = await fetchUnreadImapMails(10)
        for (const mail of mails) {
          const senderEmail = mail.from.address?.toLowerCase() || ""
          const senderName = mail.from.name || senderEmail.split("@")[0]
          const subject = mail.subject || "(Kein Betreff)"
          const body = mail.html || mail.text || ""
          const results = await processMailToTicket(senderEmail, senderName, subject, body, () => markImapMailAsRead(mail.id))
          allResults.push(...results.map(r => ({ ...r, source: "imap" })))
        }
      }
    } catch (err: any) {
      if (source === "imap") {
        return NextResponse.json({ error: "IMAP-Fehler: " + err.message }, { status: 500 })
      }
      if (!err.message?.includes("nicht konfiguriert")) {
        console.error("[Mail Poller IMAP]", err.message)
      }
    }
  }

  if (source !== "auto" && allResults.length === 0) {
    // Check if the requested source is even enabled
    if (source === "imap") {
      const imapSettings = await getImapSettings()
      if (imapSettings.imap_enabled !== "true") {
        return NextResponse.json({ error: "IMAP-Abruf ist nicht aktiviert", enabled: false }, { status: 400 })
      }
    }
    if (source === "ms365") {
      const msSettings = await getMicrosoftSettings()
      if (msSettings.ms_mail_enabled !== "true") {
        return NextResponse.json({ error: "Microsoft 365 Mail-Abruf ist nicht aktiviert", enabled: false }, { status: 400 })
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed: allResults.length,
    results: allResults,
  })
}

// GET endpoint to check poller status
export async function GET() {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const msSettings = await getMicrosoftSettings()
  const imapSettings = await getImapSettings()

  return NextResponse.json({
    ms365: {
      enabled: msSettings.ms_mail_enabled === "true",
      mailbox: msSettings.ms_mailbox || null,
      configured: !!msSettings.ms_client_id && !!msSettings.ms_tenant_id,
    },
    imap: {
      enabled: imapSettings.imap_enabled === "true",
      host: imapSettings.imap_host || null,
      user: imapSettings.imap_user || null,
      configured: !!imapSettings.imap_host && !!imapSettings.imap_user,
    },
  })
}
