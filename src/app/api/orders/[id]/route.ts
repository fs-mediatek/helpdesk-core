import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

function generateAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

async function completeActiveStep(id: string, userId: number, notes?: string) {
  const [activeStep] = await query("SELECT * FROM order_progress_steps WHERE order_id = ? AND status = 'active'", [id]) as any[]
  if (!activeStep) return null
  await query("UPDATE order_progress_steps SET status='completed', completed_at=NOW(), completed_by=?, notes=? WHERE id=?",
    [userId, notes || null, activeStep.id])
  const allSteps = await query("SELECT * FROM order_progress_steps WHERE order_id = ? ORDER BY step_order", [id]) as any[]
  const totalSteps = allSteps.length
  const [nextStep] = await query("SELECT * FROM order_progress_steps WHERE order_id = ? AND step_order = ?",
    [id, activeStep.step_order + 1]) as any[]
  if (nextStep) await query("UPDATE order_progress_steps SET status='active' WHERE id=?", [nextStep.id])
  // Map position to order status
  let newStatus: string | null = null
  const pos = activeStep.step_order
  if (pos >= totalSteps) newStatus = "completed"
  else if (pos >= totalSteps - 1) newStatus = "delivered"
  else if (pos >= totalSteps - 2) newStatus = "shipped"
  else if (pos >= totalSteps - 3) newStatus = "ordered"
  else if (pos >= 2) newStatus = "approved"
  if (newStatus) {
    await query("UPDATE orders SET status=?, updated_at=NOW() WHERE id=?", [newStatus, id])
    if (newStatus === "approved") await query("UPDATE orders SET approved_by=? WHERE id=?", [userId, id])
  }
  return activeStep
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const [order] = await query(
    `SELECT o.*, r.name as requested_by_name, r.email as requested_by_email, a.name as approved_by_name,
            c.name as category_name, c.color as category_color,
            ast.name as asset_name, ast.asset_tag
     FROM orders o
     LEFT JOIN users r ON o.requested_by = r.id
     LEFT JOIN users a ON o.approved_by = a.id
     LEFT JOIN order_categories c ON o.category_id = c.id
     LEFT JOIN assets ast ON o.assigned_asset_id = ast.id
     WHERE o.id = ?`, [id]
  ) as any[]
  if (!order) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  const items = await query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", [id]) as any[]

  // Supplier info: via product_id or item_name match
  let supplier_info: any = null
  try {
    const [sup] = await query(
      `SELECT DISTINCT s.id, s.name, s.website, s.contact_email, s.contact_phone
       FROM order_items oi
       JOIN order_products op ON (oi.product_id = op.id OR oi.item_name = op.name)
       JOIN suppliers s ON op.supplier_id = s.id
       WHERE oi.order_id = ? LIMIT 1`, [id]
    ) as any[]
    if (sup) supplier_info = sup
  } catch {}

  // Available assets: unassigned assets matching the ordered product names
  let available_assets: any[] = []
  try {
    if ((items as any[]).length > 0) {
      const names = (items as any[]).map(i => i.item_name).filter(Boolean)
      if (names.length > 0) {
        const likeClauses = names.map(() => "a.name LIKE ?").join(" OR ")
        const likeParams = names.map(n => `%${n}%`)
        available_assets = await query(
          `SELECT a.id, a.name, a.asset_tag, a.type, a.status
           FROM assets a WHERE a.assigned_to IS NULL AND (${likeClauses})
           ORDER BY a.name LIMIT 8`, likeParams
        ) as any[]
      }
    }
  } catch {}
  const steps = await query(
    `SELECT s.*, u.name as completed_by_name FROM order_progress_steps s
     LEFT JOIN users u ON s.completed_by = u.id WHERE s.order_id = ? ORDER BY s.step_order`, [id]
  )
  // Load step metadata (action_type, assigned_roles) from category steps if available
  const categorySteps = order.category_id
    ? await query("SELECT * FROM order_category_steps WHERE category_id = ? ORDER BY step_order", [order.category_id]) as any[]
    : []
  const enrichedSteps = (steps as any[]).map((step, i) => {
    const catStep = categorySteps[i] || {}
    return { ...step, action_type: catStep.action_type || "none", assigned_roles: catStep.assigned_roles || null }
  })
  return NextResponse.json({ ...order, items, steps: enrichedSteps, supplier_info, available_assets })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Standard advance
  if (body.action === "advance") {
    const step = await completeActiveStep(id, session.userId, body.notes)
    if (!step) return NextResponse.json({ error: "Kein aktiver Schritt" }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  // Approval action
  if (body.action === "approve") {
    await query("UPDATE orders SET approved_by=?, updated_at=NOW() WHERE id=?", [session.userId, id])
    await completeActiveStep(id, session.userId, "Genehmigt")
    return NextResponse.json({ success: true })
  }

  // Rejection
  if (body.action === "reject") {
    if (!body.reason) return NextResponse.json({ error: "Begründung erforderlich" }, { status: 400 })
    await query("UPDATE orders SET status='rejected', rejection_reason=?, approved_by=?, updated_at=NOW() WHERE id=?",
      [body.reason, session.userId, id])
    await query("UPDATE order_progress_steps SET status='completed' WHERE order_id=? AND status IN ('active','pending')", [id])
    return NextResponse.json({ success: true })
  }

  // Cost entry + advance
  if (body.action === "cost_entry") {
    if (body.total_cost !== undefined) {
      await query("UPDATE orders SET total_cost=?, updated_at=NOW() WHERE id=?", [body.total_cost, id])
    }
    await completeActiveStep(id, session.userId, body.notes || (body.total_cost ? `Kosten: ${body.total_cost} €` : null))
    return NextResponse.json({ success: true })
  }

  // Asset assignment + advance
  if (body.action === "asset_assign") {
    if (!body.asset_id) return NextResponse.json({ error: "Asset auswählen" }, { status: 400 })
    await query("UPDATE orders SET assigned_asset_id=?, updated_at=NOW() WHERE id=?", [body.asset_id, id])
    // Assign asset to the requester
    const [order] = await query("SELECT requested_by FROM orders WHERE id=?", [id]) as any[]
    if (order) {
      await query("UPDATE assets SET assigned_to=? WHERE id=?", [order.requested_by, body.asset_id]).catch(() => {})
    }
    await completeActiveStep(id, session.userId, `Asset #${body.asset_id} zugewiesen`)
    return NextResponse.json({ success: true })
  }

  // Generate access code
  if (body.action === "access_code_gen") {
    const code = generateAccessCode()
    await query("UPDATE orders SET access_code=?, updated_at=NOW() WHERE id=?", [code, id])
    await completeActiveStep(id, session.userId, "Zugangscode generiert")
    return NextResponse.json({ success: true, access_code: code })
  }

  // Confirm access code
  if (body.action === "access_code_confirm") {
    const [order] = await query("SELECT access_code FROM orders WHERE id=?", [id]) as any[]
    if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden" }, { status: 404 })
    if (!body.code || body.code.trim().toUpperCase() !== (order.access_code || "").toUpperCase()) {
      return NextResponse.json({ error: "Zugangscode stimmt nicht überein" }, { status: 400 })
    }
    await completeActiveStep(id, session.userId, "Zugangscode bestätigt — Übergabe abgeschlossen")
    return NextResponse.json({ success: true })
  }

  // General field update
  const allowed = ["title", "description", "priority", "supplier", "estimated_delivery", "status", "total_cost"]
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (updates.length === 0) return NextResponse.json({ error: "Keine Felder" }, { status: 400 })
  const sets = updates.map(([k]) => `${k} = ?`).join(", ")
  const vals = updates.map(([, v]) => v ?? null)
  await query(`UPDATE orders SET ${sets}, updated_at=NOW() WHERE id=?`, [...vals, id])
  return NextResponse.json({ success: true })
}
