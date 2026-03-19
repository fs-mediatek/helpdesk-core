import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { signToken } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 })
  }
  const users = await query("SELECT * FROM users WHERE email = ? AND active = 1", [email])
  const user = (users as any[])[0]
  if (!user) return NextResponse.json({ error: "Ungültige Zugangsdaten" }, { status: 401 })
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return NextResponse.json({ error: "Ungültige Zugangsdaten" }, { status: 401 })
  const token = await signToken({ userId: user.id, email: user.email, name: user.name, role: user.role })
  const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  response.cookies.set("token", token, { httpOnly: true, path: "/", maxAge: 86400, sameSite: "lax" })
  return response
}
