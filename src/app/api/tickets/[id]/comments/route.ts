import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { body, is_internal = false } = await req.json()
  if (!body) return NextResponse.json({ error: "Kommentar erforderlich" }, { status: 400 })

  const result = await query(
    "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES (?, ?, ?, ?)",
    [id, session.userId, body, is_internal ? 1 : 0]
  ) as any

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

  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
