import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"
import nodemailer from "nodemailer"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { to, subject, body } = await req.json()
  if (!to || !subject || !body) return NextResponse.json({ error: "Empfänger, Betreff und Nachricht erforderlich" }, { status: 400 })

  // Load SMTP settings
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'smtp_%'") as any[]
  const s: Record<string, string> = {}
  rows.forEach((r: any) => { s[r.key_name] = r.value })

  if (!s.smtp_host) return NextResponse.json({ error: "SMTP nicht konfiguriert (Einstellungen → E-Mail)" }, { status: 400 })

  const transporter = nodemailer.createTransport({
    host: s.smtp_host, port: parseInt(s.smtp_port || "587"),
    secure: s.smtp_port === "465",
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
  })

  const [ticket] = await query("SELECT ticket_number, title FROM tickets WHERE id = ?", [id]) as any[]
  const fromName = s.smtp_from_name || "IT Helpdesk"
  const fromAddr = s.smtp_from_address || s.smtp_user || ""

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, "<br>"),
  })

  // Save as internal comment
  await pool.execute(
    "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES (?,?,?,1)",
    [id, session.userId, `📧 Weitergeleitet an: ${to}\n\nBetreff: ${subject}\n\n${body}`]
  )

  return NextResponse.json({ success: true })
}
