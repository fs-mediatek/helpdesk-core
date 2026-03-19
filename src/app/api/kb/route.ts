import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")
  let sql = "SELECT id, title, slug, status, views, helpful_votes, created_at FROM kb_articles WHERE 1=1"
  const params: any[] = []
  if (search) { sql += " AND title LIKE ?"; params.push(`%${search}%`) }
  sql += " ORDER BY views DESC LIMIT 50"
  const articles = await query(sql, params)
  return NextResponse.json(articles)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { title, content, status } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: "Titel erforderlich" }, { status: 400 })
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now()
  const [result] = await pool.execute(
    "INSERT INTO kb_articles (title, slug, content_html, status, author_id) VALUES (?, ?, ?, ?, ?)",
    [title.trim(), slug, content || "", status || "draft", session.userId]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
