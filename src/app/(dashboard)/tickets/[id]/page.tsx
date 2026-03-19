import { notFound } from "next/navigation"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { TicketDetail } from "@/components/tickets/ticket-detail"

async function getTicket(id: string) {
  try {
    const [ticket] = await query(`
      SELECT t.*, u.name as requester_name, u.email as requester_email,
             a.name as assignee_name
      FROM tickets t LEFT JOIN users u ON t.requester_id = u.id
      LEFT JOIN users a ON t.assignee_id = a.id WHERE t.id = ?
    `, [id]) as any[]
    if (!ticket) return null
    const comments = await query(`
      SELECT c.*, u.name as author_name FROM ticket_comments c
      LEFT JOIN users u ON c.user_id = u.id WHERE c.ticket_id = ? ORDER BY c.created_at ASC
    `, [id])
    const agents = await query("SELECT id, name FROM users WHERE role LIKE '%agent%' OR role LIKE '%admin%' ORDER BY name")
    return { ...ticket, comments, agents }
  } catch { return null }
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  const ticket = await getTicket(id)
  if (!ticket) notFound()
  return <TicketDetail ticket={ticket} session={session} />
}
