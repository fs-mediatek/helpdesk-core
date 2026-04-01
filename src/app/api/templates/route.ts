import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTemplateCols() {
  try { await pool.execute("ALTER TABLE response_templates ADD COLUMN type VARCHAR(20) DEFAULT 'answer'") } catch {}
  try { await pool.execute("ALTER TABLE response_templates ADD COLUMN trigger_event VARCHAR(50) DEFAULT 'none'") } catch {}
  try { await pool.execute("ALTER TABLE response_templates ADD COLUMN trigger_recipient VARCHAR(200) DEFAULT NULL") } catch {}
  try { await pool.execute("ALTER TABLE response_templates ADD COLUMN trigger_enabled TINYINT(1) DEFAULT 0") } catch {}
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTemplateCols()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  const type = searchParams.get("type")
  let sql = "SELECT t.*, u.name as created_by_name FROM response_templates t LEFT JOIN users u ON t.created_by = u.id WHERE t.active = 1"
  const params: any[] = []
  if (search) { sql += " AND (t.title LIKE ? OR t.content LIKE ?)"; params.push(`%${search}%`, `%${search}%`) }
  if (type) { sql += " AND t.type = ?"; params.push(type) }
  sql += " ORDER BY t.sort_order, t.title"
  const templates = await query(sql, params)
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTemplateCols()
  const { title, content, category, tags, type, trigger_event, trigger_recipient, trigger_enabled } = await req.json()
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: "Titel und Inhalt erforderlich" }, { status: 400 })
  const result = await query(
    "INSERT INTO response_templates (title, content, category, tags, created_by, type, trigger_event, trigger_recipient, trigger_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [title.trim(), content.trim(), category || null, tags || null, session.userId, type || "answer", trigger_event || "none", trigger_recipient || null, trigger_enabled ? 1 : 0]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "ID erforderlich" }, { status: 400 })
  await query("DELETE FROM response_templates WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
