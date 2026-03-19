import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { name, description, color, steps } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  await query("UPDATE order_categories SET name=?, description=?, color=? WHERE id=?",
    [name.trim(), description || null, color || "blue", id])
  if (Array.isArray(steps)) {
    await query("DELETE FROM order_category_steps WHERE category_id = ?", [id])
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (s.step_name?.trim()) {
        await pool.execute(
          "INSERT INTO order_category_steps (category_id, step_name, step_order, description, assigned_roles, action_type) VALUES (?,?,?,?,?,?)",
          [id, s.step_name.trim(), i + 1, s.description || null, s.assigned_roles || null, s.action_type || "none"]
        )
      }
    }
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await query("UPDATE order_categories SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
