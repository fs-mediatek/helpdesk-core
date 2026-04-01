import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS onboarding_workflow_steps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type ENUM('onboarding','offboarding') NOT NULL DEFAULT 'onboarding',
    step_order INT NOT NULL DEFAULT 1,
    step_name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT NULL,
    assigned_roles VARCHAR(500) DEFAULT NULL,
    is_checkpoint TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})

  // Add progress tracking columns to onboarding_requests
  await pool.execute("ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS current_step INT DEFAULT 1").catch(() => {})
  await pool.execute("ALTER TABLE onboarding_requests ADD COLUMN current_step INT DEFAULT 1").catch(() => {})
  await pool.execute("ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(20) DEFAULT 'onboarding'").catch(() => {})
  await pool.execute("ALTER TABLE onboarding_requests ADD COLUMN workflow_type VARCHAR(20) DEFAULT 'onboarding'").catch(() => {})

  // Step progress table
  await pool.execute(`CREATE TABLE IF NOT EXISTS onboarding_step_progress (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id INT UNSIGNED NOT NULL,
    step_order INT NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    status ENUM('pending','active','completed','skipped') DEFAULT 'pending',
    completed_at TIMESTAMP NULL DEFAULT NULL,
    completed_by INT UNSIGNED DEFAULT NULL,
    notes TEXT DEFAULT NULL
  )`).catch(() => {})

  // Add action_type columns
  try { await pool.execute("ALTER TABLE onboarding_workflow_steps ADD COLUMN action_type VARCHAR(50) DEFAULT 'none'") } catch {}
  try { await pool.execute("ALTER TABLE onboarding_step_progress ADD COLUMN action_type VARCHAR(50) DEFAULT 'none'") } catch {}
}

// GET — list workflow steps by type
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const type = new URL(req.url).searchParams.get("type") || "onboarding"
  const steps = await query(
    "SELECT * FROM onboarding_workflow_steps WHERE type = ? ORDER BY step_order ASC",
    [type]
  )
  return NextResponse.json(steps)
}

// POST — save all steps for a type (replace all)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()
  const { type, steps } = await req.json()
  if (!type || !Array.isArray(steps)) return NextResponse.json({ error: "type und steps erforderlich" }, { status: 400 })

  // Replace all steps for this type
  await query("DELETE FROM onboarding_workflow_steps WHERE type = ?", [type])
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    await pool.execute(
      "INSERT INTO onboarding_workflow_steps (type, step_order, step_name, description, assigned_roles, is_checkpoint, action_type) VALUES (?,?,?,?,?,?,?)",
      [type, i + 1, s.step_name, s.description || null, s.assigned_roles || null, s.is_checkpoint ? 1 : 0, s.action_type || "none"]
    )
  }
  return NextResponse.json({ success: true, count: steps.length })
}
