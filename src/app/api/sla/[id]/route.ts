import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const { name, type, match_category, match_department, match_priority,
          response_hours, resolution_hours, active, levels } = await req.json()

  await query(
    `UPDATE sla_rules SET name=?, type=?, match_category=?, match_department=?, match_priority=?,
     response_hours=?, resolution_hours=?, active=? WHERE id=?`,
    [name, type || "ticket", match_category || null, match_department || null,
     match_priority || null, response_hours || null, resolution_hours || null,
     active !== undefined ? (active ? 1 : 0) : 1, id]
  )

  // Replace escalation levels
  if (Array.isArray(levels)) {
    await query("DELETE FROM sla_escalation_levels WHERE sla_rule_id = ?", [id])
    for (const lvl of levels) {
      await pool.execute(
        "INSERT INTO sla_escalation_levels (sla_rule_id, level, name, hours_after, notify_roles, color) VALUES (?,?,?,?,?,?)",
        [id, lvl.level || 1, lvl.name || `Stufe ${lvl.level}`, lvl.hours_after || 0, lvl.notify_roles || null, lvl.color || "#f59e0b"]
      )
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await query("DELETE FROM sla_rules WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
