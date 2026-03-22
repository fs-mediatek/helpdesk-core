import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS chatbot_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    search_term VARCHAR(500) NOT NULL,
    has_results TINYINT(1) DEFAULT 0,
    matched_articles VARCHAR(500) DEFAULT '',
    matched_responses VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get("filter") // "all" | "no_results" | "with_results"
  const limit = parseInt(searchParams.get("limit") || "100")

  let where = "WHERE 1=1"
  if (filter === "no_results") where += " AND has_results = 0"
  if (filter === "with_results") where += " AND has_results = 1"

  const safeLimit = Math.min(Math.max(parseInt(String(limit)) || 100, 1), 500)
  const logs = await query(
    `SELECT * FROM chatbot_logs ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`
  )

  // Stats
  const [stats] = await query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN has_results = 0 THEN 1 ELSE 0 END) as no_results,
      SUM(CASE WHEN has_results = 1 THEN 1 ELSE 0 END) as with_results
    FROM chatbot_logs
  `) as any[]

  // Top unanswered queries (grouped)
  const topUnanswered = await query(`
    SELECT search_term, COUNT(*) as count
    FROM chatbot_logs
    WHERE has_results = 0
    GROUP BY search_term
    ORDER BY count DESC
    LIMIT 20
  `)

  // Top answered queries
  const topAnswered = await query(`
    SELECT search_term, COUNT(*) as count, MAX(matched_articles) as matched_articles
    FROM chatbot_logs
    WHERE has_results = 1
    GROUP BY search_term
    ORDER BY count DESC
    LIMIT 10
  `)

  return NextResponse.json({
    logs,
    stats: stats || { total: 0, no_results: 0, with_results: 0 },
    topUnanswered,
    topAnswered,
  })
}

// DELETE — clear logs
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await ensureTable()
  await pool.execute("DELETE FROM chatbot_logs")
  return NextResponse.json({ success: true })
}
