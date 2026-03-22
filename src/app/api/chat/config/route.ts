import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { pool, query } from "@/lib/db"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS chatbot_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(50) NOT NULL UNIQUE,
    config_value TEXT
  )`)
  await pool.execute(`CREATE TABLE IF NOT EXISTS chatbot_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keywords VARCHAR(500) NOT NULL,
    title VARCHAR(200) NOT NULL,
    answer TEXT NOT NULL,
    link VARCHAR(500) DEFAULT NULL,
    sort_order INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
}

// GET — load config + responses
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureTable()

  const configRows = await query("SELECT config_key, config_value FROM chatbot_config") as any[]
  const config: Record<string, string> = {}
  for (const row of configRows) {
    config[row.config_key] = row.config_value
  }

  const responses = await query("SELECT * FROM chatbot_responses ORDER BY sort_order, id")

  return NextResponse.json({
    greeting: config.greeting || "",
    fallback: config.fallback || "",
    responses,
  })
}

// PUT — save config + responses (admin only)
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()

  const { greeting, fallback, responses } = await req.json()

  // Save config
  for (const [key, value] of Object.entries({ greeting, fallback })) {
    if (value !== undefined) {
      await pool.execute(
        `INSERT INTO chatbot_config (config_key, config_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [key, value || ""]
      )
    }
  }

  // Save responses — delete all, re-insert
  if (Array.isArray(responses)) {
    await pool.execute("DELETE FROM chatbot_responses")
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i]
      if (!r.keywords?.trim() || !r.answer?.trim()) continue
      await pool.execute(
        `INSERT INTO chatbot_responses (keywords, title, answer, link, sort_order, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.keywords, r.title || r.keywords, r.answer, r.link || null, i, r.active !== false ? 1 : 0]
      )
    }
  }

  return NextResponse.json({ success: true })
}
