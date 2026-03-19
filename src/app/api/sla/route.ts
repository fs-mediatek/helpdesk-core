import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTables() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS sla_rules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('ticket','order') NOT NULL DEFAULT 'ticket',
    match_category VARCHAR(100) DEFAULT NULL,
    match_department VARCHAR(100) DEFAULT NULL,
    match_priority VARCHAR(20) DEFAULT NULL,
    response_hours DECIMAL(8,1) DEFAULT NULL,
    resolution_hours DECIMAL(8,1) DEFAULT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})

  await pool.execute(`CREATE TABLE IF NOT EXISTS sla_escalation_levels (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sla_rule_id INT UNSIGNED NOT NULL,
    level INT NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    hours_after DECIMAL(8,1) NOT NULL,
    notify_roles VARCHAR(255) DEFAULT NULL,
    color VARCHAR(20) DEFAULT '#f59e0b',
    FOREIGN KEY (sla_rule_id) REFERENCES sla_rules(id) ON DELETE CASCADE
  )`).catch(() => {})

  // Add sla_rule_id to tickets and orders if not exists
  for (const table of ["tickets", "orders"]) {
    await pool.execute(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS sla_rule_id INT UNSIGNED DEFAULT NULL`).catch(() => {})
    await pool.execute(`ALTER TABLE ${table} ADD COLUMN sla_rule_id INT UNSIGNED DEFAULT NULL`).catch(() => {})
  }
  await pool.execute(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP NULL DEFAULT NULL`).catch(() => {})
  await pool.execute(`ALTER TABLE orders ADD COLUMN sla_due_at TIMESTAMP NULL DEFAULT NULL`).catch(() => {})
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTables()

  const type = new URL(req.url).searchParams.get("type") || ""

  let sql = "SELECT * FROM sla_rules WHERE 1=1"
  const params: any[] = []
  if (type) { sql += " AND type = ?"; params.push(type) }
  sql += " ORDER BY sort_order ASC, name ASC"

  const rules = await query(sql, params) as any[]

  // Load escalation levels for each rule
  if (rules.length > 0) {
    const ids = rules.map(r => r.id)
    const levels = await query(
      `SELECT * FROM sla_escalation_levels WHERE sla_rule_id IN (${ids.map(() => '?').join(',')}) ORDER BY hours_after ASC`,
      ids
    ) as any[]
    for (const rule of rules) {
      rule.levels = levels.filter(l => l.sla_rule_id === rule.id)
    }
  }

  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTables()

  const { name, type, match_category, match_department, match_priority,
          response_hours, resolution_hours, levels } = await req.json()

  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })

  const [result] = await pool.execute(
    `INSERT INTO sla_rules (name, type, match_category, match_department, match_priority, response_hours, resolution_hours)
     VALUES (?,?,?,?,?,?,?)`,
    [name.trim(), type || "ticket", match_category || null, match_department || null,
     match_priority || null, response_hours || null, resolution_hours || null]
  ) as any

  const ruleId = result.insertId

  // Insert escalation levels
  if (Array.isArray(levels)) {
    for (const lvl of levels) {
      await pool.execute(
        "INSERT INTO sla_escalation_levels (sla_rule_id, level, name, hours_after, notify_roles, color) VALUES (?,?,?,?,?,?)",
        [ruleId, lvl.level || 1, lvl.name || `Stufe ${lvl.level}`, lvl.hours_after || 0, lvl.notify_roles || null, lvl.color || "#f59e0b"]
      )
    }
  }

  return NextResponse.json({ id: ruleId }, { status: 201 })
}
