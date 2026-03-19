import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

const BUILT_IN_ROLES = [
  { name: "admin", label: "Admin", color: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800", sort_order: 1 },
  { name: "agent", label: "Agent", color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800", sort_order: 2 },
  { name: "user", label: "Benutzer", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800", sort_order: 3 },
  { name: "disposition", label: "Disposition", color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800", sort_order: 4 },
  { name: "assistenz", label: "Assistenz", color: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800", sort_order: 5 },
  { name: "fuehrungskraft", label: "Führungskraft", color: "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800", sort_order: 6 },
]

async function ensureColumns() {
  const cols: [string, string][] = [
    ["label", "VARCHAR(100) DEFAULT NULL"],
    ["color", "VARCHAR(150) DEFAULT NULL"],
    ["is_builtin", "TINYINT(1) DEFAULT 0"],
    ["sort_order", "INT DEFAULT 100"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE roles ADD COLUMN ${col} ${def}`).catch(() => {})
  }
  // Seed built-in roles
  for (const r of BUILT_IN_ROLES) {
    await pool.execute(
      "INSERT IGNORE INTO roles (name, label, color, is_builtin, sort_order) VALUES (?,?,?,1,?)",
      [r.name, r.label, r.color, r.sort_order]
    ).catch(() => {})
    // Update label/color for existing built-in roles that have NULL label
    await query("UPDATE roles SET label=IFNULL(label,?), color=IFNULL(color,?), is_builtin=1, sort_order=LEAST(IFNULL(sort_order,?),?) WHERE name=?",
      [r.label, r.color, r.sort_order, r.sort_order, r.name]).catch(() => {})
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await ensureColumns()
    const roles = await query("SELECT name as key_name, IFNULL(label, name) as label, color, IFNULL(is_builtin,0) as is_builtin, IFNULL(sort_order,100) as sort_order FROM roles ORDER BY sort_order ASC, name ASC")
    return NextResponse.json(roles)
  } catch (err: any) {
    console.error("[Roles GET Error]", err)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureColumns()

  const { key_name, label, color } = await req.json()
  if (!key_name?.trim() || !label?.trim())
    return NextResponse.json({ error: "Key und Label erforderlich" }, { status: 400 })

  const key = key_name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_")
  if (key.length < 2) return NextResponse.json({ error: "Key zu kurz" }, { status: 400 })

  const existing = await query("SELECT id FROM roles WHERE name = ?", [key]) as any[]
  if (existing.length > 0) return NextResponse.json({ error: "Rolle existiert bereits" }, { status: 409 })

  const maxOrder = await query("SELECT MAX(sort_order) as m FROM roles") as any[]
  const nextOrder = (maxOrder[0]?.m || 10) + 1

  await pool.execute(
    "INSERT INTO roles (name, label, color, is_builtin, sort_order) VALUES (?,?,?,0,?)",
    [key, label.trim(), color || "bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800", nextOrder]
  )
  return NextResponse.json({ success: true, key_name: key }, { status: 201 })
}
