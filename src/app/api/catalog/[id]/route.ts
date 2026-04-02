import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { name, description, category_id, inventory_item_id, supplier_id, emoji, price_estimate, sort_order, requires_description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  await query(
    "UPDATE catalog SET name=?, description=?, category_id=?, inventory_item_id=?, supplier_id=?, emoji=?, price_estimate=?, sort_order=?, requires_description=? WHERE id=?",
    [name.trim(), description || null, category_id || null, inventory_item_id || null, supplier_id || null, emoji || "📦", price_estimate || null, sort_order ?? 0, requires_description ? 1 : 0, id]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await query("UPDATE catalog SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
