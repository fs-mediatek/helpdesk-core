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

  // Advance step
  if (body.action === "advance") {
    const [request] = await query("SELECT current_step, type FROM onboarding_requests WHERE id = ?", [id]) as any[]
    if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

    // Complete current step
    await query(
      "UPDATE onboarding_step_progress SET status='completed', completed_at=NOW(), completed_by=?, notes=? WHERE request_id=? AND step_order=?",
      [session.userId, body.notes || null, id, request.current_step]
    )

    // Check if there's a next step
    const [nextStep] = await query(
      "SELECT step_order FROM onboarding_step_progress WHERE request_id = ? AND step_order > ? ORDER BY step_order ASC LIMIT 1",
      [id, request.current_step]
    ) as any[]

    if (nextStep) {
      await query("UPDATE onboarding_step_progress SET status='active' WHERE request_id=? AND step_order=?", [id, nextStep.step_order])
      await query("UPDATE onboarding_requests SET current_step=?, status='in_progress' WHERE id=?", [nextStep.step_order, id])
    } else {
      // All steps done
      await query("UPDATE onboarding_requests SET status='completed' WHERE id=?", [id])
    }

    return NextResponse.json({ success: true })
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
