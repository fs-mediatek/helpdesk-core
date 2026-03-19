import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTables() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS order_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue',
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  await pool.execute(`CREATE TABLE IF NOT EXISTS order_category_steps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_order INT UNSIGNED NOT NULL DEFAULT 0,
    description TEXT,
    assigned_roles VARCHAR(500) DEFAULT NULL COMMENT 'comma-separated roles',
    action_type VARCHAR(50) DEFAULT 'none' COMMENT 'none|cost_entry|approval|asset_assign|access_code_gen|access_code_confirm',
    FOREIGN KEY (category_id) REFERENCES order_categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  // Extend orders table
  await pool.execute(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS category_id INT UNSIGNED DEFAULT NULL`).catch(() => {})
  await pool.execute(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_code VARCHAR(20) DEFAULT NULL`).catch(() => {})
  await pool.execute(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_asset_id INT UNSIGNED DEFAULT NULL`).catch(() => {})
  // Try adding columns without IF NOT EXISTS (MySQL compat)
  await pool.execute(`ALTER TABLE orders ADD COLUMN category_id INT UNSIGNED DEFAULT NULL`).catch(() => {})
  await pool.execute(`ALTER TABLE orders ADD COLUMN access_code VARCHAR(20) DEFAULT NULL`).catch(() => {})
  await pool.execute(`ALTER TABLE orders ADD COLUMN assigned_asset_id INT UNSIGNED DEFAULT NULL`).catch(() => {})
  // Add new step columns if table already existed
  await pool.execute(`ALTER TABLE order_category_steps ADD COLUMN assigned_roles VARCHAR(500) DEFAULT NULL`).catch(() => {})
  await pool.execute(`ALTER TABLE order_category_steps ADD COLUMN action_type VARCHAR(50) DEFAULT 'none'`).catch(() => {})
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTables()
  const categories = await query("SELECT * FROM order_categories WHERE active = 1 ORDER BY name")
  const steps = await query("SELECT * FROM order_category_steps ORDER BY category_id, step_order")
  const result = (categories as any[]).map(cat => ({
    ...cat,
    steps: (steps as any[]).filter(s => s.category_id === cat.id)
  }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTables()
  const { name, description, color, steps } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const [result] = await pool.execute(
    "INSERT INTO order_categories (name, description, color) VALUES (?,?,?)",
    [name.trim(), description || null, color || "blue"]
  ) as any
  const catId = result.insertId
  if (Array.isArray(steps)) {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (s.step_name?.trim()) {
        await pool.execute(
          "INSERT INTO order_category_steps (category_id, step_name, step_order, description, assigned_roles, action_type) VALUES (?,?,?,?,?,?)",
          [catId, s.step_name.trim(), i + 1, s.description || null, s.assigned_roles || null, s.action_type || "none"]
        )
      }
    }
  }
  return NextResponse.json({ id: catId }, { status: 201 })
}
