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

  // Get device returns (JOIN with assets for platform/type info)
  const devices = await query(
    `SELECT d.*, a.platform as asset_platform, a.type as asset_type
     FROM offboarding_device_returns d
     LEFT JOIN assets a ON d.asset_id = a.id
     WHERE d.request_id = ? ORDER BY d.id ASC`,
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

async function closeLinkedTicket(requestId: number, agentUserId: number) {
  try {
    const { query, pool } = await import("@/lib/db")
    // Find linked ticket by matching title pattern "Offboarding: {name}"
    const [request] = await query("SELECT employee_name FROM onboarding_requests WHERE id = ?", [requestId]) as any[]
    if (!request) return
    const tickets = await query(
      "SELECT id FROM tickets WHERE title LIKE ? AND status NOT IN ('closed','resolved')",
      [`%Offboarding%${request.employee_name}%`]
    ) as any[]
    for (const ticket of tickets) {
      await pool.execute(
        "UPDATE tickets SET status = 'closed', assignee_id = ? WHERE id = ?",
        [agentUserId, ticket.id]
      )
    }
  } catch {}
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

  // Advance step (with optional action_type execution)
  if (body.action === "advance" || body.action === "approve" || body.action === "reject"
      || body.action === "cost_entry" || body.action === "asset_assign"
      || body.action === "access_code_gen" || body.action === "access_code_confirm") {
    const { executeStepAction, advanceWorkflow } = await import("@/lib/workflow-engine")

    const [request] = await query("SELECT current_step, type FROM onboarding_requests WHERE id = ? AND type = 'offboarding'", [id]) as any[]
    if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

    // Get the current step's action_type
    const [currentStep] = await query(
      "SELECT * FROM onboarding_step_progress WHERE request_id = ? AND step_order = ?",
      [id, request.current_step]
    ) as any[]
    if (!currentStep) return NextResponse.json({ error: "Kein aktiver Schritt" }, { status: 400 })

    const actionType = body.action === "advance" ? (currentStep.action_type || "none") : body.action

    // For access_code_confirm, load expected code
    if (actionType === "access_code_confirm") {
      const [reqData] = await query("SELECT access_code FROM onboarding_requests WHERE id = ?", [id]) as any[]
      body.expected_code = reqData?.access_code || ""
    }

    // For reject action, map to approval with reject flag
    if (body.action === "reject") {
      body.reject = true
    }

    const result = await executeStepAction({
      stepId: currentStep.id,
      actionType,
      userId: session.userId,
      userName: session.name,
      body,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Handle rejection
    if (result.data?.rejected) {
      await pool.execute("UPDATE onboarding_requests SET status='cancelled', notes=? WHERE id=? AND type='offboarding'",
        [result.data.reason, id])
      await pool.execute("UPDATE onboarding_step_progress SET status='completed', completed_at=NOW(), completed_by=?, notes=? WHERE request_id=? AND status IN ('active','pending')",
        [session.userId, `Abgelehnt: ${result.data.reason}`, id])
      return NextResponse.json({ success: true })
    }

    // Handle action-specific side effects
    if (result.data?.access_code) {
      await pool.execute("UPDATE onboarding_requests SET access_code=? WHERE id=?", [result.data.access_code, id]).catch(() => {})
    }

    // Advance the workflow
    if (result.advance) {
      const notes = body.notes || (result.data?.total_cost ? `Kosten: ${result.data.total_cost} €` : null)
      const advancement = await advanceWorkflow(
        "onboarding_step_progress", "request_id", Number(id), session.userId, notes
      )

      if (advancement.completed) {
        await pool.execute("UPDATE onboarding_requests SET status='completed' WHERE id=? AND type='offboarding'", [id])
        await closeLinkedTicket(Number(id), session.userId)
      } else if (advancement.nextStep) {
        await pool.execute("UPDATE onboarding_requests SET current_step=?, status='in_progress' WHERE id=? AND type='offboarding'",
          [advancement.nextStep, id])
      }
    }

    return NextResponse.json({ success: true, data: result.data })
  }

  // Return device
  if (body.action === "return_device" && body.device_id) {
    const [device] = await query(
      "SELECT * FROM offboarding_device_returns WHERE id = ? AND request_id = ?",
      [body.device_id, id]
    ) as any[]
    if (!device) return NextResponse.json({ error: "Gerät nicht gefunden" }, { status: 404 })

    const conditionData: Record<string, any> = { ...(body.condition || {}) }
    if (body.note) conditionData.notes = body.note
    if (body.photos && Array.isArray(body.photos)) conditionData.photos = body.photos
    const conditionJson = JSON.stringify(conditionData)
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
    if (body.status === "completed") {
      await closeLinkedTicket(Number(id), session.userId)
    }
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
