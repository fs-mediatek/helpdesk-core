import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureDelegateCol() {
  await pool.execute("ALTER TABLE tickets ADD COLUMN delegate_id INT UNSIGNED DEFAULT NULL").catch(() => {})
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureDelegateCol()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  let where = "WHERE 1=1"
  const params: any[] = []
  const isAdmin = session.role.includes("admin") || session.role.includes("agent") || session.role.includes("disposition")
  const isAssistenz = session.role.includes("assistenz")

  if (!isAdmin) {
    if (isAssistenz) {
      // Assistenz sees own tickets AND tickets they delegated
      where += " AND (t.requester_id = ? OR t.delegate_id = ?)"
      params.push(session.userId, session.userId)
    } else {
      where += " AND t.requester_id = ?"
      params.push(session.userId)
    }
  }

  if (status === "active" || !status) { where += " AND t.status NOT IN ('closed', 'resolved')" }
  else if (status && status !== "all") { where += " AND t.status = ?"; params.push(status) }
  if (priority) { where += " AND t.priority = ?"; params.push(priority) }
  if (search) { where += " AND (t.title LIKE ? OR t.ticket_number LIKE ?)"; params.push(`%${search}%`, `%${search}%`) }

  const tickets = await query(`
    SELECT t.*, u.name as requester_name, a.name as assignee_name, d.name as delegate_name
    FROM tickets t
    LEFT JOIN users u ON t.requester_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    LEFT JOIN users d ON t.delegate_id = d.id
    ${where} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `, params)

  const [countResult] = await query(`SELECT COUNT(*) as total FROM tickets t ${where}`, params)

  // Mark delegate tickets for the frontend
  const userId = session.userId
  const ticketsList = (tickets as any[]).map(t => ({
    ...t,
    is_delegate: t.delegate_id != null && t.delegate_id === userId,
  }))

  return NextResponse.json({ tickets: ticketsList, total: (countResult as any).total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureDelegateCol()

  const { title, description, priority = "medium", category = "Sonstiges", on_behalf_of } = await req.json()
  if (!title || !description) return NextResponse.json({ error: "Titel und Beschreibung erforderlich" }, { status: 400 })

  const isAssistenz = session.role.includes("assistenz")
  let requesterId = session.userId
  let delegateId: number | null = null

  if (on_behalf_of && isAssistenz) {
    // Verify target user is in same department
    const [me] = await query("SELECT department FROM users WHERE id = ?", [session.userId]) as any[]
    const [target] = await query("SELECT id, department FROM users WHERE id = ? AND active = 1", [on_behalf_of]) as any[]
    if (!target) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })
    if (!me?.department || me.department !== target.department)
      return NextResponse.json({ error: "Stellvertretung nur für Mitarbeiter der eigenen Abteilung" }, { status: 403 })
    requesterId = parseInt(on_behalf_of)
    delegateId = session.userId
  }

  const year = new Date().getFullYear()
  await query("INSERT INTO ticket_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = last_number + 1", [year])
  const [counter] = await query("SELECT last_number FROM ticket_counters WHERE year = ?", [year])
  const { generateTicketNumber } = await import("@/lib/numbering")
  const ticketNumber = await generateTicketNumber(year, (counter as any).last_number)

  const result = await query(
    "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, delegate_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')",
    [ticketNumber, title, description, priority, category, requesterId, delegateId]
  ) as any
  const ticketId = result.insertId

  // Apply SLA rule based on requester's department
  try {
    const [user] = await query("SELECT department FROM users WHERE id = ?", [requesterId]) as any[]
    const { applySlaToTicket } = await import("@/lib/sla")
    await applySlaToTicket(ticketId, { category, department: user?.department, priority })
  } catch {}

  // Fire template trigger for ticket creation
  try {
    const { fireTemplateTrigger } = await import("@/lib/template-triggers")
    await fireTemplateTrigger("ticket_created", {
      ticket_nummer: ticketNumber,
      ticket_titel: title,
      ersteller_name: session.name,
      ersteller_email: session.email,
      datum: new Date().toLocaleDateString("de-DE"),
    })
  } catch {}

  return NextResponse.json({ id: ticketId, ticket_number: ticketNumber }, { status: 201 })
}
