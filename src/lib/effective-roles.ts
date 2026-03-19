import { query } from "@/lib/db"

/**
 * Returns the effective roles for a user: personal roles + department default_roles (merged, deduplicated).
 */
export async function getEffectiveRoles(userId: number): Promise<string> {
  try {
    const [user] = await query("SELECT role, department FROM users WHERE id = ?", [userId]) as any[]
    if (!user) return "user"

    const personalRoles = (user.role || "user").split(",").map((r: string) => r.trim()).filter(Boolean)

    if (!user.department) return personalRoles.join(",")

    // Find department and all parent departments, collect their default_roles
    const depts = await query("SELECT id, name, parent_id, default_roles FROM departments WHERE active = 1") as any[]
    const deptByName: Record<string, any> = {}
    const deptById: Record<number, any> = {}
    for (const d of depts) {
      deptByName[d.name] = d
      deptById[d.id] = d
    }

    const collectedRoles = new Set(personalRoles)

    // Find the user's department
    const userDept = deptByName[user.department]
    if (userDept) {
      // Collect roles from this department and all ancestors
      let current = userDept
      while (current) {
        if (current.default_roles) {
          current.default_roles.split(",").map((r: string) => r.trim()).filter(Boolean).forEach((r: string) => collectedRoles.add(r))
        }
        current = current.parent_id ? deptById[current.parent_id] : null
      }
    }

    return Array.from(collectedRoles).join(",")
  } catch {
    return "user"
  }
}
