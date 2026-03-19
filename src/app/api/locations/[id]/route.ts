import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const loc = await query("SELECT * FROM locations WHERE id = ? AND active = 1", [id])
  if (!loc[0]) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  // Enrich with asset and ticket counts
  const [assetCount] = await query<{ c: number }>("SELECT COUNT(*) as c FROM assets WHERE location = ?", [(loc[0] as any).name]).catch(() => [{ c: 0 }])
  const [ticketCount] = await query<{ c: number }>("SELECT COUNT(*) as c FROM tickets t JOIN assets a ON t.asset_id = a.id WHERE a.location = ? AND t.status NOT IN ('closed','resolved')", [(loc[0] as any).name]).catch(() => [{ c: 0 }])

  return NextResponse.json({ ...(loc[0] as any), asset_count: (assetCount as any)?.c ?? 0, open_tickets: (ticketCount as any)?.c ?? 0 })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, address, contact_name, contact_phone, contact_email, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  await query(
    "UPDATE locations SET name=?, address=?, contact_name=?, contact_phone=?, contact_email=?, notes=? WHERE id=?",
    [name.trim(), address || null, contact_name || null, contact_phone || null, contact_email || null, notes || null, id]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await query("UPDATE locations SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
