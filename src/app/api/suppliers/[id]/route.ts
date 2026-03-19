import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const allowed = ["name","contact_name","contact_email","contact_phone","website","address","customer_number","notes","active"]
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (updates.length === 0) return NextResponse.json({ error: "Keine Felder" }, { status: 400 })
  const sets = updates.map(([k]) => `${k} = ?`).join(", ")
  const vals = updates.map(([, v]) => v ?? null)
  await query(`UPDATE suppliers SET ${sets} WHERE id = ?`, [...vals, id])
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await query("UPDATE suppliers SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
