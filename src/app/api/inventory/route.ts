import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const lowStock = searchParams.get("low_stock")
  let sql = "SELECT i.*, s.name as supplier_name FROM inventory_items i LEFT JOIN suppliers s ON i.supplier_id = s.id WHERE i.active = 1"
  const params: any[] = []
  if (search) { sql += " AND (i.name LIKE ? OR i.sku LIKE ?)"; params.push(`%${search}%`, `%${search}%`) }
  if (lowStock === "1") sql += " AND i.quantity <= i.min_quantity AND i.min_quantity > 0"
  sql += " ORDER BY i.category, i.name"
  const items = await query(sql, params)
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, category, sku, location, quantity, min_quantity, unit, price, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const [result] = await pool.execute(
    "INSERT INTO inventory_items (name, category, sku, location, quantity, min_quantity, unit, price, notes) VALUES (?,?,?,?,?,?,?,?,?)",
    [name.trim(), category || "accessory", sku || null, location || "Lager", quantity || 0, min_quantity || 0, unit || "Stk.", price || null, notes || null]
  ) as any
  if ((quantity || 0) > 0) {
    await pool.execute("INSERT INTO inventory_movements (item_id, type, quantity, reason, performed_by) VALUES (?,?,?,?,?)",
      [result.insertId, "in", quantity, "Erstbestand", session.userId])
  }
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
