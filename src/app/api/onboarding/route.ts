import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureColumns() {
  const cols: [string, string][] = [
    ["employee_number", "VARCHAR(50) DEFAULT NULL"],
    ["first_name", "VARCHAR(100) DEFAULT NULL"],
    ["last_name", "VARCHAR(100) DEFAULT NULL"],
    ["birth_date", "DATE DEFAULT NULL"],
    ["onboarding_status", "VARCHAR(100) DEFAULT NULL"],
    ["hire_date", "DATE DEFAULT NULL"],
    ["timecard_date", "DATE DEFAULT NULL"],
    ["contract_end_date", "DATE DEFAULT NULL"],
    ["weekly_hours", "VARCHAR(100) DEFAULT NULL"],
    ["break_times", "VARCHAR(255) DEFAULT NULL"],
    ["vacation_current", "VARCHAR(50) DEFAULT NULL"],
    ["vacation_full", "VARCHAR(50) DEFAULT NULL"],
    ["location_id", "INT UNSIGNED DEFAULT NULL"],
    ["room_number", "VARCHAR(50) DEFAULT NULL"],
    ["phone_extension", "VARCHAR(20) DEFAULT NULL"],
    ["supervisor_id", "INT UNSIGNED DEFAULT NULL"],
    ["cost_center", "VARCHAR(100) DEFAULT NULL"],
    ["project", "VARCHAR(200) DEFAULT NULL"],
    ["folders_open", "TEXT DEFAULT NULL"],
    ["folders_close", "TEXT DEFAULT NULL"],
    ["project_email", "VARCHAR(200) DEFAULT NULL"],
    ["job_title", "VARCHAR(200) DEFAULT NULL"],
    ["access_stepnova", "TINYINT(1) DEFAULT 0"],
    ["stepnova_assignment", "VARCHAR(255) DEFAULT NULL"],
    ["access_datev", "TINYINT(1) DEFAULT 0"],
    ["access_elo", "TINYINT(1) DEFAULT 0"],
    ["elo_client", "VARCHAR(50) DEFAULT NULL"],
    ["facility_notes", "TEXT DEFAULT NULL"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE onboarding_requests ADD COLUMN ${col} ${def}`).catch(() => {})
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const type = new URL(req.url).searchParams.get("type") || ""
  const status = new URL(req.url).searchParams.get("status") || ""

  let sql = `SELECT r.*, u.name as assigned_to_name, c.name as created_by_name
    FROM onboarding_requests r
    LEFT JOIN users u ON r.assigned_to_id = u.id
    LEFT JOIN users c ON r.created_by_id = c.id
    WHERE 1=1`
  const params: any[] = []
  if (type) { sql += " AND r.type = ?"; params.push(type) }
  if (status) { sql += " AND r.status = ?"; params.push(status) }
  sql += " ORDER BY r.created_at DESC LIMIT 100"
  const requests = await query(sql, params)
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureColumns()
  const body = await req.json()
  const { type = "onboarding" } = body
  const firstName = body.first_name?.trim() || ""
  const lastName = body.last_name?.trim() || ""
  const employeeName = body.employee_name?.trim() || `${firstName} ${lastName}`.trim()
  if (!employeeName) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })

  const year = new Date().getFullYear()
  const prefix = type === "onboarding" ? "ONB" : "OFF"
  const [countRow] = await query("SELECT COUNT(*) as c FROM onboarding_requests WHERE type = ? AND YEAR(created_at) = ?", [type, year]) as any[]
  const num = ((countRow?.c || 0) + 1).toString().padStart(4, "0")
  const requestNumber = `${prefix}-${year}-${num}`

  const fields = [
    "request_number", "type", "employee_name", "employee_email", "department", "start_date", "end_date", "notes",
    "created_by_id", "requested_by", "status", "current_step",
    "employee_number", "first_name", "last_name", "birth_date", "onboarding_status",
    "hire_date", "timecard_date", "contract_end_date", "weekly_hours", "break_times",
    "vacation_current", "vacation_full", "location_id", "room_number", "phone_extension",
    "supervisor_id", "cost_center", "project", "folders_open", "folders_close",
    "project_email", "job_title", "access_stepnova", "stepnova_assignment",
    "access_datev", "access_elo", "elo_client", "facility_notes",
  ]
  const values = [
    requestNumber, type, employeeName, body.employee_email || null, body.department || null,
    body.start_date || body.hire_date || new Date(), body.end_date || null, body.notes || null,
    session.userId, session.userId, "pending", 1,
    body.employee_number || null, firstName || null, lastName || null, body.birth_date || null, body.onboarding_status || null,
    body.hire_date || null, body.timecard_date || null, body.contract_end_date || null,
    body.weekly_hours || null, body.break_times || null,
    body.vacation_current || null, body.vacation_full || null,
    body.location_id || null, body.room_number || null, body.phone_extension || null,
    body.supervisor_id || null, body.cost_center || null, body.project || null,
    body.folders_open ? JSON.stringify(body.folders_open) : null,
    body.folders_close ? JSON.stringify(body.folders_close) : null,
    body.project_email || null, body.job_title || null,
    body.access_stepnova ? 1 : 0, body.stepnova_assignment || null,
    body.access_datev ? 1 : 0, body.access_elo ? 1 : 0, body.elo_client || null, body.facility_notes || null,
  ]

  const [result] = await pool.execute(
    `INSERT INTO onboarding_requests (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`,
    values
  ) as any
  const requestId = result.insertId

  // Copy workflow steps into progress
  const steps = await query(
    "SELECT step_order, step_name, assigned_roles FROM onboarding_workflow_steps WHERE type = ? ORDER BY step_order ASC",
    [type]
  ) as any[]

  if (steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      await pool.execute(
        "INSERT INTO onboarding_step_progress (request_id, step_order, step_name, status) VALUES (?,?,?,?)",
        [requestId, steps[i].step_order, steps[i].step_name, i === 0 ? "active" : "pending"]
      )
    }
  }

  // Also seed checklist from onboarding_config if exists
  try {
    const [config] = await query("SELECT default_checklist FROM onboarding_config WHERE type = ? LIMIT 1", [type]) as any[]
    if (config?.default_checklist) {
      const items = JSON.parse(config.default_checklist)
      for (const item of items) {
        await pool.execute("INSERT INTO onboarding_checklist (request_id, item) VALUES (?,?)", [requestId, item])
      }
    }
  } catch {}

  // Create a linked ticket
  try {
    const ticketYear = new Date().getFullYear()
    await query("INSERT INTO ticket_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = last_number + 1", [ticketYear])
    const [counter] = await query("SELECT last_number FROM ticket_counters WHERE year = ?", [ticketYear]) as any[]
    const { generateTicketNumber } = await import("@/lib/numbering")
    const ticketNumber = await generateTicketNumber(ticketYear, (counter as any).last_number)
    const typeLabel = type === "onboarding" ? "Onboarding" : "Offboarding"
    const ticketTitle = `${typeLabel}: ${employeeName}`
    const ticketDesc = `${typeLabel}-Prozess für ${employeeName} (${requestNumber}) wurde gestartet.${body.department ? `\nAbteilung: ${body.department}` : ""}${body.hire_date ? `\nStartdatum: ${body.hire_date}` : ""}`

    const [ticketResult] = await pool.execute(
      "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, status) VALUES (?,?,?,?,?,?,'open')",
      [ticketNumber, ticketTitle, ticketDesc, "medium", typeLabel, session.userId]
    ) as any
    const ticketId = ticketResult.insertId

    // Link ticket to onboarding request
    await query("UPDATE onboarding_requests SET ticket_id = ? WHERE id = ?", [ticketId, requestId]).catch(() => {})

    // Create system comment on the ticket for notification visibility
    await pool.execute(
      "ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_system TINYINT(1) DEFAULT 0"
    ).catch(() => {})
    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [ticketId, session.userId, `${typeLabel}-Prozess ${requestNumber} für ${employeeName} gestartet. Erstellt von ${session.name}.`]
    ).catch(() => {})
  } catch (err) {
    console.error("[Onboarding] Ticket creation error:", err)
  }

  return NextResponse.json({ id: requestId }, { status: 201 })
}
