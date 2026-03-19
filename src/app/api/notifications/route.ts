import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureSystemCol() {
  await pool.execute("ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_system TINYINT(1) DEFAULT 0").catch(() => {})
  await pool.execute("ALTER TABLE ticket_comments ADD COLUMN is_system TINYINT(1) DEFAULT 0").catch(() => {})
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureSystemCol()

  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const isPrivileged = roles.some(r => ["admin", "agent", "disposition"].includes(r))

  // New tickets
  const ticketSql = isPrivileged
    ? `SELECT id, ticket_number, title, priority, created_at, 'new_ticket' as type
       FROM tickets WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at DESC LIMIT 10`
    : `SELECT id, ticket_number, title, priority, created_at, 'new_ticket' as type
       FROM tickets WHERE requester_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY created_at DESC LIMIT 10`
  const ticketParams = isPrivileged ? [] : [session.userId]

  // Comments on relevant tickets (exclude own + system comments for the feed)
  const commentSql = isPrivileged
    ? `SELECT c.id, c.ticket_id, c.created_at, t.ticket_number, t.title,
              u.name as author_name, c.content as body, IFNULL(c.is_system,0) as is_system, 'new_comment' as type
       FROM ticket_comments c
       JOIN tickets t ON c.ticket_id = t.id
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) AND (c.user_id != ? OR IFNULL(c.is_system,0) = 1)
       ORDER BY c.created_at DESC LIMIT 15`
    : `SELECT c.id, c.ticket_id, c.created_at, t.ticket_number, t.title,
              u.name as author_name, c.content as body, IFNULL(c.is_system,0) as is_system,
              IF(IFNULL(c.is_system,0)=1, 'status_change', 'new_comment') as type
       FROM ticket_comments c
       JOIN tickets t ON c.ticket_id = t.id
       LEFT JOIN users u ON c.user_id = u.id
       WHERE t.requester_id = ? AND (c.user_id != ? OR IFNULL(c.is_system,0) = 1)
             AND c.created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY c.created_at DESC LIMIT 15`
  const commentParams = isPrivileged ? [session.userId] : [session.userId, session.userId]

  const [tickets, comments] = await Promise.all([
    query(ticketSql, ticketParams).catch(() => []),
    query(commentSql, commentParams).catch(() => []),
  ])

  const all = [...(tickets as any[]), ...(comments as any[])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)

  return NextResponse.json({ items: all, count: all.length })
}
