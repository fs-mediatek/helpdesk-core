import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { body, is_internal = false, send_email = false } = await req.json()
  if (!body) return NextResponse.json({ error: "Kommentar erforderlich" }, { status: 400 })

  const result = await query(
    "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?)",
    [id, session.userId, body, is_internal ? 1 : 0]
  ) as any

  // Send email to requester if requested
  let emailSentTo: string | null = null
  if (send_email && !is_internal) {
    try {
      const ticket = await queryOne<any>(
        `SELECT t.ticket_number, t.title, u.email as requester_email, u.name as requester_name
         FROM tickets t LEFT JOIN users u ON t.requester_id = u.id WHERE t.id = ?`, [id]
      ) as any
      if (ticket?.requester_email) {
        const { sendMail } = await import("@/lib/mailer")
        const htmlBody = body.includes("<") ? body : body.replace(/\n/g, "<br>")
        const subject = `Re: [${ticket.ticket_number}] ${ticket.title}`
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;">
            <p>Hallo ${ticket.requester_name || ""},</p>
            <p>zu Ihrem Ticket <strong>${ticket.ticket_number}</strong> gibt es eine neue Antwort:</p>
            <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;">${htmlBody}</div>
            <p style="color:#6b7280;font-size:13px;">Sie können auf diese E-Mail antworten, um dem Ticket einen Kommentar hinzuzufügen.</p>
            <p>Mit freundlichen Grüßen<br/>IT HelpDesk</p>
          </div>`
        await sendMail(ticket.requester_email, subject, html)
        emailSentTo = ticket.requester_email

        // Add system comment noting the email was sent
        await query(
          "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?, ?, ?, 1, 1)",
          [id, session.userId, `📧 Antwort als E-Mail versendet an ${ticket.requester_email}`]
        )
      }
    } catch (err: any) {
      console.error("[Email Send]", err.message)
    }
  }

  // Sync to Zammad if it's a ZAM- ticket
  try {
    const ticket = await queryOne<any>("SELECT ticket_number FROM tickets WHERE id = ?", [id])
    if (ticket?.ticket_number?.startsWith("ZAM-")) {
      const { syncCommentToZammad } = await import("@/lib/zammad")
      await syncCommentToZammad(ticket.ticket_number, body, !!is_internal, session.name || "HelpDesk")
    }
  } catch (err: any) {
    console.error("[Comment Sync]", err.message)
  }

  return NextResponse.json({ id: result.insertId, email_sent_to: emailSentTo }, { status: 201 })
}
