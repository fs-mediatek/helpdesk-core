import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const locations = await query("SELECT * FROM locations WHERE active = 1 ORDER BY sort_order, name")
  return NextResponse.json(locations)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, address, contact_name, contact_phone, contact_email, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const result = await query(
    "INSERT INTO locations (name, slug, address, contact_name, contact_phone, contact_email, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name.trim(), slug, address || null, contact_name || null, contact_phone || null, contact_email || null, notes || null]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
