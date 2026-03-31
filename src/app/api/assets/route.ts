import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureColumns() {
  const cols: [string, string][] = [
    ["platform", "VARCHAR(20) NOT NULL DEFAULT 'other'"],
    ["active", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["manufacturer", "VARCHAR(100) DEFAULT NULL"],
    ["purchase_price", "DECIMAL(10,2) DEFAULT NULL"],
    ["commissioned_at", "DATE DEFAULT NULL"],
    ["primary_user_email", "VARCHAR(255) DEFAULT NULL"],
    ["os_version", "VARCHAR(100) DEFAULT NULL"],
    ["intune_device_id", "VARCHAR(100) DEFAULT NULL"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE assets ADD COLUMN ${col} ${def}`).catch(() => {})
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureColumns()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const platform = searchParams.get("platform") || ""

  let sql = `SELECT a.id, a.name, a.asset_tag, a.type, a.platform, a.status,
                    a.model, a.manufacturer, a.serial_number, a.notes,
                    a.assigned_to_user_id, a.purchase_price as price, a.purchase_price,
                    a.supplier_id, a.invoice_number, a.commissioned_at,
                    a.primary_user_email, a.os_version, a.intune_device_id,
                    a.purchase_date, a.warranty_until, a.phone_number,
                    u.name as assigned_to_name,
                    s.name as supplier_name,
                    mc.pin as sim_pin, mc.puk as sim_puk
             FROM assets a
             LEFT JOIN users u ON a.assigned_to_user_id = u.id
             LEFT JOIN suppliers s ON a.supplier_id = s.id
             LEFT JOIN mobile_contracts mc ON a.phone_number IS NOT NULL
               AND a.phone_number != ''
               AND REPLACE(REPLACE(REPLACE(REPLACE(mc.phone_number,' ',''),'/',''),'-',''),'+49','0')
                 = REPLACE(REPLACE(REPLACE(REPLACE(a.phone_number,' ',''),'/',''),'-',''),'+49','0')
             WHERE (a.active = 1 OR a.active IS NULL)`
  const params: any[] = []
  if (search) {
    sql += " AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.model LIKE ? OR a.manufacturer LIKE ? OR u.name LIKE ? OR a.serial_number LIKE ?)"
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (platform) {
    sql += " AND a.platform = ?"
    params.push(platform)
  }
  sql += " ORDER BY a.name ASC LIMIT 500"
  const assets = await query(sql, params)
  return NextResponse.json(assets)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  if (!roles.some(r => ["admin", "agent"].includes(r)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureColumns()
  const { name, asset_tag, type, platform, status, model, manufacturer, serial_number, notes,
          purchase_price, supplier_id, invoice_number, commissioned_at } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const tag = asset_tag?.trim() || `AST-${Date.now()}`
  const [result] = await pool.execute(
    `INSERT INTO assets (asset_tag, name, type, platform, status, model, manufacturer, serial_number, notes,
     purchase_price, supplier_id, invoice_number, commissioned_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [tag, name.trim(), type || "other", platform || "other", status || "available",
     model || null, manufacturer || null, serial_number || null, notes || null,
     purchase_price || null, supplier_id || null, invoice_number || null, commissioned_at || null]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
