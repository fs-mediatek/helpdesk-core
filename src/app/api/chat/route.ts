import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ articles: [], suggestion: "ticket" })
  }

  const searchTerm = message.trim()
  let articles: any[] = []

  // Try FULLTEXT search first (index might not exist)
  try {
    articles = await query(
      `SELECT id, title, content_html
       FROM kb_articles
       WHERE status = 'published'
         AND MATCH(title, content_html) AGAINST(? IN BOOLEAN MODE)
       ORDER BY MATCH(title, content_html) AGAINST(? IN BOOLEAN MODE) DESC
       LIMIT 3`,
      [searchTerm, searchTerm]
    )
  } catch {
    // FULLTEXT index doesn't exist, ignore
  }

  // Fallback to LIKE search if FULLTEXT returned nothing
  if (articles.length === 0) {
    const likeTerm = `%${searchTerm}%`
    articles = await query(
      `SELECT id, title, content_html
       FROM kb_articles
       WHERE status = 'published'
         AND (title LIKE ? OR content_html LIKE ?)
       ORDER BY views DESC
       LIMIT 3`,
      [likeTerm, likeTerm]
    )
  }

  if (articles.length === 0) {
    return NextResponse.json({ articles: [], suggestion: "ticket" })
  }

  const results = articles.map((a: any) => ({
    id: a.id,
    title: a.title,
    snippet: stripHtml(a.content_html).slice(0, 200) + (stripHtml(a.content_html).length > 200 ? "..." : ""),
  }))

  return NextResponse.json({ articles: results })
}
