import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const suppliers = await query("SELECT * FROM suppliers WHERE active = 1 ORDER BY name")
  return NextResponse.json(suppliers)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, contact_name, contact_email, contact_phone, website, address, customer_number, notes } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const [result] = await pool.execute(
    "INSERT INTO suppliers (name, contact_name, contact_email, contact_phone, website, address, customer_number, notes) VALUES (?,?,?,?,?,?,?,?)",
    [name.trim(), contact_name||null, contact_email||null, contact_phone||null, website||null, address||null, customer_number||null, notes||null]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
