import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { type } = await req.json()
  if (type === "helpful") {
    await query("UPDATE kb_articles SET helpful_votes = helpful_votes + 1 WHERE id = ?", [id])
  } else {
    await query("UPDATE kb_articles SET unhelpful_votes = unhelpful_votes + 1 WHERE id = ?", [id])
  }
  return NextResponse.json({ success: true })
}
