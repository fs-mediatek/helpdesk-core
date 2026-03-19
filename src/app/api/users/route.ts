import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  let sql = "SELECT id, name, email, role, department, phone, active, created_at FROM users WHERE 1=1"
  const params: any[] = []
  if (search) { sql += " AND (name LIKE ? OR email LIKE ?)"; params.push(`%${search}%`, `%${search}%`) }
  sql += " ORDER BY name ASC"
  const users = await query(sql, params)
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { name, email, password, role = "user", department, phone } = await req.json()
  if (!name || !email || !password) return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 })
  const hash = await bcrypt.hash(password, 10)
  const { pool } = await import("@/lib/db")
  const [result] = await pool.execute(
    "INSERT INTO users (name, email, password_hash, role, department, phone) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, hash, role, department || null, phone || null]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
