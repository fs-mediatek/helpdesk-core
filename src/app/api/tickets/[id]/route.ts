import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureCols() {
  await pool.execute("ALTER TABLE ticket_comments ADD COLUMN is_system TINYINT(1) DEFAULT 0").catch(() => {})
  await pool.execute("ALTER TABLE tickets ADD COLUMN affected_user_id INT UNSIGNED DEFAULT NULL").catch(() => {})
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
  await ensureCols()
  const [ticket] = await query(`
    SELECT t.*, u.name as requester_name, u.email as requester_email,
           a.name as assignee_name, a.email as assignee_email,
           d.name as delegate_name, d.id as delegate_user_id,
           af.name as affected_user_name
    FROM tickets t
    LEFT JOIN users u ON t.requester_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    LEFT JOIN users d ON t.delegate_id = d.id
    LEFT JOIN users af ON t.affected_user_id = af.id
    WHERE t.id = ?
  `, [id]) as any[]
  if (!ticket) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  const comments = await query(`
    SELECT c.*, u.name as author_name FROM ticket_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ? ORDER BY c.created_at ASC
  `, [id])
  return NextResponse.json({
    ...ticket,
    comments,
    is_delegate: ticket.delegate_id != null && ticket.delegate_id === session.userId,
    can_remove_delegate: ticket.delegate_id != null && (
      session.role.includes("admin") ||
      ticket.requester_id === session.userId ||
      ticket.delegate_id === session.userId
    ),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const isAdmin = session.role.includes("admin") || session.role.includes("agent") || session.role.includes("disposition")

  // Fetch ticket to check delegate access
  const [current] = await query("SELECT status, priority, assignee_id, delegate_id, requester_id FROM tickets WHERE id = ?", [id]) as any[]
  if (!current) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  const isDelegate = current.delegate_id === session.userId
  // Delegates can escalate priority; requester can only read (no edit)
  const allowedFields = isAdmin
    ? ["status", "priority", "assignee_id", "affected_user_id", "title", "description", "category"]
    : isDelegate
      ? ["priority"]  // delegate can escalate
      : []

  const updates = Object.entries(body).filter(([k]) => allowedFields.includes(k))
  if (updates.length === 0) return NextResponse.json({ error: "Keine Felder" }, { status: 400 })

  const sets = updates.map(([k]) => `${k} = ?`).join(", ")
  const vals = updates.map(([, v]) => v)
  if (body.status === "resolved") vals.push(new Date())
  await query(`UPDATE tickets SET ${sets}${body.status === "resolved" ? ", resolved_at = ?" : ""} WHERE id = ?`, [...vals, id])

  // Sync status back to Zammad if it's a ZAM- ticket
  if (body.status && current && body.status !== current.status) {
    try {
      const [ticket] = await query("SELECT ticket_number FROM tickets WHERE id = ?", [id]) as any[]
      if (ticket?.ticket_number?.startsWith("ZAM-")) {
        const { syncStatusToZammad } = await import("@/lib/zammad")
        await syncStatusToZammad(ticket.ticket_number, body.status)
      }
    } catch {}
  }

  // Create system comment for status changes so users get notified
  if (body.status && current && body.status !== current.status) {
    await ensureCols()
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
    await ensureCols()
    const content = `Priorität geändert: ${current.priority} → ${body.priority}`
    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [id, session.userId, content]
    ).catch(() => {})
  }

  // Create system comment for affected user changes
  if (body.affected_user_id !== undefined) {
    await ensureCols()
    let content: string
    if (body.affected_user_id) {
      const [affUser] = await query("SELECT name FROM users WHERE id = ?", [body.affected_user_id]) as any[]
      content = `Betroffener geändert: ${affUser?.name || "Unbekannt"}`
    } else {
      content = "Betroffener entfernt"
    }
    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [id, session.userId, content]
    ).catch(() => {})
  }

  // Create system comment for assignee changes
  if (body.assignee_id !== undefined && current && body.assignee_id !== current.assignee_id) {
    await ensureCols()
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
