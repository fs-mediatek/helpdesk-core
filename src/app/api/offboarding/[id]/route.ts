import { NextRequest, NextResponse } from "next/server"

type Ctx = { params: Promise<{ id: string }> }

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const [request] = await query(`
    SELECT r.*, u.name as assigned_to_name, c.name as created_by_name
    FROM onboarding_requests r
    LEFT JOIN users u ON r.assigned_to_id = u.id
    LEFT JOIN users c ON r.created_by_id = c.id
    WHERE r.id = ? AND r.type = 'offboarding'
  `, [id]) as any[]
  if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  // Get checklist items
  const checklist = await query(
    "SELECT * FROM onboarding_checklist WHERE request_id = ? ORDER BY id ASC",
    [id]
  )

  // Get device returns
  const devices = await query(
    "SELECT * FROM offboarding_device_returns WHERE request_id = ? ORDER BY id ASC",
    [id]
  )

  // Get employee info
  const employeeInfo = request.employee_email
    ? await query("SELECT id, name, email, department, phone FROM users WHERE email = ? LIMIT 1", [request.employee_email]).catch(() => [])
    : []

  return NextResponse.json({
    ...request,
    checklist,
    devices,
    employee: (employeeInfo as any[])[0] || null,
  })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  // Toggle checklist item
  if (body.checklist_id !== undefined && body.is_done !== undefined) {
    const [item] = await query("SELECT * FROM onboarding_checklist WHERE id = ? AND request_id = ?", [body.checklist_id, id]) as any[]
    if (!item) return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 })
    await pool.execute(
      "UPDATE onboarding_checklist SET done = ?, done_by_id = ?, done_at = ? WHERE id = ?",
      [body.is_done ? 1 : 0, body.is_done ? session.userId : null, body.is_done ? new Date() : null, body.checklist_id]
    )
    return NextResponse.json({ success: true })
  }

  // Return device
  if (body.action === "return_device" && body.device_id) {
    const [device] = await query(
      "SELECT * FROM offboarding_device_returns WHERE id = ? AND request_id = ?",
      [body.device_id, id]
    ) as any[]
    if (!device) return NextResponse.json({ error: "Gerät nicht gefunden" }, { status: 404 })

    const conditionJson = JSON.stringify(body.condition || {})
    await pool.execute(
      `UPDATE offboarding_device_returns SET status = 'returned', condition_notes = ?, return_date = CURDATE(), received_by_id = ? WHERE id = ?`,
      [conditionJson, session.userId, body.device_id]
    )

    // Update asset: unassign and set available
    if (device.asset_id) {
      await pool.execute(
        "UPDATE assets SET assigned_to_user_id = NULL, status = 'available' WHERE id = ?",
        [device.asset_id]
      )
    }

    return NextResponse.json({ success: true })
  }

  // Update status
  if (body.status) {
    const validStatuses = ["pending", "in_progress", "completed", "cancelled"]
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Ungueltiger Status" }, { status: 400 })
    }
    await pool.execute(
      "UPDATE onboarding_requests SET status = ? WHERE id = ? AND type = 'offboarding'",
      [body.status, id]
    )
    return NextResponse.json({ success: true })
  }

  // General field updates
  const allowedFields = ["notes", "assigned_to_id", "last_working_day", "exit_reason"]
  const updates = Object.entries(body).filter(([k]) => allowedFields.includes(k))
  if (updates.length > 0) {
    const sets = updates.map(([k]) => `${k} = ?`).join(", ")
    const vals = updates.map(([, v]) => v)
    await pool.execute(`UPDATE onboarding_requests SET ${sets} WHERE id = ? AND type = 'offboarding'`, [...vals, id])
  }

  return NextResponse.json({ success: true })
}
