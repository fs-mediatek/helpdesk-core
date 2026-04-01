import { NextRequest, NextResponse } from "next/server"

async function ensureTable() {
  const { pool } = await import("@/lib/db")

  await pool.execute(`CREATE TABLE IF NOT EXISTS workflow_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category ENUM('order','onboarding','offboarding','general') DEFAULT 'general',
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})

  await pool.execute(`CREATE TABLE IF NOT EXISTS workflow_template_steps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id INT UNSIGNED NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    step_order INT NOT NULL DEFAULT 1,
    description TEXT,
    assigned_roles VARCHAR(500) DEFAULT NULL,
    action_type VARCHAR(50) DEFAULT 'none',
    INDEX idx_template (template_id)
  )`).catch(() => {})
}

// GET — list all templates with step count, optional ?category= filter
export async function GET(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureTable()

  const category = new URL(req.url).searchParams.get("category")

  let sql = `
    SELECT t.*, COUNT(s.id) as step_count
    FROM workflow_templates t
    LEFT JOIN workflow_template_steps s ON s.template_id = t.id
    WHERE t.active = 1
  `
  const params: any[] = []

  if (category) {
    sql += " AND t.category = ?"
    params.push(category)
  }

  sql += " GROUP BY t.id ORDER BY t.created_at DESC"

  const templates = await query(sql, params)
  return NextResponse.json(templates)
}

// POST — create template with steps
export async function POST(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()

  const { name, description, category, steps } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  }

  const validCategories = ["order", "onboarding", "offboarding", "general"]
  const cat = validCategories.includes(category) ? category : "general"

  const [result] = await pool.execute(
    "INSERT INTO workflow_templates (name, description, category) VALUES (?,?,?)",
    [name.trim(), description || null, cat]
  ) as any[]

  const templateId = result.insertId

  if (Array.isArray(steps) && steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      await pool.execute(
        "INSERT INTO workflow_template_steps (template_id, step_name, step_order, description, assigned_roles, action_type) VALUES (?,?,?,?,?,?)",
        [templateId, s.step_name || "", i + 1, s.description || null, s.assigned_roles || null, s.action_type || "none"]
      )
    }
  }

  return NextResponse.json({ success: true, id: templateId }, { status: 201 })
}
