import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTemplateCols() {
  try { await pool.execute("ALTER TABLE templates ADD COLUMN type VARCHAR(20) DEFAULT 'answer'") } catch {}
  try { await pool.execute("ALTER TABLE templates ADD COLUMN trigger_event VARCHAR(50) DEFAULT 'none'") } catch {}
  try { await pool.execute("ALTER TABLE templates ADD COLUMN trigger_recipient VARCHAR(200) DEFAULT NULL") } catch {}
  try { await pool.execute("ALTER TABLE templates ADD COLUMN trigger_enabled TINYINT(1) DEFAULT 0") } catch {}
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTemplateCols()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const type = searchParams.get("type")
  let sql = "SELECT * FROM templates WHERE 1=1"
  const params: any[] = []
  if (search) { sql += " AND (name LIKE ? OR content LIKE ?)"; params.push(`%${search}%`, `%${search}%`) }
  if (type) { sql += " AND type = ?"; params.push(type) }
  sql += " ORDER BY category, name"
  const templates = await query(sql, params)
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTemplateCols()
  const { name, content, category, type, trigger_event, trigger_recipient, trigger_enabled } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const result = await query(
    "INSERT INTO templates (name, content, category, type, trigger_event, trigger_recipient, trigger_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name.trim(), content || "", category || null, type || "answer", trigger_event || "none", trigger_recipient || null, trigger_enabled ? 1 : 0]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID erforderlich" }, { status: 400 })
  await query("DELETE FROM templates WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
