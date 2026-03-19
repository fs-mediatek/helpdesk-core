import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
  if (!isAdmin) { where += " AND t.requester_id = ?"; params.push(session.userId) }
  if (status) { where += " AND t.status = ?"; params.push(status) }
  if (priority) { where += " AND t.priority = ?"; params.push(priority) }
  if (search) { where += " AND (t.title LIKE ? OR t.ticket_number LIKE ?)"; params.push(`%${search}%`, `%${search}%`) }

  const tickets = await query(`
    SELECT t.*, u.name as requester_name, a.name as assignee_name
    FROM tickets t
    LEFT JOIN users u ON t.requester_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    ${where} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `, params)

  const [countResult] = await query(`SELECT COUNT(*) as total FROM tickets t ${where}`, params)
  return NextResponse.json({ tickets, total: (countResult as any).total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { title, description, priority = "medium", category = "Sonstiges" } = await req.json()
  if (!title || !description) return NextResponse.json({ error: "Titel und Beschreibung erforderlich" }, { status: 400 })

  const year = new Date().getFullYear()
  await query("INSERT INTO ticket_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = last_number + 1", [year])
  const [counter] = await query("SELECT last_number FROM ticket_counters WHERE year = ?", [year])
  const { generateTicketNumber } = await import("@/lib/numbering")
  const ticketNumber = await generateTicketNumber(year, (counter as any).last_number)

  const result = await query(
    "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    [ticketNumber, title, description, priority, category, session.userId]
  ) as any
  const ticketId = result.insertId

  // Apply SLA rule
  try {
    const [user] = await query("SELECT department FROM users WHERE id = ?", [session.userId]) as any[]
    const { applySlaToTicket } = await import("@/lib/sla")
    await applySlaToTicket(ticketId, { category, department: user?.department, priority })
  } catch {}

  return NextResponse.json({ id: ticketId, ticket_number: ticketNumber }, { status: 201 })
}
