import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureColumns() {
  const cols: [string, string][] = [
    ["notify_ticket_created", "TINYINT(1) DEFAULT 1"],
    ["notify_ticket_status", "TINYINT(1) DEFAULT 1"],
    ["notify_ticket_comment", "TINYINT(1) DEFAULT 1"],
    ["notify_ticket_assigned", "TINYINT(1) DEFAULT 1"],
    ["notify_order_status", "TINYINT(1) DEFAULT 1"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE users ADD COLUMN ${col} ${def}`).catch(() => {})
  }
}

// GET profile + notification preferences
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureColumns()
  const [user] = await query(
    `SELECT id, name, email, role, department, phone,
            IFNULL(notify_ticket_created,1) as notify_ticket_created,
            IFNULL(notify_ticket_status,1) as notify_ticket_status,
            IFNULL(notify_ticket_comment,1) as notify_ticket_comment,
            IFNULL(notify_ticket_assigned,1) as notify_ticket_assigned,
            IFNULL(notify_order_status,1) as notify_order_status
     FROM users WHERE id = ?`,
    [session.userId]
  ) as any[]
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}

// PUT profile updates
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureColumns()

  const body = await req.json()

  // Profile fields users can change themselves
  const profileFields = ["phone", "department"]
  const notifyFields = ["notify_ticket_created", "notify_ticket_status", "notify_ticket_comment", "notify_ticket_assigned", "notify_order_status"]

  const updates: string[] = []
  const values: any[] = []

  for (const field of profileFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(body[field] || null)
    }
  }
  for (const field of notifyFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(body[field] ? 1 : 0)
    }
  }

  // Password change
  if (body.new_password) {
    if (!body.new_password || body.new_password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mind. 6 Zeichen haben" }, { status: 400 })
    }
    const bcrypt = require("bcryptjs")
    const hash = await bcrypt.hash(body.new_password, 10)
    updates.push("password_hash = ?")
    values.push(hash)
  }

  if (updates.length === 0) return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 })

  values.push(session.userId)
  await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values)
  return NextResponse.json({ success: true })
}
