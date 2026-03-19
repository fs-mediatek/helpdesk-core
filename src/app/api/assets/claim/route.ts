import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const devices = await query(
      `SELECT id, name, model, manufacturer, serial_number, asset_tag, platform, friendly_name, phone_number
       FROM assets
       WHERE primary_user_email = ? AND (assigned_to_user_id IS NULL OR assigned_to_user_id = 0) AND (active = 1 OR active IS NULL)`,
      [session.email]
    )
    return NextResponse.json(devices)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { asset_ids } = await req.json()
  if (!Array.isArray(asset_ids) || asset_ids.length === 0)
    return NextResponse.json({ error: "Keine Geräte angegeben" }, { status: 400 })
  for (const id of asset_ids) {
    await query(
      "UPDATE assets SET assigned_to_user_id=?, status='active' WHERE id=? AND primary_user_email=?",
      [session.userId, id, session.email]
    )
  }
  return NextResponse.json({ success: true, claimed: asset_ids.length })
}
