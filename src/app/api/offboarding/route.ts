import { NextRequest, NextResponse } from "next/server"

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

async function ensureTable() {
  const { pool } = await import("@/lib/db")

  await pool.execute(`CREATE TABLE IF NOT EXISTS offboarding_device_returns (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id INT UNSIGNED NOT NULL,
    asset_id INT UNSIGNED DEFAULT NULL,
    device_name VARCHAR(200) NOT NULL,
    asset_tag VARCHAR(100) DEFAULT NULL,
    serial_number VARCHAR(100) DEFAULT NULL,
    status ENUM('pending','returned','missing','disposed') DEFAULT 'pending',
    condition_notes JSON DEFAULT NULL,
    return_date DATE DEFAULT NULL,
    received_by_id INT UNSIGNED DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request (request_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {})

  const cols: [string, string][] = [
    ["last_working_day", "DATE DEFAULT NULL"],
    ["exit_reason", "VARCHAR(200) DEFAULT NULL"],
    ["confirmation_sent_at", "TIMESTAMP NULL DEFAULT NULL"],
  ]
  for (const [col, def] of cols) {
    try {
      await pool.execute(`ALTER TABLE onboarding_requests ADD COLUMN ${col} ${def}`)
    } catch {
      // Column likely already exists
    }
  }
}

export async function GET(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const status = url.searchParams.get("status") || ""

  let sql = `SELECT r.*, u.name as employee_name_resolved, c.name as created_by_name
    FROM onboarding_requests r
    LEFT JOIN users u ON r.created_by_id = u.id
    LEFT JOIN users c ON r.created_by_id = c.id
    WHERE r.type = 'offboarding'`
  const params: any[] = []
  if (status) { sql += " AND r.status = ?"; params.push(status) }
  sql += " ORDER BY r.created_at DESC LIMIT 100"

  const requests = await query(sql, params)
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()
  const body = await req.json()
  const { user_id, last_working_day, exit_reason, notes } = body

  if (!user_id) return NextResponse.json({ error: "user_id erforderlich" }, { status: 400 })

  // Look up the user
  const [user] = await query("SELECT id, name, email, department FROM users WHERE id = ?", [user_id]) as any[]
  if (!user) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 })

  // Generate OFF-YYYY-NNNN number
  const year = new Date().getFullYear()
  const [countRow] = await query(
    "SELECT COUNT(*) as c FROM onboarding_requests WHERE type = 'offboarding' AND YEAR(created_at) = ?",
    [year]
  ) as any[]
  const num = ((countRow?.c || 0) + 1).toString().padStart(4, "0")
  const requestNumber = `OFF-${year}-${num}`

  // Insert into onboarding_requests with type='offboarding'
  const [result] = await pool.execute(
    `INSERT INTO onboarding_requests (type, employee_name, employee_email, department, notes, created_by_id, status, last_working_day, exit_reason)
     VALUES ('offboarding', ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      user.name,
      user.email || null,
      user.department || null,
      notes || null,
      session.userId,
      last_working_day || null,
      exit_reason || null,
    ]
  ) as any
  const requestId = result.insertId

  // Load default checklist from settings
  try {
    const [setting] = await query(
      "SELECT value FROM settings WHERE key_name = 'offboarding_default_checklist'",
      []
    ) as any[]
    if (setting?.value) {
      const items = JSON.parse(setting.value)
      if (Array.isArray(items)) {
        for (const item of items) {
          await pool.execute(
            "INSERT INTO onboarding_checklist (request_id, item) VALUES (?, ?)",
            [requestId, item]
          )
        }
      }
    }
  } catch {
    // No default checklist configured
  }

  // Auto-populate device returns from assets assigned to the user
  try {
    const assets = await query(
      "SELECT id, name, asset_tag, serial_number FROM assets WHERE assigned_to_user_id = ? AND (active = 1 OR active IS NULL)",
      [user_id]
    ) as any[]
    for (const asset of assets) {
      await pool.execute(
        `INSERT INTO offboarding_device_returns (request_id, asset_id, device_name, asset_tag, serial_number, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [
          requestId,
          asset.id,
          asset.name || "Unbekanntes Geraet",
          asset.asset_tag || null,
          asset.serial_number || null,
        ]
      )
    }
  } catch (err) {
    console.error("[Offboarding] Device return population error:", err)
  }

  // Create a linked ticket
  try {
    const ticketYear = new Date().getFullYear()
    await query(
      "INSERT INTO ticket_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = last_number + 1",
      [ticketYear]
    )
    const [counter] = await query("SELECT last_number FROM ticket_counters WHERE year = ?", [ticketYear]) as any[]
    const { generateTicketNumber } = await import("@/lib/numbering")
    const ticketNumber = await generateTicketNumber(ticketYear, (counter as any).last_number)
    const ticketTitle = `Offboarding: ${user.name}`
    const ticketDesc = `Offboarding-Prozess fuer ${user.name} (${requestNumber}) wurde gestartet.${user.department ? `\nAbteilung: ${user.department}` : ""}${last_working_day ? `\nLetzter Arbeitstag: ${last_working_day}` : ""}`

    const [ticketResult] = await pool.execute(
      "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, status) VALUES (?,?,?,?,?,?,'open')",
      [ticketNumber, ticketTitle, ticketDesc, "medium", "Offboarding", session.userId]
    ) as any
    const ticketId = ticketResult.insertId

    await query("UPDATE onboarding_requests SET ticket_id = ? WHERE id = ?", [ticketId, requestId]).catch(() => {})

    await pool.execute(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?,?,?,0,1)",
      [ticketId, session.userId, `Offboarding-Prozess ${requestNumber} fuer ${user.name} gestartet. Erstellt von ${session.name}.`]
    ).catch(() => {})
  } catch (err) {
    console.error("[Offboarding] Ticket creation error:", err)
  }

  // Fire template trigger for offboarding
  try {
    const { fireTemplateTrigger } = await import("@/lib/template-triggers")
    await fireTemplateTrigger("offboarding_started", {
      mitarbeiter_name: user.name,
      mitarbeiter_email: user.email,
      abteilung: user.department,
      austrittsdatum: last_working_day,
      datum: new Date().toLocaleDateString("de-DE"),
    })
  } catch {}

  return NextResponse.json({ success: true, id: requestId, number: requestNumber }, { status: 201 })
}
