// Satisfaction survey logic — sends surveys for resolved tickets, processes responses

import crypto from "crypto"

async function ensureColumns() {
  const { pool } = await import("@/lib/db")
  await pool.execute("ALTER TABLE tickets ADD COLUMN satisfaction_rating INT DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE tickets ADD COLUMN satisfaction_comment TEXT DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE tickets ADD COLUMN satisfaction_token VARCHAR(64) DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE tickets ADD COLUMN satisfaction_sent_at TIMESTAMP NULL DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE tickets ADD COLUMN resolved_at TIMESTAMP NULL DEFAULT NULL").catch(() => {})
}

let columnsEnsured = false

export async function sendPendingSurveys(): Promise<void> {
  try {
    const { query } = await import("@/lib/db")
    const { sendMail } = await import("@/lib/mailer")

    if (!columnsEnsured) {
      await ensureColumns()
      columnsEnsured = true
    }

    // Load settings
    const rows = await query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('satisfaction_enabled','satisfaction_delay_days','satisfaction_email_subject','satisfaction_email_body','company_name')"
    ) as any[]

    const settings: Record<string, string> = {}
    rows.forEach((r: any) => { settings[r.key_name] = r.value })

    if (settings.satisfaction_enabled !== "true") return

    const delayDays = parseInt(settings.satisfaction_delay_days || "3") || 3

    // Find resolved tickets that need a survey
    const tickets = await query(
      `SELECT t.id, t.ticket_number, t.title, t.requester_id,
              u.name as requester_name, u.email as requester_email
       FROM tickets t
       LEFT JOIN users u ON t.requester_id = u.id
       WHERE t.status = 'resolved'
         AND t.satisfaction_sent_at IS NULL
         AND t.resolved_at IS NOT NULL
         AND t.resolved_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [delayDays]
    ) as any[]

    const baseUrl = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000"
    const defaultSubject = "Wie zufrieden sind Sie mit der Lösung Ihres Tickets {{ticket_nummer}}?"
    const defaultBody = `<p>Hallo {{name}},</p>
<p>Ihr Ticket <strong>{{ticket_nummer}}</strong> ({{ticket_titel}}) wurde gelöst.</p>
<p>Wir würden uns über Ihre Rückmeldung freuen. Bitte bewerten Sie die Lösung:</p>
<p><a href="{{link}}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:8px;">Jetzt bewerten</a></p>
<p>Vielen Dank!<br>${settings.company_name || "HelpDesk"}</p>`

    const subjectTemplate = settings.satisfaction_email_subject || defaultSubject
    const bodyTemplate = settings.satisfaction_email_body || defaultBody

    for (const ticket of tickets) {
      if (!ticket.requester_email) continue

      try {
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").substring(0, 32)
        const tokenFinal = token.substring(0, 64)
        const link = `${baseUrl}/satisfaction/${tokenFinal}`

        const replacements: Record<string, string> = {
          "{{name}}": ticket.requester_name || "",
          "{{ticket_nummer}}": ticket.ticket_number || "",
          "{{ticket_titel}}": ticket.title || "",
          "{{link}}": link,
        }

        let subject = subjectTemplate
        let body = bodyTemplate
        for (const [placeholder, value] of Object.entries(replacements)) {
          subject = subject.split(placeholder).join(value)
          body = body.split(placeholder).join(value)
        }

        await query(
          "UPDATE tickets SET satisfaction_token = ?, satisfaction_sent_at = NOW() WHERE id = ?",
          [tokenFinal, ticket.id]
        )

        await sendMail(ticket.requester_email, subject, body)
        console.log(`[Satisfaction] Survey gesendet für Ticket ${ticket.ticket_number}`)
      } catch (err: any) {
        console.error(`[Satisfaction] Fehler bei Ticket ${ticket.ticket_number}:`, err.message)
      }
    }
  } catch (err: any) {
    console.error("[Satisfaction] Fehler:", err.message)
  }
}

export async function processSurveyResponse(
  token: string,
  rating: number,
  comment: string
): Promise<boolean> {
  try {
    const { query } = await import("@/lib/db")

    if (!columnsEnsured) {
      await ensureColumns()
      columnsEnsured = true
    }

    const tickets = await query(
      "SELECT id, ticket_number, status FROM tickets WHERE satisfaction_token = ?",
      [token]
    ) as any[]

    if (!tickets.length) return false

    const ticket = tickets[0]

    await query(
      "UPDATE tickets SET satisfaction_rating = ?, satisfaction_comment = ? WHERE id = ?",
      [rating, comment || null, ticket.id]
    )

    // Negative rating → reopen ticket
    if (rating <= 2) {
      await query("UPDATE tickets SET status = 'open' WHERE id = ?", [ticket.id])
      await query(
        "INSERT INTO comments (ticket_id, user_id, content, is_system) VALUES (?, NULL, ?, 1)",
        [ticket.id, "Ticket wurde aufgrund negativer Bewertung wieder geöffnet"]
      )
      console.log(`[Satisfaction] Ticket ${ticket.ticket_number} wegen negativer Bewertung (${rating}) wiedereröffnet`)
    }

    console.log(`[Satisfaction] Bewertung ${rating} für Ticket ${ticket.ticket_number}`)
    return true
  } catch (err: any) {
    console.error("[Satisfaction] Fehler bei Bewertung:", err.message)
    return false
  }
}
