"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Send, Lock, User, Calendar, Tag, Forward, X, Loader2, Ban, Sparkles, CheckSquare, Plus, Trash2, Pencil, Users, TrendingUp, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow, format } from "date-fns"
import { de } from "date-fns/locale"

function ForwardModal({ ticket, onClose }: { ticket: any; onClose: () => void }) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState(`Ticket #${ticket.ticket_number}: ${ticket.title}`)
  const [body, setBody] = useState(`Sehr geehrte Damen und Herren,\n\nbitte um Unterstützung bei folgendem Anliegen:\n\n${ticket.description || ""}\n\nMit freundlichen Grüßen\nIT Helpdesk`)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to.trim()) { setError("E-Mail-Adresse erforderlich"); return }
    setSending(true); setError(null)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/forward`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject, body })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fehler beim Senden")
      setSent(true)
      setTimeout(onClose, 1500)
    } catch (e: any) { setError(e.message) } finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Forward className="h-5 w-5 text-primary" />An Dienstleister weiterleiten</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {sent ? (
          <div className="p-8 text-center text-emerald-600 font-medium">✓ E-Mail erfolgreich gesendet</div>
        ) : (
          <form onSubmit={send} className="p-6 space-y-3">
            {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
            <div><label className="text-sm font-medium mb-1 block">Empfänger (E-Mail) *</label>
              <input type="email" className={inp} value={to} onChange={e => setTo(e.target.value)} placeholder="dienstleister@firma.de" /></div>
            <div><label className="text-sm font-medium mb-1 block">Betreff</label>
              <input className={inp} value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Nachricht</label>
              <textarea className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={8} value={body} onChange={e => setBody(e.target.value)} /></div>
            <div className="text-xs text-muted-foreground">Die E-Mail wird als interne Notiz im Ticket gespeichert.</div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
              <button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Sende...</> : <><Send className="h-4 w-4" />Senden</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
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

export function TicketDetail({ ticket, session }: { ticket: any; session: any }) {
  const router = useRouter()
  const [comment, setComment] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(ticket.status)
  const [priority, setPriority] = useState(ticket.priority)
  const [assigneeId, setAssigneeId] = useState(ticket.assignee_id?.toString() || "none")
  const [affectedUserId, setAffectedUserId] = useState(ticket.affected_user_id?.toString() || "none")
  const [showForward, setShowForward] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [removingDelegate, setRemovingDelegate] = useState(false)
  const isAdmin = session?.role?.includes("admin") || session?.role?.includes("agent")
  const isDelegate = ticket.is_delegate  // current user is the delegate on this ticket

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    await fetch(`/api/tickets/${ticket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment, is_internal: isInternal }),
    })
    setComment("")
    router.refresh()
    setSubmitting(false)
  }

  async function updateStatus(newStatus: string) {
    setStatus(newStatus)
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
  }

  async function updateAssignee(userId: string) {
    setAssigneeId(userId)
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee_id: userId === "none" ? null : userId }),
    })
    router.refresh()
  }

  async function updateAffectedUser(userId: string) {
    setAffectedUserId(userId)
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affected_user_id: userId === "none" ? null : userId }),
    })
    router.refresh()
  }

  async function escalatePriority(newPriority: string) {
    setPriority(newPriority)
    await fetch(`/api/tickets/${ticket.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: newPriority }),
    })
    router.refresh()
  }

  async function removeDelegate() {
    if (!confirm("Stellvertretung aus diesem Ticket entfernen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return
    setRemovingDelegate(true)
    await fetch(`/api/tickets/${ticket.id}/delegate`, { method: "DELETE" })
    router.refresh()
    setRemovingDelegate(false)
  }

  const statusInfo = statusConfig[status] || { label: status, variant: "secondary" }
  const priorityInfo = priorityConfig[ticket.priority] || { label: ticket.priority, variant: "secondary" }

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/tickets">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_number}</span>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>
          </div>
          <h1 className="text-xl font-bold mt-0.5">{ticket.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-foreground/80 prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_br]:my-0 break-words overflow-hidden [&_a]:break-all" dangerouslySetInnerHTML={{ __html: ticket.description }} />
              <div className="flex gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{ticket.requester_name}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(ticket.created_at), "dd.MM.yyyy HH:mm")}</span>
                <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{ticket.category}</span>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <div className="space-y-3">
            {ticket.comments?.map((c: any) => (
              <div key={c.id} className={`flex gap-3 ${Number(c.is_internal) ? "opacity-75" : ""}`}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{c.author_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className={`rounded-xl px-4 py-3 text-sm ${Number(c.is_internal) ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted"}`}>
                    {!!c.is_internal && <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium mb-1.5"><Lock className="h-3 w-3" /> Interne Notiz</div>}
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_br]:my-0 break-words overflow-hidden [&_a]:break-all" dangerouslySetInnerHTML={{ __html: c.content }} />
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-1">
                    <span className="text-xs font-medium">{c.author_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { locale: de, addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply form */}
          <Card>
            <CardContent className="p-4">
              <form onSubmit={submitComment} className="space-y-3">
                <Textarea
                  placeholder="Antwort schreiben..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex items-center justify-between gap-2">
                  {isAdmin && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Interne Notiz</span>
                    </label>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    {isAdmin && (
                      <Button type="button" variant="outline" size="sm" disabled={analyzing} onClick={async () => {
                        setAnalyzing(true)
                        try {
                          const res = await fetch("/api/claude", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ticket_id: ticket.id }),
                          })
                          const data = await res.json()
                          if (!res.ok) alert(`Fehler: ${data.error}`)
                          else router.refresh()
                        } catch (err: any) { alert(err.message) }
                        finally { setAnalyzing(false) }
                      }}>
                        {analyzing
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysiere...</>
                          : <><Sparkles className="h-3.5 w-3.5" /> Claude</>}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowForward(true)}>
                        <Forward className="h-3.5 w-3.5" /> Weiterleiten
                      </Button>
                    )}
                    {isAdmin && (
                      <Button type="button" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={async () => {
                        const choice = window.confirm(
                          `Absender "${ticket.requester_email || ticket.requester_name}" auf die Blacklist setzen?\n\nZukünftige Tickets/Mails von diesem Absender werden automatisch gefiltert.`
                        )
                        if (!choice) return
                        const res = await fetch("/api/blacklist", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sender: ticket.requester_email || "",
                            subject: "",
                            ticket_id: ticket.id,
                          }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          alert(`"${ticket.requester_email}" wurde zur Blacklist hinzugefügt.`)
                        } else {
                          alert(`Fehler: ${data.error}`)
                        }
                      }}>
                        <Ban className="h-3.5 w-3.5" /> Sperren
                      </Button>
                    )}
                    <Button type="submit" size="sm" disabled={submitting || !comment.trim()}>
                      <Send className="h-3.5 w-3.5" /> Senden
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stellvertretungs-Banner */}
          {ticket.delegate_user_id && (
            <div className={`rounded-xl border p-4 ${isDelegate ? "bg-violet-500/10 border-violet-500/30" : "bg-muted/40 border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className={`h-4 w-4 shrink-0 ${isDelegate ? "text-violet-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-xs font-semibold ${isDelegate ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`}>
                      {isDelegate ? "Du bist Stellvertreter" : "Stellvertretung"}
                    </p>
                    <p className="text-sm font-medium">{ticket.delegate_name}</p>
                  </div>
                </div>
                {ticket.can_remove_delegate && (
                  <button
                    onClick={removeDelegate}
                    disabled={removingDelegate}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    title="Stellvertretung entfernen (Datenschutz)"
                  >
                    {removingDelegate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {isDelegate && (
                <div className="mt-3 pt-3 border-t border-violet-500/20">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Priorität eskalieren
                  </p>
                  <Select value={priority} onValueChange={escalatePriority}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">
                        <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-amber-500" />Hoch</span>
                      </SelectItem>
                      <SelectItem value="critical">
                        <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-red-500" />Kritisch</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                {isAdmin ? (
                  <Select value={status} onValueChange={updateStatus}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Offen</SelectItem>
                      <SelectItem value="pending">Ausstehend</SelectItem>
                      <SelectItem value="in_progress">In Arbeit</SelectItem>
                      <SelectItem value="resolved">Gelöst</SelectItem>
                      <SelectItem value="closed">Geschlossen</SelectItem>
                    </SelectContent>
                  </Select>
                ) : <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-xs mb-1">Zugewiesen an</p>
                {isAdmin ? (
                  <Select value={assigneeId} onValueChange={updateAssignee}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nicht zugewiesen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugewiesen</SelectItem>
                      {ticket.agents?.map((a: any) => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <span>{ticket.assignee_name || "Nicht zugewiesen"}</span>}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-xs mb-1">Ersteller</p>
                <span>{ticket.requester_name}</span>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-xs mb-1">Betroffener</p>
                {isAdmin ? (
                  <Select value={affectedUserId} onValueChange={updateAffectedUser}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Gleich wie Ersteller" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Gleich wie Ersteller</SelectItem>
                      {ticket.allUsers?.map((u: any) => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span>{ticket.affected_user_name || ticket.requester_name}</span>
                )}
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Kategorie</p>
                <span>{ticket.category}</span>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Erstellt</p>
                <span>{format(new Date(ticket.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Checklist */}
          <TicketChecklist ticketId={ticket.id} isAdmin={isAdmin} />
        </div>
      </div>

      {showForward && <ForwardModal ticket={ticket} onClose={() => { setShowForward(false); router.refresh() }} />}
    </div>
  )
}

function TicketChecklist({ ticketId, isAdmin }: { ticketId: number; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")

  const load = () => {
    fetch(`/api/tickets/${ticketId}/checklist`)
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [ticketId])

  const toggle = async (itemId: number, done: boolean) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_done: done ? 1 : 0 } : i))
    await fetch(`/api/tickets/${ticketId}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, is_done: done }),
    })
    load()
  }

  const addItem = async () => {
    if (!newItem.trim()) return
    await fetch(`/api/tickets/${ticketId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newItem.trim() }),
    })
    setNewItem("")
    load()
  }

  const saveEdit = async (itemId: number) => {
    if (!editText.trim()) return
    await fetch(`/api/tickets/${ticketId}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, content: editText.trim() }),
    })
    setEditId(null)
    load()
  }

  const deleteItem = async (itemId: number) => {
    await fetch(`/api/tickets/${ticketId}/checklist`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    })
    load()
  }

  const doneCount = items.filter(i => !!Number(i.is_done)).length
  const totalCount = items.length

  if (loading) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Checkliste
          </CardTitle>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">{doneCount}/{totalCount}</span>
          )}
        </div>
        {totalCount > 0 && (
          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
            <div
              className="bg-primary rounded-full h-1.5 transition-all"
              style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {items.map(item => (
          <div key={item.id} className="group flex items-start gap-2 py-1">
            <button
              onClick={() => toggle(item.id, !Number(item.is_done))}
              className={`mt-0.5 shrink-0 h-4 w-4 rounded border transition-colors flex items-center justify-center ${
                Number(item.is_done)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/30 hover:border-primary"
              }`}
            >
              {!!Number(item.is_done) && <svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
            </button>
            {editId === item.id ? (
              <div className="flex-1 flex gap-1">
                <input
                  className="flex-1 text-xs rounded border bg-background px-2 py-0.5"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(item.id); if (e.key === "Escape") setEditId(null) }}
                  autoFocus
                />
                <button onClick={() => saveEdit(item.id)} className="text-xs text-primary">OK</button>
              </div>
            ) : (
              <span
                className={`flex-1 text-xs leading-relaxed ${Number(item.is_done) ? "line-through text-muted-foreground" : ""}`}
              >
                {item.content}
                {item.done_by && Number(item.is_done) && (
                  <span className="text-[10px] text-muted-foreground ml-1">({item.done_by})</span>
                )}
              </span>
            )}
            {isAdmin && editId !== item.id && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                <button onClick={() => { setEditId(item.id); setEditText(item.content) }} className="p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => deleteItem(item.id)} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        ))}

        {/* Add new item */}
        {isAdmin && (
          <div className="flex gap-1 pt-1">
            <input
              className="flex-1 text-xs rounded border bg-background px-2 py-1"
              placeholder="Neuen Punkt hinzufügen..."
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addItem() }}
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim()}
              className="shrink-0 rounded border px-1.5 py-1 text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}

        {items.length === 0 && !isAdmin && (
          <p className="text-xs text-muted-foreground py-2 text-center">Keine Checkliste vorhanden</p>
        )}
      </CardContent>
    </Card>
  )
}
