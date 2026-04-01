// SLA escalation checker — runs from sync-poller every 5 minutes

async function ensureColumns() {
  const { pool } = await import("@/lib/db")
  await pool.execute("ALTER TABLE tickets ADD COLUMN sla_warned_at TIMESTAMP NULL DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE tickets ADD COLUMN sla_escalated_at TIMESTAMP NULL DEFAULT NULL").catch(() => {})
}

let columnsEnsured = false

export async function checkSlaEscalations(): Promise<void> {
  try {
    const { query } = await import("@/lib/db")
    const { sendMail } = await import("@/lib/mailer")

    if (!columnsEnsured) {
      await ensureColumns()
      columnsEnsured = true
    }

    // Load settings
    const rows = await query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('sla_escalation_enabled','sla_critical_hours','sla_high_hours','sla_medium_hours','sla_low_hours','sla_escalation_email')"
    ) as any[]

    const settings: Record<string, string> = {}
    rows.forEach((r: any) => { settings[r.key_name] = r.value })

    if (settings.sla_escalation_enabled !== "true") return

    const thresholds: Record<string, number> = {
      critical: parseFloat(settings.sla_critical_hours || "2") || 2,
      high: parseFloat(settings.sla_high_hours || "4") || 4,
      medium: parseFloat(settings.sla_medium_hours || "8") || 8,
      low: parseFloat(settings.sla_low_hours || "24") || 24,
    }

    const escalationEmail = settings.sla_escalation_email || ""

    // Query open tickets without escalation
    const tickets = await query(
      `SELECT t.id, t.ticket_number, t.title, t.priority, t.created_at, t.assignee_id,
              t.sla_warned_at, t.sla_escalated_at,
              a.name as assignee_name, a.email as assignee_email
       FROM tickets t
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE t.status IN ('open','pending','in_progress')
         AND t.sla_escalated_at IS NULL`
    ) as any[]

    const now = Date.now()

    for (const ticket of tickets) {
      const priority = (ticket.priority || "medium").toLowerCase()
      const thresholdHours = thresholds[priority] ?? thresholds.medium
      const createdAt = new Date(ticket.created_at).getTime()
      const elapsedHours = (now - createdAt) / (1000 * 60 * 60)
      const percentage = elapsedHours / thresholdHours

      // 80% warning
      if (percentage >= 0.8 && percentage < 1.0 && !ticket.sla_warned_at) {
        const recipient = ticket.assignee_email || escalationEmail
        if (recipient) {
          try {
            await sendMail(
              recipient,
              `SLA-Warnung: Ticket ${ticket.ticket_number} - ${ticket.title}`,
              `<p>Das Ticket <strong>${ticket.ticket_number}</strong> (${ticket.title}) nähert sich dem SLA-Limit.</p>
               <p>Priorität: ${ticket.priority} | Schwellenwert: ${thresholdHours}h | Vergangen: ${elapsedHours.toFixed(1)}h</p>
               <p>Bitte bearbeiten Sie das Ticket zeitnah.</p>`
            )
          } catch (err: any) {
            console.error("[SLA] Mail-Warnung fehlgeschlagen:", err.message)
          }
        }
        await query("UPDATE tickets SET sla_warned_at = NOW() WHERE id = ?", [ticket.id])
        console.log(`[SLA] Warnung gesendet für Ticket ${ticket.ticket_number}`)
      }

      // 100% escalation
      if (percentage >= 1.0 && !ticket.sla_escalated_at) {
        if (escalationEmail) {
          try {
            await sendMail(
              escalationEmail,
              `SLA-Eskalation: Ticket ${ticket.ticket_number} - ${ticket.title}`,
              `<p>Das Ticket <strong>${ticket.ticket_number}</strong> (${ticket.title}) hat das SLA-Limit überschritten!</p>
               <p>Priorität: ${ticket.priority} | Schwellenwert: ${thresholdHours}h | Vergangen: ${elapsedHours.toFixed(1)}h</p>
               <p>Zugewiesen an: ${ticket.assignee_name || "Niemand"}</p>
               <p>Bitte eskalieren Sie dieses Ticket.</p>`
            )
          } catch (err: any) {
            console.error("[SLA] Eskalations-Mail fehlgeschlagen:", err.message)
          }
        }
        await query("UPDATE tickets SET sla_escalated_at = NOW() WHERE id = ?", [ticket.id])
        console.log(`[SLA] Eskalation für Ticket ${ticket.ticket_number}`)
      }
    }
  } catch (err: any) {
    console.error("[SLA Escalation] Fehler:", err.message)
  }
}
