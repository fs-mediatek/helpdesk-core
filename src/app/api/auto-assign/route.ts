import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS auto_assign_rules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    assign_to_user_id INT UNSIGNED NOT NULL,
    priority INT DEFAULT 100,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()

  const rules = await query(
    `SELECT r.*, u.name as user_name, u.email as user_email
     FROM auto_assign_rules r
     LEFT JOIN users u ON r.assign_to_user_id = u.id
     ORDER BY r.priority ASC, r.id ASC`
  )

  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()

  const { category, department, assign_to_user_id, priority } = await req.json()
  if (!assign_to_user_id) return NextResponse.json({ error: "Agent erforderlich" }, { status: 400 })

  const [result] = await pool.execute(
    "INSERT INTO auto_assign_rules (category, department, assign_to_user_id, priority) VALUES (?, ?, ?, ?)",
    [category || null, department || null, assign_to_user_id, priority || 100]
  ) as any

  return NextResponse.json({ id: result.insertId }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "ID erforderlich" }, { status: 400 })

  await query("DELETE FROM auto_assign_rules WHERE id = ?", [id])
  return NextResponse.json({ ok: true })
}
