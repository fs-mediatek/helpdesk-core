import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await query("SELECT key_name, value FROM settings") as any[]
  const settings: Record<string, string> = {}
  rows.forEach(r => { settings[r.key_name] = r.value })
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  for (const [key, value] of Object.entries(body)) {
    await query("INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?", [key, value, value])
  }
  return NextResponse.json({ success: true })
}
