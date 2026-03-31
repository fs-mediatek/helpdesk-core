import { NextRequest, NextResponse } from "next/server"

export async function GET(_req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const isAdmin = roles.includes("admin")
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const keys = [
    "offboarding_default_checklist",
    "offboarding_email_subject",
    "offboarding_email_body",
  ]

  const rows = await query(
    `SELECT key_name, value FROM settings WHERE key_name IN (${keys.map(() => "?").join(",")})`,
    keys
  ) as any[]

  const config: Record<string, any> = {}
  for (const row of rows) {
    if (row.key_name === "offboarding_default_checklist") {
      try {
        config.default_checklist = JSON.parse(row.value)
      } catch {
        config.default_checklist = []
      }
    } else {
      config[row.key_name] = row.value
    }
  }

  // Ensure defaults
  if (!config.default_checklist) config.default_checklist = []
  if (!config.offboarding_email_subject) config.offboarding_email_subject = ""
  if (!config.offboarding_email_body) config.offboarding_email_body = ""

  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const isAdmin = roles.includes("admin")
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()

  // Update default checklist
  if (body.default_checklist !== undefined) {
    const value = JSON.stringify(body.default_checklist)
    await pool.execute(
      "INSERT INTO settings (key_name, value) VALUES ('offboarding_default_checklist', ?) ON DUPLICATE KEY UPDATE value = ?",
      [value, value]
    )
  }

  // Update email subject
  if (body.offboarding_email_subject !== undefined) {
    await pool.execute(
      "INSERT INTO settings (key_name, value) VALUES ('offboarding_email_subject', ?) ON DUPLICATE KEY UPDATE value = ?",
      [body.offboarding_email_subject, body.offboarding_email_subject]
    )
  }

  // Update email body
  if (body.offboarding_email_body !== undefined) {
    await pool.execute(
      "INSERT INTO settings (key_name, value) VALUES ('offboarding_email_body', ?) ON DUPLICATE KEY UPDATE value = ?",
      [body.offboarding_email_body, body.offboarding_email_body]
    )
  }

  return NextResponse.json({ success: true })
}
