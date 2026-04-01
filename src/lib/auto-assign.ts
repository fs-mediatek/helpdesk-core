// Auto-assign logic for new tickets

async function ensureTable() {
  const { pool } = await import("@/lib/db")
  await pool.execute(`CREATE TABLE IF NOT EXISTS auto_assign_rules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    assign_to_user_id INT UNSIGNED NOT NULL,
    priority INT DEFAULT 100,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})
}

let tableEnsured = false

export async function autoAssignTicket(
  ticketId: number,
  category: string | null,
  requesterDepartment: string | null
): Promise<number | null> {
  try {
    const { query } = await import("@/lib/db")

    if (!tableEnsured) {
      await ensureTable()
      tableEnsured = true
    }

    // Load settings
    const rows = await query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('auto_assign_enabled','auto_assign_round_robin')"
    ) as any[]

    const settings: Record<string, string> = {}
    rows.forEach((r: any) => { settings[r.key_name] = r.value })

    if (settings.auto_assign_enabled !== "true") return null

    // Check rules ordered by priority
    const rules = await query(
      "SELECT * FROM auto_assign_rules WHERE active = 1 ORDER BY priority ASC"
    ) as any[]

    for (const rule of rules) {
      const categoryMatch = !rule.category || rule.category === category
      const departmentMatch = !rule.department || rule.department === requesterDepartment
      if (categoryMatch && departmentMatch) {
        await query("UPDATE tickets SET assignee_id = ? WHERE id = ?", [rule.assign_to_user_id, ticketId])
        console.log(`[AutoAssign] Ticket ${ticketId} zugewiesen an User ${rule.assign_to_user_id} (Regel ${rule.id})`)
        return rule.assign_to_user_id
      }
    }

    // Round-robin fallback: agent with fewest open tickets
    if (settings.auto_assign_round_robin === "true") {
      const agents = await query(
        `SELECT u.id, COUNT(t.id) as open_count
         FROM users u
         LEFT JOIN tickets t ON t.assignee_id = u.id AND t.status IN ('open','pending','in_progress')
         WHERE u.active = 1 AND (u.role LIKE '%agent%' OR u.role LIKE '%admin%')
         GROUP BY u.id
         ORDER BY open_count ASC
         LIMIT 1`
      ) as any[]

      if (agents.length > 0) {
        const agentId = agents[0].id
        await query("UPDATE tickets SET assignee_id = ? WHERE id = ?", [agentId, ticketId])
        console.log(`[AutoAssign] Ticket ${ticketId} per Round-Robin zugewiesen an User ${agentId}`)
        return agentId
      }
    }

    return null
  } catch (err: any) {
    console.error("[AutoAssign] Fehler:", err.message)
    return null
  }
}
