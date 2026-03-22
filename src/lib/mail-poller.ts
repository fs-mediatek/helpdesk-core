// Background mail poller — started from instrumentation.ts
// Polls the configured Microsoft 365 mailbox for new mails and creates tickets

let pollerInterval: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 60_000 // 60 seconds

export function startMailPoller() {
  if (pollerInterval) return // already running

  // Initial delay to let the app fully start
  setTimeout(async () => {
    await pollOnce()

    pollerInterval = setInterval(async () => {
      await pollOnce()
    }, POLL_INTERVAL)
  }, 10_000) // wait 10s after startup

  console.log("[Mail Poller] Gestartet (Intervall: 60s)")
}

async function pollOnce() {
  try {
    const { getMicrosoftSettings, fetchUnreadMails, markMailAsRead } = await import("@/lib/microsoft")
    const { query, queryOne } = await import("@/lib/db")

    const settings = await getMicrosoftSettings()
    if (settings.ms_mail_enabled !== "true" || !settings.ms_mailbox) return

    if (!settings.ms_client_id || !settings.ms_tenant_id || !settings.ms_client_secret) return

    const mails = await fetchUnreadMails(settings.ms_mailbox, 10)
    if (mails.length === 0) return

    const { isMailBlacklisted } = await import("@/lib/zammad")
    const TICKET_REGEX = /\[([A-Z]+-\d{4}-\d+)\]/

    for (const mail of mails) {
      const senderEmail = mail.from?.emailAddress?.address?.toLowerCase() || ""
      const senderName = mail.from?.emailAddress?.name || senderEmail.split("@")[0]
      const subject = mail.subject || "(Kein Betreff)"

      // Check blacklist
      if (await isMailBlacklisted(subject, senderEmail)) {
        await markMailAsRead(settings.ms_mailbox, mail.id)
        console.log(`[Mail Poller] Blacklisted: ${subject}`)
        continue
      }
      const body = mail.body?.content || mail.bodyPreview || ""

      const ticketMatch = subject.match(TICKET_REGEX)

      if (ticketMatch) {
        const ticketNumber = ticketMatch[1]
        const ticket = await queryOne<any>("SELECT id FROM tickets WHERE ticket_number = ?", [ticketNumber])
        if (ticket) {
          await query(
            "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?, ?, ?, 0, 0)",
            [ticket.id, null, `<p><strong>E-Mail von ${senderName} (${senderEmail}):</strong></p>${body}`]
          )
          await markMailAsRead(settings.ms_mailbox, mail.id)
          console.log(`[Mail Poller] Kommentar zu ${ticketNumber} hinzugefügt`)
          continue
        }
      }

      // Find or create user
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

      await markMailAsRead(settings.ms_mailbox, mail.id)
      console.log(`[Mail Poller] Ticket ${ticketNumber} erstellt aus Mail: ${subject}`)
    }
  } catch (err: any) {
    // Don't crash the poller on errors — just log and continue
    if (!err.message?.includes("nicht konfiguriert")) {
      console.error("[Mail Poller] Fehler:", err.message)
    }
  }
}
