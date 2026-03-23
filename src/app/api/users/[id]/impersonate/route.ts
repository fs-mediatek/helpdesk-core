import { NextRequest, NextResponse } from "next/server"
import { getSession, signToken } from "@/lib/auth"
import { query } from "@/lib/db"
import { cookies } from "next/headers"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !session.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const [user] = await query("SELECT id, name, email, role FROM users WHERE id = ? AND active = 1", [id]) as any[]
  if (!user) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })

  const cookieStore = await cookies()
  // Save original admin token so we can return to it later
  const originalToken = cookieStore.get("token")?.value
  if (originalToken) {
    cookieStore.set("original_token", originalToken, { httpOnly: true, path: "/", maxAge: 60 * 60 * 8 })
  }

  const token = await signToken({ userId: user.id, email: user.email, name: user.name, role: user.role })
  cookieStore.set("token", token, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 })
  return NextResponse.json({ success: true })
}
