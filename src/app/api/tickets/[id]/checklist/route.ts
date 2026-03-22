import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS ticket_checklist (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT UNSIGNED NOT NULL,
    content VARCHAR(500) NOT NULL,
    is_done TINYINT(1) DEFAULT 0,
    done_by VARCHAR(100) DEFAULT NULL,
    done_at TIMESTAMP NULL DEFAULT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket (ticket_id)
  )`).catch(() => {})
}

// GET — list checklist items
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()

  const { id } = await params
  const items = await query(
    "SELECT * FROM ticket_checklist WHERE ticket_id = ? ORDER BY sort_order, id",
    [id]
  )
  return NextResponse.json(items)
}

// POST — add item(s)
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()

  const { id } = await params
  const body = await req.json()

  // Support single item or array of items
  const items: string[] = Array.isArray(body.items) ? body.items : [body.content]

  const maxOrder = await query("SELECT MAX(sort_order) as m FROM ticket_checklist WHERE ticket_id = ?", [id]) as any[]
  let order = (maxOrder[0]?.m || 0) + 1

  for (const content of items) {
    if (!content?.trim()) continue
    await pool.execute(
      "INSERT INTO ticket_checklist (ticket_id, content, sort_order) VALUES (?, ?, ?)",
      [id, content.trim(), order++]
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

// PUT — toggle done or update content
export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { item_id, is_done, content } = await req.json()

  if (!item_id) return NextResponse.json({ error: "item_id erforderlich" }, { status: 400 })

  if (is_done !== undefined) {
    await pool.execute(
      "UPDATE ticket_checklist SET is_done = ?, done_by = ?, done_at = ? WHERE id = ? AND ticket_id = ?",
      [is_done ? 1 : 0, is_done ? session.name : null, is_done ? new Date() : null, item_id, id]
    )
  }

  if (content !== undefined) {
    await pool.execute(
      "UPDATE ticket_checklist SET content = ? WHERE id = ? AND ticket_id = ?",
      [content.trim(), item_id, id]
    )
  }

  return NextResponse.json({ success: true })
}

// DELETE — remove item
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { item_id } = await req.json()
  if (!item_id) return NextResponse.json({ error: "item_id erforderlich" }, { status: 400 })

  await pool.execute("DELETE FROM ticket_checklist WHERE id = ? AND ticket_id = ?", [item_id, id])
  return NextResponse.json({ success: true })
}
