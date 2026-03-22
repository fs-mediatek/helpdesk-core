import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { getMicrosoftSettings, fetchUnreadMails, markMailAsRead } from "@/lib/microsoft"
import { isMailBlacklisted } from "@/lib/zammad"

// Ticket number pattern in subject: e.g. "Re: [TIC-2026-0042] Drucker defekt"
const TICKET_REGEX = /\[([A-Z]+-\d{4}-\d+)\]/

export async function POST(req: NextRequest) {
  // Can be called by admin manually or by cron
  const session = await getSession()
  const { authorization } = Object.fromEntries(req.headers)
  const settings = await getMicrosoftSettings()

  // Auth: either admin session or internal cron key
  const cronKey = process.env.MAIL_POLL_KEY || "helpdesk-mail-poll"
  const isAuthorized = session?.role.includes("admin") || authorization === `Bearer ${cronKey}`

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (settings.ms_mail_enabled !== "true" || !settings.ms_mailbox) {
    return NextResponse.json({ error: "Mail-Abruf ist nicht aktiviert", enabled: false }, { status: 400 })
  }

  try {
    const mails = await fetchUnreadMails(settings.ms_mailbox)
    const results: { action: string; subject: string; ticketId?: number; ticketNumber?: string }[] = []

    for (const mail of mails) {
      const senderEmail = mail.from?.emailAddress?.address?.toLowerCase() || ""
      const senderName = mail.from?.emailAddress?.name || senderEmail.split("@")[0]
      const subject = mail.subject || "(Kein Betreff)"
      const body = mail.body?.content || mail.bodyPreview || ""

      // Check blacklist
      if (await isMailBlacklisted(subject, senderEmail)) {
        await markMailAsRead(settings.ms_mailbox, mail.id)
        results.push({ action: "filtered", subject })
        continue
      }

      // Check if this is a reply to an existing ticket
      const ticketMatch = subject.match(TICKET_REGEX)

      if (ticketMatch) {
        // ── Reply to existing ticket → add comment ──
        const ticketNumber = ticketMatch[1]
        const ticket = await queryOne<any>("SELECT id FROM tickets WHERE ticket_number = ?", [ticketNumber])

        if (ticket) {
          await query(
            "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?, ?, ?, 0, 0)",
            [ticket.id, null, `<p><strong>E-Mail von ${senderName} (${senderEmail}):</strong></p>${body}`]
          )
          await markMailAsRead(settings.ms_mailbox, mail.id)
          results.push({ action: "comment", subject, ticketId: ticket.id, ticketNumber })
          continue
        }
      }

      // ── New mail → create ticket ──

      // Find or create user by email
      let user = await queryOne<any>("SELECT id FROM users WHERE email = ?", [senderEmail])
      let requesterId: number

      if (user) {
        requesterId = user.id
      } else {
        // Create external requester
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

      // Create ticket
      const ticketResult = await query(
        "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, status) VALUES (?, ?, ?, 'medium', 'E-Mail', ?, 'open')",
        [ticketNumber, subject, body, requesterId]
      ) as any

      // Apply SLA
      try {
        const { applySlaToTicket } = await import("@/lib/sla")
        await applySlaToTicket(ticketResult.insertId, { category: "E-Mail", department: null, priority: "medium" })
      } catch {}

      await markMailAsRead(settings.ms_mailbox, mail.id)
      results.push({ action: "ticket", subject, ticketId: ticketResult.insertId, ticketNumber })
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      total_unread: mails.length,
      results,
    })
  } catch (err: any) {
    console.error("[Mail Poller Error]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET endpoint to check poller status
export async function GET() {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await getMicrosoftSettings()
  return NextResponse.json({
    enabled: settings.ms_mail_enabled === "true",
    mailbox: settings.ms_mailbox || null,
    configured: !!settings.ms_client_id && !!settings.ms_tenant_id,
  })
}
