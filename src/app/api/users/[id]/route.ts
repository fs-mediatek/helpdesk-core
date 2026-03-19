import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import bcrypt from "bcryptjs"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session || !session.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const [user] = await query("SELECT id, name, email, role, department, phone, active, created_at FROM users WHERE id = ?", [id]) as any[]
  if (!user) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session || !session.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const body = await req.json()
  const { password, ...rest } = body
  const allowed = ["name", "email", "role", "department", "phone", "active"]
  const updates = Object.entries(rest).filter(([k]) => allowed.includes(k))
  if (password) {
    const hash = await bcrypt.hash(password, 10)
    updates.push(["password_hash", hash])
  }
  if (updates.length === 0) return NextResponse.json({ error: "Keine Felder" }, { status: 400 })
  const sets = updates.map(([k]) => `${k} = ?`).join(", ")
  const vals = updates.map(([, v]) => v)
  await query(`UPDATE users SET ${sets} WHERE id = ?`, [...vals, id])
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session || !session.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  if (parseInt(id) === session.userId) return NextResponse.json({ error: "Eigenen Account nicht löschbar" }, { status: 400 })
  await query("UPDATE users SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
