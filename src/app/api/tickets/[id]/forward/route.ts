import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"
import { sendMail } from "@/lib/mailer"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { to, subject, body } = await req.json()
  if (!to || !subject || !body) return NextResponse.json({ error: "Empfänger, Betreff und Nachricht erforderlich" }, { status: 400 })

  try {
    const htmlBody = body.includes("<") ? body : body.replace(/\n/g, "<br>")
    await sendMail(to, subject, htmlBody)
  } catch (err: any) {
    return NextResponse.json({ error: "E-Mail-Versand fehlgeschlagen: " + err.message }, { status: 500 })
  }

  // Save as internal comment
  await pool.execute(
    "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES (?,?,?,1)",
    [id, session.userId, `📧 Weitergeleitet an: ${to}\n\nBetreff: ${subject}\n\n${body}`]
  )

  return NextResponse.json({ success: true })
}
