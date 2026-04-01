import { NextRequest, NextResponse } from "next/server"

type Ctx = { params: Promise<{ id: string }> }

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")
  const { sendMail } = await import("@/lib/mailer")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { private_email, cc_addresses } = body // private_email = BCC, cc_addresses = comma-separated

  if (!private_email || !private_email.includes("@")) {
    return NextResponse.json({ error: "Private E-Mail-Adresse erforderlich" }, { status: 400 })
  }

  // Load offboarding request
  const [request] = await query(
    "SELECT r.*, u.email as creator_email FROM onboarding_requests r LEFT JOIN users u ON r.created_by_id = u.id WHERE r.id = ? AND r.type = 'offboarding'",
    [id]
  ) as any[]
  if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  // Load email template from settings
  const settings = await query(
    "SELECT key_name, value FROM settings WHERE key_name IN ('offboarding_email_subject', 'offboarding_email_body', 'company_name')"
  ) as any[]
  const settingsMap: Record<string, string> = {}
  settings.forEach((s: any) => { settingsMap[s.key_name] = s.value })

  const subjectTemplate = settingsMap.offboarding_email_subject || "Bestätigung Geräte-Rückgabe - {{name}}"
  const bodyTemplate = settingsMap.offboarding_email_body || `<p>Hallo {{name}},</p>
<p>hiermit bestätigen wir die Rückgabe folgender Geräte:</p>
{{devices}}
<p>Letzter Arbeitstag: {{date}}</p>
<p>Mit freundlichen Grüßen<br>{{company}}</p>`
  const companyName = settingsMap.company_name || "IT-Abteilung"

  // Load device returns
  const devices = await query(
    "SELECT * FROM offboarding_device_returns WHERE request_id = ? ORDER BY id ASC",
    [id]
  ) as any[]

  // Build devices HTML table
  let devicesHtml = ""
  if (devices.length > 0) {
    devicesHtml = `<table style="border-collapse:collapse;width:100%;margin:16px 0;">
<thead><tr style="background:#f3f4f6;">
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Gerät</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Asset-Tag</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Seriennummer</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Status</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Zustand</th>
</tr></thead><tbody>`
    for (const d of devices) {
      let conditionStr = ""
      if (d.condition_notes) {
        try {
          const cond = typeof d.condition_notes === "string" ? JSON.parse(d.condition_notes) : d.condition_notes
          const parts: string[] = []
          if (cond.housing) parts.push(`Gehäuse: ${cond.housing}`)
          if (cond.display) parts.push(`Display: ${cond.display}`)
          if (cond.keyboard) parts.push(`Tastatur: ${cond.keyboard}`)
          if (cond.charger) parts.push(`Ladegerät: ${cond.charger}`)
          if (cond.accessories) parts.push(`Zubehör: ${cond.accessories}`)
          conditionStr = parts.join(", ")
        } catch {
          conditionStr = ""
        }
      }
      const statusLabel: Record<string, string> = {
        pending: "Ausstehend", returned: "Zurückgegeben", missing: "Fehlend", disposed: "Entsorgt",
      }
      devicesHtml += `<tr>
<td style="padding:8px 12px;border:1px solid #e5e7eb;">${d.device_name || ""}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;">${d.asset_tag || "-"}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;">${d.serial_number || "-"}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;">${statusLabel[d.status] || d.status}</td>
<td style="padding:8px 12px;border:1px solid #e5e7eb;">${conditionStr || "-"}</td>
</tr>`
    }
    devicesHtml += "</tbody></table>"
  } else {
    devicesHtml = "<p>Keine Geräte erfasst.</p>"
  }

  // Format date
  const lastDay = request.last_working_day
    ? new Date(request.last_working_day).toLocaleDateString("de-DE")
    : "N/A"

  // Replace placeholders
  const subject = subjectTemplate
    .replace(/\{\{name\}\}/g, request.employee_name || "")
    .replace(/\{\{date\}\}/g, lastDay)
    .replace(/\{\{company\}\}/g, companyName)

  const html = bodyTemplate
    .replace(/\{\{name\}\}/g, request.employee_name || "")
    .replace(/\{\{date\}\}/g, lastDay)
    .replace(/\{\{devices\}\}/g, devicesHtml)
    .replace(/\{\{company\}\}/g, companyName)

  // Build CC list: creator always + additional addresses
  const ccList: string[] = []
  if (request.creator_email) ccList.push(request.creator_email)
  if (cc_addresses) {
    const additional = cc_addresses.split(",").map((a: string) => a.trim()).filter((a: string) => a.includes("@"))
    ccList.push(...additional)
  }
  // Deduplicate
  const ccUnique = [...new Set(ccList)]

  // Send email: employee_email as TO, private_email as BCC, creator + others as CC
  const now = new Date()
  try {
    await sendMail(
      request.employee_email, // TO: dienstliche Adresse
      subject,
      html,
      {
        bcc: private_email, // BCC: private Adresse
        cc: ccUnique.length > 0 ? ccUnique.join(", ") : undefined,
      }
    )
  } catch (err: any) {
    console.error("[Offboarding] Email send error:", err)
    return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden: " + err.message }, { status: 500 })
  }

  // Update confirmation_sent_at
  await pool.execute(
    "UPDATE onboarding_requests SET confirmation_sent_at = NOW() WHERE id = ?",
    [id]
  )

  // Create mail log as system comment in linked ticket or as offboarding note
  const mailLog = `📧 Bestätigungs-Mail versendet am ${now.toLocaleDateString("de-DE")} um ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr\n\nAN: ${request.employee_email}\nBCC: ${private_email}\nCC: ${ccUnique.join(", ") || "—"}\n\nBetreff: ${subject}`

  // Store in onboarding_requests notes
  const existingNotes = request.notes || ""
  const updatedNotes = existingNotes ? `${existingNotes}\n\n---\n${mailLog}` : mailLog
  await pool.execute(
    "UPDATE onboarding_requests SET notes = ? WHERE id = ? AND type = 'offboarding'",
    [updatedNotes, id]
  )

  return NextResponse.json({
    success: true,
    sent_to: request.employee_email,
    bcc: private_email,
    cc: ccUnique,
    sent_at: now.toISOString(),
  })
}
