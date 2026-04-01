import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { name, content, category, type, trigger_event, trigger_recipient, trigger_enabled } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  await query(
    "UPDATE templates SET name=?, content=?, category=?, type=?, trigger_event=?, trigger_recipient=?, trigger_enabled=? WHERE id=?",
    [name.trim(), content || "", category || null, type || "answer", trigger_event || "none", trigger_recipient || null, trigger_enabled ? 1 : 0, id]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await query("DELETE FROM templates WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
