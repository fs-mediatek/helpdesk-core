"use client"
import { useState, useEffect } from "react"
import { FileText, Plus, Search, Loader2, X, Trash2, Pencil, Mail, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const CATEGORIES = ["Allgemein", "Hardware", "Software", "Netzwerk", "Passwort", "Drucker", "E-Mail", "Sonstiges"]

const TRIGGER_OPTIONS = [
  { value: "", label: "Kein Auto-Versand" },
  { value: "ticket_created", label: "Ticket erstellt" },
  { value: "ticket_resolved", label: "Ticket gelöst" },
  { value: "ticket_closed", label: "Ticket geschlossen" },
  { value: "onboarding_started", label: "Onboarding gestartet" },
  { value: "offboarding_started", label: "Offboarding gestartet" },
  { value: "device_assigned", label: "Gerät zugewiesen" },
]

type TabType = "answer" | "email" | "checklist"

interface Template {
  id: number
  title: string
  content: string
  category: string | null
  tags: string | null
  type: string
  trigger_event?: string | null
  recipients?: string | null
  is_active?: number | null
  created_by_name?: string
}

const emptyForm = { title: "", content: "", category: "", tags: "", type: "answer" as string, trigger_event: "", recipients: "", is_active: true }

function PlaceholderCard() {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 mt-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Verfügbare Platzhalter</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
        <span><code className="text-foreground/70">{"{{ticket_nummer}}"}</code>, <code className="text-foreground/70">{"{{ticket_titel}}"}</code> — Ticket-Daten</span>
        <span><code className="text-foreground/70">{"{{ersteller_name}}"}</code>, <code className="text-foreground/70">{"{{ersteller_email}}"}</code> — Ticket-Ersteller</span>
        <span><code className="text-foreground/70">{"{{agent_name}}"}</code> — Bearbeitender Agent</span>
        <span><code className="text-foreground/70">{"{{datum}}"}</code> — Aktuelles Datum</span>
        <span><code className="text-foreground/70">{"{{mitarbeiter_name}}"}</code>, <code className="text-foreground/70">{"{{mitarbeiter_email}}"}</code>, <code className="text-foreground/70">{"{{abteilung}}"}</code> — On-/Offboarding</span>
        <span><code className="text-foreground/70">{"{{austrittsdatum}}"}</code> — Offboarding</span>
        <span><code className="text-foreground/70">{"{{geraet_name}}"}</code>, <code className="text-foreground/70">{"{{geraet_tag}}"}</code> — Asset-Zuweisung</span>
      </div>
    </div>
  )
}

