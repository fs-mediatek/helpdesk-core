import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ key: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { key } = await params
  const { label, color } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: "Label erforderlich" }, { status: 400 })
  await query("UPDATE roles SET label=?, color=? WHERE name=?", [label.trim(), color || null, key])
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { key } = await params
  const role = await query("SELECT is_builtin FROM roles WHERE name = ?", [key]) as any[]
  if (!role[0]) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 })
  if (role[0].is_builtin) return NextResponse.json({ error: "Systemrollen können nicht gelöscht werden" }, { status: 400 })
  await query("DELETE FROM roles WHERE name = ? AND is_builtin = 0", [key])
  return NextResponse.json({ success: true })
}
