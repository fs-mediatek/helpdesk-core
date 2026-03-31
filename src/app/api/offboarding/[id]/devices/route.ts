import { NextRequest, NextResponse } from "next/server"

type Ctx = { params: Promise<{ id: string }> }

async function getUserDepartment(userId: number): Promise<string | null> {
  const { query } = await import("@/lib/db")
  const rows = await query("SELECT department FROM users WHERE id = ?", [userId]) as any[]
  return rows[0]?.department || null
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const devices = await query(
    `SELECT d.*, u.name as received_by_name
     FROM offboarding_device_returns d
     LEFT JOIN users u ON d.received_by_id = u.id
     WHERE d.request_id = ?
     ORDER BY d.id ASC`,
    [id]
  )

  return NextResponse.json(devices)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { getSession } = await import("@/lib/auth")
  const { query, pool } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roles = session.role.split(",").map((r: string) => r.trim())
  const userDept = await getUserDepartment(session.userId)
  const allowed = roles.some((r: string) => ["admin", "agent"].includes(r)) || userDept === "HR"
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const {
    device_id,
    status,
    condition_housing,
    condition_display,
    condition_keyboard,
    condition_charger,
    condition_accessories,
    notes,
  } = body

  if (!device_id) return NextResponse.json({ error: "device_id erforderlich" }, { status: 400 })

  // Verify the device belongs to this request
  const [device] = await query(
    "SELECT * FROM offboarding_device_returns WHERE id = ? AND request_id = ?",
    [device_id, id]
  ) as any[]
  if (!device) return NextResponse.json({ error: "Geraet nicht gefunden" }, { status: 404 })

  const validStatuses = ["pending", "returned", "missing", "disposed"]
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Ungueltiger Status" }, { status: 400 })
  }

  // Build condition JSON
  const validConditions = ["ok", "scratched", "damaged", "missing"]
  const conditionData: Record<string, string> = {}
  if (condition_housing && validConditions.includes(condition_housing)) conditionData.housing = condition_housing
  if (condition_display && validConditions.includes(condition_display)) conditionData.display = condition_display
  if (condition_keyboard && validConditions.includes(condition_keyboard)) conditionData.keyboard = condition_keyboard
  if (condition_charger && validConditions.includes(condition_charger)) conditionData.charger = condition_charger
  if (condition_accessories && validConditions.includes(condition_accessories)) conditionData.accessories = condition_accessories

  const conditionJson = Object.keys(conditionData).length > 0 ? JSON.stringify(conditionData) : device.condition_notes

  // Update device return record
  await pool.execute(
    `UPDATE offboarding_device_returns
     SET status = ?, condition_notes = ?, return_date = ?, received_by_id = ?
     WHERE id = ? AND request_id = ?`,
    [
      status || device.status,
      conditionJson,
      status === "returned" ? new Date().toISOString().split("T")[0] : device.return_date,
      status === "returned" ? session.userId : device.received_by_id,
      device_id,
      id,
    ]
  )

  // If status is 'returned', update the asset to available
  if (status === "returned" && device.asset_id) {
    await pool.execute(
      "UPDATE assets SET assigned_to_user_id = NULL, status = 'available' WHERE id = ?",
      [device.asset_id]
    )
  }

  // Store notes if provided
  if (notes !== undefined) {
    const fullCondition = conditionJson ? JSON.parse(conditionJson) : {}
    fullCondition.notes = notes
    await pool.execute(
      "UPDATE offboarding_device_returns SET condition_notes = ? WHERE id = ?",
      [JSON.stringify(fullCondition), device_id]
    )
  }

  return NextResponse.json({ success: true })
}
