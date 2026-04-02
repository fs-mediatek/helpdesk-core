"use client"
import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Filter, Loader2, AlertCircle, Users, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"

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

export default function TicketsPage() {
  return <Suspense><TicketsContent /></Suspense>
}

function TicketsContent() {
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", category: "Sonstiges", on_behalf_of: "" })
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 50
  const [isAssistenz, setIsAssistenz] = useState(false)
  const [colleagues, setColleagues] = useState<any[]>([])

  // Load current user role + colleagues
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(me => {
      if (me?.role?.includes("assistenz")) {
        setIsAssistenz(true)
        fetch("/api/colleagues").then(r => r.json()).then(setColleagues).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  // Auto-open dialog from chatbot redirect
  useEffect(() => {
    const subject = searchParams.get("subject")
    const description = searchParams.get("description")
    if (subject || description) {
      setForm(f => ({ ...f, title: subject || "", description: description || "" }))
      setShowNew(true)
      window.history.replaceState({}, "", "/tickets")
    }
  }, [searchParams])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    params.set("status", statusFilter)
    if (priorityFilter !== "all") params.set("priority", priorityFilter)
    params.set("page", page.toString())
    params.set("limit", perPage.toString())
    const res = await fetch(`/api/tickets?${params}`)
    const data = await res.json()
    setTickets(data.tickets || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [search, statusFilter, priorityFilter, page])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const body: any = { title: form.title, description: form.description, priority: form.priority, category: form.category }
    if (form.on_behalf_of) body.on_behalf_of = form.on_behalf_of
    await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setShowNew(false)
    setForm({ title: "", description: "", priority: "medium", category: "Sonstiges", on_behalf_of: "" })
    fetchTickets()
    setSubmitting(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Support-Anfragen verwalten</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> Neues Ticket
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ticket suchen..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktive Tickets</SelectItem>
            <SelectItem value="all">Alle (inkl. geschlossen)</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="in_progress">In Arbeit</SelectItem>
            <SelectItem value="resolved">Gelöst</SelectItem>
            <SelectItem value="closed">Geschlossen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priorität" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            <SelectItem value="critical">Kritisch</SelectItem>
            <SelectItem value="high">Hoch</SelectItem>
            <SelectItem value="medium">Mittel</SelectItem>
            <SelectItem value="low">Niedrig</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Keine Tickets gefunden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ersteller</TableHead>
                  <TableHead>Zugewiesen</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket: any) => {
                  const status = statusConfig[ticket.status] || { label: ticket.status, variant: "secondary" }
                  const priority = priorityConfig[ticket.priority] || { label: ticket.priority, variant: "secondary" }
                  return (
                    <TableRow
                      key={ticket.id}
                      className={`cursor-pointer ${ticket.is_delegate ? "bg-violet-500/5 hover:bg-violet-500/10 border-l-2 border-l-violet-500" : ""}`}
                    >
                      <TableCell>
                        <Link href={`/tickets/${ticket.id}`} className="block hover:text-primary transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
                            {ticket.is_delegate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                                <Users className="h-2.5 w-2.5" /> Stellvertretung
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{ticket.title}</span>
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant={priority.variant}>{priority.label}</Badge></TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ticket.requester_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ticket.assignee_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(ticket.created_at), { locale: de, addSuffix: true })}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > perPage && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} Tickets gesamt</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Zurück
            </Button>
            <span>Seite {page} von {Math.ceil(total / perPage)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / perPage)} onClick={() => setPage(p => p + 1)}>
              Weiter <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Neues Ticket erstellen</DialogTitle></DialogHeader>
          <form onSubmit={createTicket} className="space-y-4">
            {isAssistenz && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Im Namen von (optional)</Label>
                {colleagues.length > 0 ? (
                  <>
                    <Select value={form.on_behalf_of} onValueChange={v => setForm(f => ({ ...f, on_behalf_of: v === "self" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Eigenes Ticket (Standard)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Eigenes Ticket (Standard)</SelectItem>
                        {colleagues.map((c: any) => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.on_behalf_of && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Du wirst als Stellvertreter im Ticket hinterlegt.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    Keine Kollegen in deiner Abteilung gefunden. Bitte stelle sicher, dass dir eine Abteilung zugewiesen ist.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Titel</Label>
              <Input placeholder="Kurze Beschreibung des Problems" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea placeholder="Detaillierte Beschreibung..." rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hardware">Hardware</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Netzwerk">Netzwerk</SelectItem>
                    <SelectItem value="Zugang/Passwort">Zugang/Passwort</SelectItem>
                    <SelectItem value="Bestellung">Bestellung</SelectItem>
                    <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Abbrechen</Button>
              <Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Erstelle...</> : "Ticket erstellen"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
