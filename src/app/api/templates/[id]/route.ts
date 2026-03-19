import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { title, content, category, tags } = await req.json()
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: "Titel und Inhalt erforderlich" }, { status: 400 })
  await query(
    "UPDATE response_templates SET title=?, content=?, category=?, tags=? WHERE id=?",
    [title.trim(), content.trim(), category || null, tags || null, id]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  await query("DELETE FROM response_templates WHERE id = ?", [(await params).id])
  return NextResponse.json({ success: true })
}
