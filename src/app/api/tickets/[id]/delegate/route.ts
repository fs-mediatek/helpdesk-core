import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [ticket] = await query("SELECT requester_id, delegate_id, delegate_id as did FROM tickets WHERE id = ?", [id]) as any[]
  if (!ticket) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  if (!ticket.delegate_id) return NextResponse.json({ error: "Kein Stellvertreter vorhanden" }, { status: 400 })

  const canRemove =
    session.role.includes("admin") ||
    ticket.requester_id === session.userId ||
    ticket.delegate_id === session.userId

  if (!canRemove) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 })

  await query("UPDATE tickets SET delegate_id = NULL WHERE id = ?", [id])

  // Audit comment
  await pool.execute(
    "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,1,1)",
    [id, session.userId, "Stellvertretung wurde entfernt (Datenschutz)"]
  ).catch(() => {})

  return NextResponse.json({ success: true })
}
