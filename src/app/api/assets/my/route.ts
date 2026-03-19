import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const assets = await query(
    `SELECT a.id, a.name, a.asset_tag, a.type, a.platform, a.status,
            a.model, a.manufacturer, a.serial_number, a.notes,
            a.purchase_date, a.warranty_until, a.os_version,
            a.phone_number, a.imei, a.friendly_name, a.commissioned_at,
            a.primary_user_email,
            s.name as supplier_name
     FROM assets a
     LEFT JOIN suppliers s ON a.supplier_id = s.id
     WHERE a.assigned_to_user_id = ? AND (a.active = 1 OR a.active IS NULL)
     ORDER BY a.platform ASC, a.name ASC`,
    [session.userId]
  )
  return NextResponse.json(assets)
}
