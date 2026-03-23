import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

// Returns active users in the same department as the current user (for assistenz on-behalf-of)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [me] = await query("SELECT department FROM users WHERE id = ?", [session.userId]) as any[]
  if (!me?.department) return NextResponse.json([])

  const colleagues = await query(
    "SELECT id, name, email FROM users WHERE department = ? AND active = 1 AND id != ? ORDER BY name ASC",
    [me.department, session.userId]
  )
  return NextResponse.json(colleagues)
}
