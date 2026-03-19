import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

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
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
