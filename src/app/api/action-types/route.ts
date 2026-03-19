import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

const BUILT_IN = [
  { key: "none", label: "Kein (manuell fortschreiten)", description: "Schritt wird manuell durch den Bearbeiter abgeschlossen.", icon: "▶️", is_system: 1 },
  { key: "cost_entry", label: "Kosteneingabe", description: "Bearbeiter trägt Gesamtkosten ein, bevor der Schritt abgeschlossen wird.", icon: "💰", is_system: 1 },
  { key: "approval", label: "Genehmigung", description: "Bearbeiter kann genehmigen oder ablehnen (mit Begründung).", icon: "✅", is_system: 1 },
  { key: "asset_assign", label: "Asset-Zuweisung", description: "Bearbeiter wählt ein Asset aus dem Bestand und weist es dem Antragsteller zu.", icon: "🖥️", is_system: 1 },
  { key: "access_code_gen", label: "Zugangscode generieren", description: "System generiert einen eindeutigen 6-stelligen Übergabecode.", icon: "🔑", is_system: 1 },
  { key: "access_code_confirm", label: "Zugangscode bestätigen", description: "IT gibt den vom Mitarbeiter genannten Code ein und bestätigt damit die Übergabe.", icon: "🔐", is_system: 1 },
]

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS workflow_action_types (
    \`key\` VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(20) DEFAULT '⚙️',
    is_system TINYINT(1) DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  for (const at of BUILT_IN) {
    await pool.execute(
      "INSERT IGNORE INTO workflow_action_types (`key`, label, description, icon, is_system) VALUES (?,?,?,?,?)",
      [at.key, at.label, at.description, at.icon, at.is_system]
    )
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const types = await query("SELECT * FROM workflow_action_types ORDER BY is_system DESC, FIELD(`key`,'none','cost_entry','approval','asset_assign','access_code_gen','access_code_confirm'), label ASC")
  return NextResponse.json(types)
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()
  const { key, label, description, icon } = await req.json()
  if (!key || !label?.trim()) return NextResponse.json({ error: "Key und Label erforderlich" }, { status: 400 })
  await query("UPDATE workflow_action_types SET label=?, description=?, icon=? WHERE `key`=?",
    [label.trim(), description || null, icon || "⚙️", key])
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()
  const { key, label, description, icon } = await req.json()
  if (!key?.trim() || !label?.trim()) return NextResponse.json({ error: "Key und Label erforderlich" }, { status: 400 })
  const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
  const existing = await query("SELECT `key` FROM workflow_action_types WHERE `key` = ?", [cleanKey]) as any[]
  if (existing.length > 0) return NextResponse.json({ error: "Key existiert bereits" }, { status: 409 })
  await pool.execute(
    "INSERT INTO workflow_action_types (`key`, label, description, icon, is_system) VALUES (?,?,?,?,0)",
    [cleanKey, label.trim(), description || null, icon || "⚙️"]
  )
  return NextResponse.json({ success: true, key: cleanKey }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { key } = await req.json()
  const [row] = await query("SELECT is_system FROM workflow_action_types WHERE `key` = ?", [key]) as any[]
  if (row?.is_system) return NextResponse.json({ error: "Systemaktionen können nicht gelöscht werden" }, { status: 400 })
  await query("DELETE FROM workflow_action_types WHERE `key` = ? AND is_system = 0", [key])
  return NextResponse.json({ success: true })
}
