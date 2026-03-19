import { query } from "@/lib/db"

interface SlaRule {
  id: number
  name: string
  type: string
  match_category: string | null
  match_department: string | null
  match_priority: string | null
  response_hours: number | null
  resolution_hours: number | null
  sort_order: number
}

/**
 * Find the best matching SLA rule for a ticket or order.
 * More specific matches win (category+department+priority > category > default).
 */
export async function findMatchingSla(opts: {
  type: "ticket" | "order"
  category?: string | null
  department?: string | null
  priority?: string | null
}): Promise<SlaRule | null> {
  const rules = await query(
    "SELECT * FROM sla_rules WHERE type = ? AND active = 1 ORDER BY sort_order ASC",
    [opts.type]
  ) as SlaRule[]

  if (rules.length === 0) return null

  // Score each rule: more specific match = higher score
  let best: SlaRule | null = null
  let bestScore = -1

  for (const rule of rules) {
    let score = 0
    let matches = true

    if (rule.match_category) {
      if (opts.category && opts.category.toLowerCase() === rule.match_category.toLowerCase()) score += 4
      else matches = false
    }
    if (rule.match_department) {
      if (opts.department && opts.department.toLowerCase() === rule.match_department.toLowerCase()) score += 2
      else matches = false
    }
    if (rule.match_priority) {
      if (opts.priority && opts.priority.toLowerCase() === rule.match_priority.toLowerCase()) score += 1
      else matches = false
    }

    // A rule with no filters is a catch-all (score 0, matches everything)
    if (matches && score > bestScore) {
      best = rule
      bestScore = score
    }
    // Catch-all only if nothing more specific found
    if (matches && score === 0 && !best) {
      best = rule
      bestScore = 0
    }
  }

  return best
}

/**
 * Apply SLA to a ticket: set sla_due_at based on resolution_hours.
 */
export async function applySlaToTicket(ticketId: number, opts: {
  category?: string | null
  department?: string | null
  priority?: string | null
}) {
  try {
    const rule = await findMatchingSla({ type: "ticket", ...opts })
    if (!rule || !rule.resolution_hours) return
    await query(
      "UPDATE tickets SET sla_due_at = DATE_ADD(created_at, INTERVAL ? HOUR), sla_rule_id = ? WHERE id = ?",
      [rule.resolution_hours, rule.id, ticketId]
    )
  } catch {}
}

/**
 * Apply SLA to an order: set sla_due_at based on resolution_hours.
 */
export async function applySlaToOrder(orderId: number, opts: {
  category?: string | null
  department?: string | null
}) {
  try {
    const rule = await findMatchingSla({ type: "order", ...opts })
    if (!rule || !rule.resolution_hours) return
    await query(
      "UPDATE orders SET sla_due_at = DATE_ADD(created_at, INTERVAL ? HOUR), sla_rule_id = ? WHERE id = ?",
      [rule.resolution_hours, rule.id, orderId]
    )
  } catch {}
}
