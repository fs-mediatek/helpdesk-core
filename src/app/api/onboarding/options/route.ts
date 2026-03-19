import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS onboarding_options (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    value VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 100,
    active TINYINT(1) DEFAULT 1,
    UNIQUE KEY uq_type_value (type, value)
  )`).catch(() => {})
  // Phone prefix setting
  await pool.execute(`INSERT IGNORE INTO settings (key_name, value) VALUES ('phone_prefix', '03641 806')`).catch(() => {})
}

// GET — list options by type, or all grouped
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const type = new URL(req.url).searchParams.get("type")
  if (type) {
    const rows = await query("SELECT id, value, sort_order FROM onboarding_options WHERE type = ? AND active = 1 ORDER BY sort_order ASC, value ASC", [type])
    return NextResponse.json(rows)
  }
  // All types grouped
  const rows = await query("SELECT id, type, value, sort_order FROM onboarding_options WHERE active = 1 ORDER BY type, sort_order ASC, value ASC") as any[]
  const grouped: Record<string, any[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }
  // Also return phone prefix
  const [prefix] = await query("SELECT value FROM settings WHERE key_name = 'phone_prefix'") as any[]
  grouped._phone_prefix = prefix?.value || ""
  return NextResponse.json(grouped)
}

// POST — add option
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()
  const { type, value } = await req.json()
  if (!type || !value?.trim()) return NextResponse.json({ error: "Typ und Wert erforderlich" }, { status: 400 })
  const maxOrder = await query("SELECT MAX(sort_order) as m FROM onboarding_options WHERE type = ?", [type]) as any[]
  await pool.execute("INSERT IGNORE INTO onboarding_options (type, value, sort_order) VALUES (?,?,?)",
    [type, value.trim(), (maxOrder[0]?.m || 0) + 1])
  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE — remove option
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await req.json()
  await query("UPDATE onboarding_options SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}

// PUT — update phone prefix or option
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  if (body.phone_prefix !== undefined) {
    await query("INSERT INTO settings (key_name, value) VALUES ('phone_prefix', ?) ON DUPLICATE KEY UPDATE value = ?",
      [body.phone_prefix, body.phone_prefix])
    return NextResponse.json({ success: true })
  }
  if (body.id && body.value) {
    await query("UPDATE onboarding_options SET value = ? WHERE id = ?", [body.value.trim(), body.id])
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: "Ungültig" }, { status: 400 })
}
