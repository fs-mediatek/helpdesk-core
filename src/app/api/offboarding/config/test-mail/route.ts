import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { sendMail } = await import("@/lib/mailer")

  const session = await getSession()
  if (!session?.role?.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { to, email_subject, email_body } = await req.json()
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse erforderlich" }, { status: 400 })
  }

  const subject = (email_subject || "Offboarding Bestätigung — Test")
    .replace(/\{\{name\}\}/g, "Max Mustermann")
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("de-DE"))
    .replace(/\{\{company\}\}/g, "Musterfirma")

  const devicesTable = `<table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <thead><tr style="background:#f3f4f6;">
      <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Gerät</th>
      <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Asset-Tag</th>
      <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;">Zustand</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;">Laptop HP EliteBook</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">AST-001</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">Einwandfrei</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;">iPhone 14</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">AST-002</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">Leichte Gebrauchsspuren</td></tr>
    </tbody>
  </table>`

  const body = (email_body || "<p>Hallo {{name}},</p><p>hiermit bestätigen wir die Rückgabe folgender Geräte:</p>{{devices}}")
    .replace(/\{\{name\}\}/g, "Max Mustermann")
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("de-DE"))
    .replace(/\{\{company\}\}/g, "Musterfirma")
    .replace(/\{\{devices\}\}/g, devicesTable)

  try {
    await sendMail(to, subject, body)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
