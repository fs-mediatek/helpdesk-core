import { NextRequest, NextResponse } from "next/server"

type Ctx = { params: Promise<{ id: string }> }

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

// GET — template detail with all steps
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureTable()

  const { id } = await params

  const [template] = await query(
    "SELECT * FROM workflow_templates WHERE id = ? AND active = 1",
    [id]
  ) as any[]

  if (!template) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  const steps = await query(
    "SELECT * FROM workflow_template_steps WHERE template_id = ? ORDER BY step_order ASC",
    [id]
  )

  return NextResponse.json({ ...template, steps })
}

// PUT — update template and replace all steps
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()

  const { id } = await params
  const { name, description, category, steps } = await req.json()

  // Verify template exists
  const [existing] = await query("SELECT id FROM workflow_templates WHERE id = ? AND active = 1", [id]) as any[]
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  // Update template fields
  const updates: string[] = []
  const vals: any[] = []

  if (name !== undefined) {
    updates.push("name = ?")
    vals.push(name.trim())
  }
  if (description !== undefined) {
    updates.push("description = ?")
    vals.push(description || null)
  }
  if (category !== undefined) {
    const validCategories = ["order", "onboarding", "offboarding", "general"]
    if (validCategories.includes(category)) {
      updates.push("category = ?")
      vals.push(category)
    }
  }

  if (updates.length > 0) {
    await pool.execute(
      `UPDATE workflow_templates SET ${updates.join(", ")} WHERE id = ?`,
      [...vals, id]
    )
  }

  // Replace all steps if provided
  if (Array.isArray(steps)) {
    await pool.execute("DELETE FROM workflow_template_steps WHERE template_id = ?", [id])
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      await pool.execute(
        "INSERT INTO workflow_template_steps (template_id, step_name, step_order, description, assigned_roles, action_type) VALUES (?,?,?,?,?,?)",
        [id, s.step_name || "", i + 1, s.description || null, s.assigned_roles || null, s.action_type || "none"]
      )
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE — soft-delete (active=0)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()

  const { id } = await params

  const [existing] = await query("SELECT id FROM workflow_templates WHERE id = ?", [id]) as any[]
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 })

  await pool.execute("UPDATE workflow_templates SET active = 0 WHERE id = ?", [id])

  return NextResponse.json({ success: true })
}
