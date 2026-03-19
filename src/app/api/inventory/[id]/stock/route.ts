import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { type, quantity, reason } = await req.json()
  if (!type || !quantity) return NextResponse.json({ error: "Typ und Menge erforderlich" }, { status: 400 })
  const [item] = await query("SELECT quantity FROM inventory_items WHERE id = ?", [id]) as any[]
  if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  const qty = parseInt(quantity)
  let newQty: number
  if (type === "in") newQty = item.quantity + qty
  else if (type === "out") newQty = Math.max(0, item.quantity - qty)
  else if (type === "correction") newQty = qty
  else return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 })
  await query("UPDATE inventory_items SET quantity = ? WHERE id = ?", [newQty, id])
  await pool.execute("INSERT INTO inventory_movements (item_id, type, quantity, reason, performed_by) VALUES (?,?,?,?,?)",
    [id, type, qty, reason || null, session.userId])
  return NextResponse.json({ quantity: newQty })
}
