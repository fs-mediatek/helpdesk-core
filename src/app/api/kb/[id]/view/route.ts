import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  await query("UPDATE kb_articles SET views = views + 1 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
