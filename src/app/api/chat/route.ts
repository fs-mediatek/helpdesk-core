import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { pool, query } from "@/lib/db"

// Ensure log table exists (runs once)
let logTableReady = false
async function ensureLogTable() {
  if (logTableReady) return
  await pool.execute(`CREATE TABLE IF NOT EXISTS chatbot_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    search_term VARCHAR(500) NOT NULL,
    has_results TINYINT(1) DEFAULT 0,
    matched_articles VARCHAR(500) DEFAULT '',
    matched_responses VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
  logTableReady = true
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ articles: [], customResponses: [], suggestion: "ticket" })
  }

  const searchTerm = message.trim().toLowerCase()

  // 1. Search custom responses (keyword matching)
  let customResponses: any[] = []
  try {
    const allResponses = await query(
      "SELECT id, keywords, title, answer, link FROM chatbot_responses WHERE active = 1 ORDER BY sort_order"
    ) as any[]

    const searchWords = searchTerm.split(/\s+/).filter((w: string) => w.length >= 3)
    customResponses = allResponses.filter((r: any) => {
      const keywords = r.keywords.toLowerCase().split(",").map((k: string) => k.trim())
      return keywords.some((kw: string) =>
        searchTerm.includes(kw) || kw.includes(searchTerm) ||
        searchWords.some((w: string) => kw.includes(w) || w.includes(kw))
      )
    }).slice(0, 3)
  } catch {
    // Table might not exist yet
  }

  // 2. Search KB articles
  let articles: any[] = []

  // Try FULLTEXT search first
  try {
    articles = await query(
      `SELECT id, title, content_html, tags
       FROM kb_articles
       WHERE status = 'published'
         AND (MATCH(title, content_html) AGAINST(? IN BOOLEAN MODE) OR tags LIKE ?)
       ORDER BY MATCH(title, content_html) AGAINST(? IN BOOLEAN MODE) DESC
       LIMIT 3`,
      [searchTerm, `%${searchTerm}%`, searchTerm]
    )
  } catch {
    // FULLTEXT index doesn't exist
  }

  // Fallback to LIKE search — split into words and match any
  if (articles.length === 0) {
    const words = searchTerm.split(/\s+/).filter((w: string) => w.length >= 3)
    if (words.length > 0) {
      const conditions = words.map(() => "(title LIKE ? OR content_html LIKE ? OR tags LIKE ?)").join(" OR ")
      const params = words.flatMap((w: string) => [`%${w}%`, `%${w}%`, `%${w}%`])
      articles = await query(
        `SELECT id, title, content_html
         FROM kb_articles
         WHERE status = 'published'
           AND (${conditions})
         ORDER BY views DESC
         LIMIT 3`,
        params
      )
    }
  }

  // Fallback: check if any published article title is contained in the search term
  if (articles.length === 0) {
    const allArticles = await query(
      "SELECT id, title, content_html, tags FROM kb_articles WHERE status = 'published'"
    ) as any[]
    articles = allArticles.filter((a: any) => {
      const t = a.title.toLowerCase()
      const tagStr = (a.tags || "").toLowerCase()
      return searchTerm.includes(t) || t.includes(searchTerm) ||
        tagStr.split(",").some((tag: string) => {
          const trimmed = tag.trim()
          return trimmed && (searchTerm.includes(trimmed) || trimmed.includes(searchTerm))
        })
    }).slice(0, 3)
  }

  const kbResults = articles.map((a: any) => ({
    id: a.id,
    title: a.title,
    snippet: stripHtml(a.content_html).slice(0, 200) + (stripHtml(a.content_html).length > 200 ? "..." : ""),
  }))

  // Log the query
  try {
    await ensureLogTable()
    const hasResults = customResponses.length > 0 || kbResults.length > 0
    await pool.execute(
      "INSERT INTO chatbot_logs (search_term, has_results, matched_articles, matched_responses) VALUES (?, ?, ?, ?)",
      [
        message.trim().slice(0, 500),
        hasResults ? 1 : 0,
        kbResults.map((a: any) => a.title).join(", ").slice(0, 500),
        customResponses.map((r: any) => r.title).join(", ").slice(0, 500),
      ]
    )
  } catch {}

  if (customResponses.length === 0 && kbResults.length === 0) {
    return NextResponse.json({ articles: [], customResponses: [], suggestion: "ticket" })
  }

  return NextResponse.json({ articles: kbResults, customResponses })
}
