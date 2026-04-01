import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const [request] = await query(`
    SELECT r.*, u.name as assigned_to_name, c.name as created_by_name
    FROM onboarding_requests r
    LEFT JOIN users u ON r.assigned_to_id = u.id
    LEFT JOIN users c ON r.created_by_id = c.id
    WHERE r.id = ?
  `, [id]) as any[]
  if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  // Get workflow step progress
  const steps = await query(
    "SELECT * FROM onboarding_step_progress WHERE request_id = ? ORDER BY step_order ASC",
    [id]
  )

  // Get checklist
  const checklist = await query(
    "SELECT * FROM onboarding_checklist WHERE request_id = ? ORDER BY id ASC",
    [id]
  )

  // Get workflow step definitions (for roles)
  const stepDefs = await query(
    "SELECT step_order, assigned_roles, description FROM onboarding_workflow_steps WHERE type = ? ORDER BY step_order ASC",
    [request.type]
  )

  return NextResponse.json({ ...request, steps, checklist, stepDefs })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Advance step (with optional action_type execution)
  if (body.action === "advance" || body.action === "approve" || body.action === "reject"
      || body.action === "cost_entry" || body.action === "asset_assign"
      || body.action === "access_code_gen" || body.action === "access_code_confirm") {
    const { executeStepAction, advanceWorkflow } = await import("@/lib/workflow-engine")

    const [request] = await query("SELECT current_step, type FROM onboarding_requests WHERE id = ?", [id]) as any[]
    if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

    // Get the current step's action_type
    const [currentStep] = await query(
      "SELECT * FROM onboarding_step_progress WHERE request_id = ? AND step_order = ?",
      [id, request.current_step]
    ) as any[]
    if (!currentStep) return NextResponse.json({ error: "Kein aktiver Schritt" }, { status: 400 })

    const actionType = body.action === "advance" ? (currentStep.action_type || "none") : body.action

    // For access_code_confirm, load expected code from the request
    if (actionType === "access_code_confirm") {
      const [reqData] = await query("SELECT access_code FROM onboarding_requests WHERE id = ?", [id]) as any[]
      body.expected_code = reqData?.access_code || ""
    }

    // For reject action, map to approval with reject flag
    if (body.action === "reject") {
      body.reject = true
    }

    // Execute the action type logic
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

    // Handle rejection (don't advance, mark as rejected)
    if (result.data?.rejected) {
      await query("UPDATE onboarding_requests SET status='cancelled', notes=? WHERE id=?",
        [result.data.reason, id])
      await query("UPDATE onboarding_step_progress SET status='completed', completed_at=NOW(), completed_by=?, notes=? WHERE request_id=? AND status IN ('active','pending')",
        [session.userId, `Abgelehnt: ${result.data.reason}`, id])
      return NextResponse.json({ success: true })
    }

    // Handle action-specific side effects
    if (result.data?.access_code) {
      await query("UPDATE onboarding_requests SET access_code=? WHERE id=?", [result.data.access_code, id]).catch(() => {})
    }

    // Advance the workflow if the action says so
    if (result.advance) {
      const notes = body.notes || (result.data?.total_cost ? `Kosten: ${result.data.total_cost} €` : null)
      const advancement = await advanceWorkflow(
        "onboarding_step_progress", "request_id", Number(id), session.userId, notes
      )

      if (advancement.completed) {
        await query("UPDATE onboarding_requests SET status='completed' WHERE id=?", [id])
      } else if (advancement.nextStep) {
        await query("UPDATE onboarding_requests SET current_step=?, status='in_progress' WHERE id=?",
          [advancement.nextStep, id])
      }
    }

    return NextResponse.json({ success: true, data: result.data })
  }

  // Toggle checklist item
  if (body.action === "toggle_checklist") {
    const [item] = await query("SELECT * FROM onboarding_checklist WHERE id = ?", [body.item_id]) as any[]
    if (!item) return NextResponse.json({ error: "Item nicht gefunden" }, { status: 404 })
    await query(
      "UPDATE onboarding_checklist SET done=?, done_by_id=?, done_at=? WHERE id=?",
      [item.done ? 0 : 1, item.done ? null : session.userId, item.done ? null : new Date(), body.item_id]
    )
    return NextResponse.json({ success: true })
  }

  // General update
  const allowed = ["status", "assigned_to_id", "notes", "employee_email", "department"]
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (updates.length > 0) {
    const sets = updates.map(([k]) => `${k} = ?`).join(", ")
    const vals = updates.map(([, v]) => v)
    await query(`UPDATE onboarding_requests SET ${sets} WHERE id = ?`, [...vals, id])
  }

  return NextResponse.json({ success: true })
}
