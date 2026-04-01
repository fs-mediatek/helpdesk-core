import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  if (!roles.some(r => ["admin", "agent"].includes(r)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { name, asset_tag, type, platform, status, model, manufacturer, serial_number, notes,
          purchase_price, supplier_id, invoice_number, commissioned_at, assigned_to_user_id } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  // Auto-set status based on assignment
  let effectiveStatus = status || "available"
  if (assigned_to_user_id) {
    if (effectiveStatus === "available") effectiveStatus = "assigned"
  } else {
    if (effectiveStatus === "assigned") effectiveStatus = "available"
  }
  await query(
    `UPDATE assets SET name=?, asset_tag=?, type=?, platform=?, status=?, model=?, manufacturer=?,
     serial_number=?, notes=?, purchase_price=?, supplier_id=?, invoice_number=?, commissioned_at=?, assigned_to_user_id=?
     WHERE id=?`,
    [name.trim(), asset_tag || null, type || null, platform || "other", effectiveStatus,
     model || null, manufacturer || null, serial_number || null, notes || null,
     purchase_price || null, supplier_id || null, invoice_number || null, commissioned_at || null,
     assigned_to_user_id || null, id]
  )
  // Fire template trigger when asset is assigned to a user
  if (assigned_to_user_id) {
    try {
      const { fireTemplateTrigger } = await import("@/lib/template-triggers")
      const assignedUser = await query("SELECT name, email FROM users WHERE id = ?", [assigned_to_user_id]) as any[]
      await fireTemplateTrigger("asset_assigned", {
        geraet_name: name,
        geraet_tag: asset_tag,
        betroffener_name: assignedUser[0]?.name,
        betroffener_email: assignedUser[0]?.email,
        datum: new Date().toLocaleDateString("de-DE"),
      })
    } catch {}
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  if (!roles.includes("admin"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await query("UPDATE assets SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
