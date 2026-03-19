import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureSystemCol() {
  await pool.execute("ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_system TINYINT(1) DEFAULT 0").catch(() => {})
  await pool.execute("ALTER TABLE ticket_comments ADD COLUMN is_system TINYINT(1) DEFAULT 0").catch(() => {})
}

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Gelöst",
  closed: "Geschlossen",
  waiting: "Wartet auf Rückmeldung",
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const [ticket] = await query(`
    SELECT t.*, u.name as requester_name, u.email as requester_email,
           a.name as assignee_name, a.email as assignee_email
    FROM tickets t
    LEFT JOIN users u ON t.requester_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.id = ?
  `, [id]) as any[]
  if (!ticket) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  const comments = await query(`
    SELECT c.*, u.name as author_name FROM ticket_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ? ORDER BY c.created_at ASC
  `, [id])
  return NextResponse.json({ ...ticket, comments })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const allowed = ["status", "priority", "assignee_id", "title", "description", "category"]
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (updates.length === 0) return NextResponse.json({ error: "Keine Felder" }, { status: 400 })

  // Get current ticket state before update
  const [current] = await query("SELECT status, priority, assignee_id FROM tickets WHERE id = ?", [id]) as any[]

  const sets = updates.map(([k]) => `${k} = ?`).join(", ")
  const vals = updates.map(([, v]) => v)
  if (body.status === "resolved") vals.push(new Date())
  await query(`UPDATE tickets SET ${sets}${body.status === "resolved" ? ", resolved_at = ?" : ""} WHERE id = ?`, [...vals, id])

  // Create system comment for status changes so users get notified
  if (body.status && current && body.status !== current.status) {
    await ensureSystemCol()
    const oldLabel = STATUS_LABELS[current.status] || current.status
    const newLabel = STATUS_LABELS[body.status] || body.status
    const content = `Status geändert: ${oldLabel} → ${newLabel}`
    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [id, session.userId, content]
    ).catch(() => {
      // Fallback without is_system if column doesn't exist yet
      pool.execute(
        "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES (?,?,?,0)",
        [id, session.userId, content]
      ).catch(() => {})
    })
  }

  // Create system comment for priority changes
  if (body.priority && current && body.priority !== current.priority) {
    await ensureSystemCol()
    const content = `Priorität geändert: ${current.priority} → ${body.priority}`
    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [id, session.userId, content]
    ).catch(() => {})
  }

  // Create system comment for assignee changes
  if (body.assignee_id !== undefined && current && body.assignee_id !== current.assignee_id) {
    await ensureSystemCol()
    let content: string
    if (body.assignee_id) {
      const [assignee] = await query("SELECT name FROM users WHERE id = ?", [body.assignee_id]) as any[]
      content = `Zugewiesen an ${assignee?.name || "Unbekannt"}`
    } else {
      content = "Zuweisung aufgehoben"
    }
    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [id, session.userId, content]
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