function TemplateModal({ tpl, tab, onClose, onSaved }: { tpl?: Template; tab: TabType; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(tpl ? {
    title: tpl.title,
    content: tpl.content,
    category: tpl.category || "",
    tags: tpl.tags || "",
    type: tpl.type || tab,
    trigger_event: tpl.trigger_event || "",
    recipients: tpl.recipients || "",
    is_active: tpl.is_active !== 0,
  } : { ...emptyForm, type: tab })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { setError("Name und Inhalt erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const url = tpl ? `/api/templates/${tpl.id}` : "/api/templates"
      const method = tpl ? "PUT" : "POST"
      const payload: any = {
        title: form.title,
        content: form.content,
        category: form.category,
        tags: form.tags,
        type: form.type,
      }
      if (tab === "email") {
        payload.trigger_event = form.trigger_event || null
        payload.recipients = form.recipients || null
        payload.is_active = form.is_active ? 1 : 0
      }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{tpl ? "Vorlage bearbeiten" : "Neue Vorlage"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div>
            <label className="text-sm font-medium mb-1 block">{tab === "email" ? "Name (wird als Betreff verwendet)" : "Name"} *</label>
            <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={tab === "email" ? "z.B. Ticket-Bestätigung" : tab === "checklist" ? "z.B. Onboarding-Checkliste" : "z.B. Passwort zurücksetzen"} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Kategorie</label>
            <select className={inp} value={CATEGORIES.includes(form.category) ? form.category : form.category ? "__custom" : ""} onChange={e => {
              if (e.target.value === "__custom") setForm(f => ({ ...f, category: " " }))
              else setForm(f => ({ ...f, category: e.target.value }))
            }}>
              <option value="">Keine Kategorie</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              {form.category && !CATEGORIES.includes(form.category) && <option value="__custom">{form.category.trim()} (benutzerdefiniert)</option>}
              <option value="__custom">Eigene eingeben...</option>
            </select>
          </div>

          {form.category && !CATEGORIES.includes(form.category) && (
            <div>
              <label className="text-sm font-medium mb-1 block">Eigene Kategorie</label>
              <input className={inp} value={form.category.trim()} onChange={e => setForm(f => ({ ...f, category: e.target.value || " " }))} placeholder="Kategoriename eingeben..." autoFocus />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Inhalt *{tab === "checklist" ? " (ein Punkt pro Zeile)" : tab === "email" ? " (HTML)" : ""}</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={tab === "checklist" ? 8 : 7}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={tab === "checklist" ? "VPN-Zugang einrichten\nE-Mail-Konto erstellen\nHardware bereitstellen\n..." : tab === "email" ? "<p>Hallo {{ersteller_name}},</p>\n<p>Ihr Ticket {{ticket_nummer}} wurde erstellt.</p>" : "Vorlagentext..."}
            />
          </div>

          {tab === "email" && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Trigger-Event</label>
                <select className={inp} value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}>
                  {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Empfänger</label>
                <input className={inp} value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} placeholder="{{ersteller}}, {{agent}} oder email@firma.de" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                <span>Auto-Versand aktiv</span>
              </label>
            </>
          )}

          <PlaceholderCard />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{tpl ? "Speichere..." : "Erstelle..."}</> : tpl ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [tab, setTab] = useState<TabType>("answer")
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editTpl, setEditTpl] = useState<Template | null | "new">(null)

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams()
    p.set("type", tab)
    if (search) p.set("search", search)
    fetch(`/api/templates?${p}`)
      .then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [tab, search])

  const remove = async (t: Template) => {
    if (!confirm(`Vorlage "${t.title}" wirklich löschen?`)) return
    await fetch(`/api/templates/${t.id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  const triggerLabel = (val: string | null | undefined) => {
    const opt = TRIGGER_OPTIONS.find(o => o.value === (val || ""))
    return opt ? opt.label : val || "—"
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "answer", label: "Antwortvorlagen", icon: <FileText className="h-4 w-4" /> },
    { key: "email", label: "E-Mail-Vorlagen", icon: <Mail className="h-4 w-4" /> },
    { key: "checklist", label: "Checklisten-Vorlagen", icon: <CheckSquare className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vorlagen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Antwort-, E-Mail- und Checklisten-Vorlagen verwalten</p>
        </div>
        <Button onClick={() => setEditTpl("new")}><Plus className="h-4 w-4" /> Neue Vorlage</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch("") }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Vorlagen suchen..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Vorlagen vorhanden</p>
          <button onClick={() => setEditTpl("new")} className="mt-3 text-sm text-primary hover:underline">Erste Vorlage erstellen</button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Kategorie</th>
                {tab === "answer" && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Vorschau</th>}
                {tab === "email" && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Trigger</th>}
                {tab === "email" && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Empfänger</th>}
                {tab === "email" && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>}
                {tab === "checklist" && <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Punkte</th>}
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{t.title}</td>
                  <td className="px-4 py-2.5">
                    {t.category ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.category}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  {tab === "answer" && (
                    <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{t.content.slice(0, 80)}{t.content.length > 80 ? "..." : ""}</td>
                  )}
                  {tab === "email" && (
                    <td className="px-4 py-2.5">
                      {t.trigger_event ? (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">{triggerLabel(t.trigger_event)}</span>
                      ) : <span className="text-muted-foreground text-xs">Manuell</span>}
                    </td>
                  )}
                  {tab === "email" && (
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.recipients || "—"}</td>
                  )}
                  {tab === "email" && (
                    <td className="px-4 py-2.5">
                      {t.is_active !== 0 ? (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">aktiv</span>
                      ) : (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">inaktiv</span>
                      )}
                    </td>
                  )}
                  {tab === "checklist" && (
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{t.content.split("\n").filter(l => l.trim()).length} Punkte</span>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditTpl(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Bearbeiten">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(t)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTpl && (
        <TemplateModal
          tpl={editTpl === "new" ? undefined : editTpl}
          tab={tab}
          onClose={() => setEditTpl(null)}
          onSaved={() => { setEditTpl(null); load() }}
        />
      )}
    </div>
  )
}
