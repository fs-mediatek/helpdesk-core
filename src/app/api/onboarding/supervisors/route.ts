import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

/**
 * Returns users who are Führungskraft for a given department.
 * Checks: personal role contains "fuehrungskraft" AND user.department matches
 * the requested department or any of its parent departments.
 * Also checks department default_roles for "fuehrungskraft".
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const department = new URL(req.url).searchParams.get("department") || ""

  // Get all departments to find the hierarchy
  const allDepts = await query("SELECT id, name, parent_id, default_roles FROM departments WHERE active = 1") as any[]

  // Find the target department and all its ancestors
  const relevantDeptNames = new Set<string>()
  if (department) {
    relevantDeptNames.add(department)
    // Walk up the parent chain
    let current = allDepts.find(d => d.name === department)
    while (current?.parent_id) {
      current = allDepts.find(d => d.id === current.parent_id)
      if (current) relevantDeptNames.add(current.name)
    }
  }

  // Find all users who are Führungskraft — either personally or via department role
  const users = await query(
    `SELECT u.id, u.name, u.email, u.role, u.department
     FROM users u WHERE u.active = 1`
  ) as any[]

  // Departments that grant fuehrungskraft role
  const fkDepts = new Set(
    allDepts.filter(d => d.default_roles?.split(",").map((r: string) => r.trim()).includes("fuehrungskraft")).map((d: any) => d.name)
  )

  const supervisors = users.filter(u => {
    // Has fuehrungskraft role personally?
    const personalRoles = (u.role || "").split(",").map((r: string) => r.trim())
    const hasFkPersonal = personalRoles.includes("fuehrungskraft")
    // Has fuehrungskraft via department?
    const hasFkDept = u.department && fkDepts.has(u.department)
    if (!hasFkPersonal && !hasFkDept) return false

    // If department filter is set, only return FKs from relevant departments
    if (department && relevantDeptNames.size > 0) {
      return u.department && relevantDeptNames.has(u.department)
    }
    return true
  }).map((u: any) => ({ id: u.id, name: u.name, department: u.department }))

  return NextResponse.json(supervisors)
}
