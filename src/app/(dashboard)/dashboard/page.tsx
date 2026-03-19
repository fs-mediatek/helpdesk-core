import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Ticket, Clock, CheckCircle2, Users, AlertCircle, ArrowUpRight, UserPlus, UserMinus } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"

const PRIVILEGED_ROLES = ["admin", "agent", "disposition", "assistenz", "fuehrungskraft"]

async function getStats(userId?: number) {
  try {
    if (userId) {
      // User-specific stats
      const [open] = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'open' AND requester_id = ?", [userId])
      const [inProgress] = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress' AND requester_id = ?", [userId])
      const [resolvedToday] = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved' AND DATE(resolved_at) = CURDATE() AND requester_id = ?", [userId])
      const [total] = await query("SELECT COUNT(*) as count FROM tickets WHERE requester_id = ?", [userId])
      return {
        open: (open as any).count,
        inProgress: (inProgress as any).count,
        resolvedToday: (resolvedToday as any).count,
        users: (total as any).count,
        isUserView: true,
      }
    }
    const [open] = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'")
    const [inProgress] = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress'")
    const [resolvedToday] = await query("SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved' AND DATE(resolved_at) = CURDATE()")
    const [total] = await query("SELECT COUNT(*) as count FROM users WHERE active = 1")
    return {
      open: (open as any).count,
      inProgress: (inProgress as any).count,
      resolvedToday: (resolvedToday as any).count,
      users: (total as any).count,
      isUserView: false,
    }
  } catch { return { open: 0, inProgress: 0, resolvedToday: 0, users: 0, isUserView: false } }
}

async function getRecentTickets(userId?: number) {
  try {
    if (userId) {
      return await query(`
        SELECT t.id, t.ticket_number, t.title, t.status, t.priority, t.created_at,
               u.name as requester_name
        FROM tickets t
        LEFT JOIN users u ON t.requester_id = u.id
        WHERE t.requester_id = ?
        ORDER BY t.created_at DESC LIMIT 8
      `, [userId])
    }
    return await query(`
      SELECT t.id, t.ticket_number, t.title, t.status, t.priority, t.created_at,
             u.name as requester_name
      FROM tickets t
      LEFT JOIN users u ON t.requester_id = u.id
      ORDER BY t.created_at DESC LIMIT 8
    `)
  } catch { return [] }
}

async function getOnboardingStats() {
  try {
    const [ob] = await query("SELECT COUNT(*) as c FROM onboarding_requests WHERE type='onboarding' AND status IN ('pending','in_progress')") as any[]
    const [off] = await query("SELECT COUNT(*) as c FROM onboarding_requests WHERE type='offboarding' AND status IN ('pending','in_progress')") as any[]
    return { onboarding: ob?.c || 0, offboarding: off?.c || 0 }
  } catch { return { onboarding: 0, offboarding: 0 } }
}

const statusConfig: Record<string, { label: string; variant: any }> = {
  open: { label: "Offen", variant: "info" },
  pending: { label: "Ausstehend", variant: "warning" },
  in_progress: { label: "In Arbeit", variant: "purple" },
  resolved: { label: "Gelöst", variant: "success" },
  closed: { label: "Geschlossen", variant: "secondary" },
}

const priorityConfig: Record<string, { label: string; variant: any }> = {
  critical: { label: "Kritisch", variant: "destructive" },
  high: { label: "Hoch", variant: "warning" },
  medium: { label: "Mittel", variant: "secondary" },
  low: { label: "Niedrig", variant: "secondary" },
}

export default async function DashboardPage() {
  const session = await getSession()
  const userRoles: string[] = session?.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const isPrivileged = userRoles.some(r => PRIVILEGED_ROLES.includes(r))
  const filterUserId = isPrivileged ? undefined : session?.userId

  const stats = await getStats(filterUserId)
  const recentTickets = await getRecentTickets(filterUserId)
  const obStats = isPrivileged ? await getOnboardingStats() : { onboarding: 0, offboarding: 0 }
  const hasActiveOnboarding = obStats.onboarding > 0 || obStats.offboarding > 0

  const statCards = isPrivileged ? [
    { title: "Offene Tickets", value: stats.open, icon: Ticket, color: "text-blue-500", bg: "bg-blue-500/10", desc: "Warten auf Bearbeitung" },
    { title: "In Bearbeitung", value: stats.inProgress, icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10", desc: "Aktiv bearbeitet" },
    { title: "Heute gelöst", value: stats.resolvedToday, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", desc: "Abgeschlossen heute" },
    { title: "Aktive Benutzer", value: stats.users, icon: Users, color: "text-amber-500", bg: "bg-amber-500/10", desc: "Registriert & aktiv" },
  ] : [
    { title: "Meine offenen Tickets", value: stats.open, icon: Ticket, color: "text-blue-500", bg: "bg-blue-500/10", desc: "Warten auf Bearbeitung" },
    { title: "In Bearbeitung", value: stats.inProgress, icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10", desc: "Aktiv bearbeitet" },
    { title: "Heute gelöst", value: stats.resolvedToday, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", desc: "Abgeschlossen heute" },
    { title: "Tickets gesamt", value: stats.users, icon: Users, color: "text-amber-500", bg: "bg-amber-500/10", desc: "Alle meine Anfragen" },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Guten Tag, {session?.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Hier ist dein aktueller Überblick.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Active Onboardings — only for privileged users when there are active ones */}
      {isPrivileged && hasActiveOnboarding && (
        <div className="grid gap-4 sm:grid-cols-2">
          {obStats.onboarding > 0 && (
            <Link href="/p/onboarding/onboarding">
              <Card className="hover:shadow-md transition-shadow border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl p-2.5 bg-emerald-500/15">
                        <UserPlus className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Aktive Onboardings</p>
                        <p className="text-2xl font-bold mt-0.5">{obStats.onboarding}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          {obStats.offboarding > 0 && (
            <Link href="/p/onboarding/offboarding">
              <Card className="hover:shadow-md transition-shadow border-red-500/20 bg-red-500/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl p-2.5 bg-red-500/15">
                        <UserMinus className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Aktive Offboardings</p>
                        <p className="text-2xl font-bold mt-0.5">{obStats.offboarding}</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Recent Tickets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">{isPrivileged ? "Neueste Tickets" : "Meine Tickets"}</CardTitle>
            <CardDescription>{isPrivileged ? "Die zuletzt erstellten Support-Anfragen" : "Deine zuletzt erstellten Anfragen"}</CardDescription>
          </div>
          <Link href="/tickets" className="text-sm text-primary hover:underline flex items-center gap-1">
            Alle anzeigen <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {recentTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Keine Tickets vorhanden</p>
              </div>
            ) : (recentTickets as any[]).map((ticket) => {
              const status = statusConfig[ticket.status] || { label: ticket.status, variant: "secondary" }
              const priority = priorityConfig[ticket.priority] || { label: ticket.priority, variant: "secondary" }
              return (
                <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                      <Badge variant={priority.variant} className="text-xs">{priority.label}</Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">{ticket.requester_name} · {formatDistanceToNow(new Date(ticket.created_at), { locale: de, addSuffix: true })}</p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
