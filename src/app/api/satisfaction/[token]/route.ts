import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token || token.length < 10) {
      return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 })
    }

    const tickets = await query(
      `SELECT t.ticket_number, t.title, t.satisfaction_rating, u.name as requester_name
       FROM tickets t
       LEFT JOIN users u ON t.requester_id = u.id
       WHERE t.satisfaction_token = ?`,
      [token]
    ) as any[]

    if (!tickets.length) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
    }

    const ticket = tickets[0]
    return NextResponse.json({
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      requester_name: ticket.requester_name,
      already_rated: ticket.satisfaction_rating != null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: "Fehler" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { rating, comment } = await req.json()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen" }, { status: 400 })
    }

    const { processSurveyResponse } = await import("@/lib/satisfaction-survey")
    const success = await processSurveyResponse(token, rating, comment || "")

    if (!success) {
      return NextResponse.json({ error: "Ticket nicht gefunden oder bereits bewertet" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Fehler" }, { status: 500 })
  }
}
