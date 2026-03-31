import { NextRequest, NextResponse } from "next/server"

type Ctx = { params: Promise<{ id: string }> }

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

export async function POST(_req: NextRequest, { params }: Ctx) {
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

  // Load offboarding request
  const [request] = await query(
    "SELECT * FROM onboarding_requests WHERE id = ? AND type = 'offboarding'",
    [id]
  ) as any[]
  if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  if (!request.employee_email) {
    return NextResponse.json({ error: "Keine E-Mail-Adresse hinterlegt" }, { status: 400 })
  }

  // Load email template from settings
  const settings = await query(
    "SELECT key_name, value FROM settings WHERE key_name IN ('offboarding_email_subject', 'offboarding_email_body', 'company_name')"
  ) as any[]
  const settingsMap: Record<string, string> = {}
  settings.forEach((s: any) => { settingsMap[s.key_name] = s.value })

  const subjectTemplate = settingsMap.offboarding_email_subject || "Offboarding-Bestaetigung - {{name}}"
  const bodyTemplate = settingsMap.offboarding_email_body || `<p>Sehr geehrte/r {{name}},</p>
<p>hiermit bestaetigen wir Ihren Austritt zum {{date}}.</p>
<h3>Zurueckgegebene Geraete:</h3>
{{devices}}
<p>Mit freundlichen Gruessen,<br>{{company}}</p>`
  const companyName = settingsMap.company_name || "IT-Abteilung"

  // Load device returns
  const devices = await query(
    "SELECT * FROM offboarding_device_returns WHERE request_id = ? ORDER BY id ASC",
    [id]
  ) as any[]

  // Build devices HTML table
  let devicesHtml = ""
  if (devices.length > 0) {
    devicesHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
<tr><th>Geraet</th><th>Asset-Tag</th><th>Seriennummer</th><th>Status</th><th>Zustand</th></tr>`
    for (const d of devices) {
      let conditionStr = ""
      if (d.condition_notes) {
        try {
          const cond = typeof d.condition_notes === "string" ? JSON.parse(d.condition_notes) : d.condition_notes
          const parts: string[] = []
          if (cond.housing) parts.push(`Gehaeuse: ${cond.housing}`)
          if (cond.display) parts.push(`Display: ${cond.display}`)
          if (cond.keyboard) parts.push(`Tastatur: ${cond.keyboard}`)
          if (cond.charger) parts.push(`Ladegeraet: ${cond.charger}`)
          if (cond.accessories) parts.push(`Zubehoer: ${cond.accessories}`)
          conditionStr = parts.join(", ")
        } catch {
          conditionStr = ""
        }
      }
      const statusLabel: Record<string, string> = {
        pending: "Ausstehend",
        returned: "Zurueckgegeben",
        missing: "Fehlend",
        disposed: "Entsorgt",
      }
      devicesHtml += `<tr><td>${d.device_name || ""}</td><td>${d.asset_tag || "-"}</td><td>${d.serial_number || "-"}</td><td>${statusLabel[d.status] || d.status}</td><td>${conditionStr || "-"}</td></tr>`
    }
    devicesHtml += "</table>"
  } else {
    devicesHtml = "<p>Keine Geraete erfasst.</p>"
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

  // Send email
  try {
    await sendMail(request.employee_email, subject, html)
  } catch (err) {
    console.error("[Offboarding] Email send error:", err)
    return NextResponse.json({ error: "E-Mail konnte nicht gesendet werden" }, { status: 500 })
  }

  // Update confirmation_sent_at
  await pool.execute(
    "UPDATE onboarding_requests SET confirmation_sent_at = NOW() WHERE id = ?",
    [id]
  )

  return NextResponse.json({ success: true })
}
