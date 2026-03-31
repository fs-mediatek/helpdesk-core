import { NextRequest, NextResponse } from "next/server"

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

export async function GET(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const search = new URL(req.url).searchParams.get("search") || ""
  if (!search || search.length < 2) {
    return NextResponse.json([])
  }

  const pattern = `%${search}%`
  const users = await query(
    `SELECT u.id, u.name, u.email, u.department,
       (SELECT COUNT(*) FROM assets a WHERE a.assigned_to_user_id = u.id AND (a.active = 1 OR a.active IS NULL)) as asset_count
     FROM users u
     WHERE (u.name LIKE ? OR u.email LIKE ?)
     AND u.active = 1
     ORDER BY u.name ASC
     LIMIT 20`,
    [pattern, pattern]
  )

  return NextResponse.json(users)
}
