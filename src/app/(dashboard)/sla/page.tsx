"use client"
import { useState, useEffect } from "react"
import { Clock, Plus, Pencil, Trash2, X, Loader2, Save, ChevronDown, ChevronUp, Zap, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchRoles, type RoleDef } from "@/lib/roles"

interface EscalationLevel {
  level: number
  name: string
  hours_after: number
  notify_roles: string
  color: string
}

interface SlaRule {
  id?: number
  name: string
  type: "ticket" | "order"
  match_category: string | null
  match_department: string | null
  match_priority: string | null
  response_hours: number | null
  resolution_hours: number | null
  active: number
  levels: EscalationLevel[]
}

const EMPTY_RULE: SlaRule = {
  name: "", type: "ticket", match_category: null, match_department: null,
  match_priority: null, response_hours: null, resolution_hours: null, active: 1, levels: []
}

const PRIO_OPTIONS = [
  { value: "", label: "Alle Prioritäten" },
  { value: "critical", label: "Kritisch" },
  { value: "high", label: "Hoch" },
  { value: "medium", label: "Mittel" },
  { value: "low", label: "Niedrig" },
]

const LEVEL_COLORS = ["#f59e0b", "#ef4444", "#dc2626", "#991b1b"]

function RuleModal({ rule, roles, departments, onClose, onSaved }: { rule?: SlaRule; roles: RoleDef[]; departments: { id: number; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SlaRule>(rule ? { ...rule, levels: [...(rule.levels || [])] } : { ...EMPTY_RULE })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const addLevel = () => {
    const nextNum = form.levels.length + 1
    setForm(f => ({
      ...f,
      levels: [...f.levels, {
        level: nextNum,
        name: `Eskalation Stufe ${nextNum}`,
        hours_after: (f.levels[f.levels.length - 1]?.hours_after || 0) + 24,
        notify_roles: "",
        color: LEVEL_COLORS[Math.min(nextNum - 1, LEVEL_COLORS.length - 1)],
      }]
    }))
  }

  const updateLevel = (i: number, key: string, value: any) => {
    setForm(f => {
      const levels = [...f.levels]
      levels[i] = { ...levels[i], [key]: value }
      return { ...f, levels }
    })
  }

  const removeLevel = (i: number) => {
    setForm(f => ({ ...f, levels: f.levels.filter((_, idx) => idx !== i) }))
  }

  const save = async () => {
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const body = {
        ...form,
        match_category: form.match_category || null,
        match_department: form.match_department || null,
        match_priority: form.match_priority || null,
      }
      const res = await fetch(rule?.id ? `/api/sla/${rule.id}` : "/api/sla", {
        method: rule?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleRole = (levelIdx: number, roleKey: string) => {
    const current = (form.levels[levelIdx]?.notify_roles || "").split(",").filter(Boolean)
    const next = current.includes(roleKey) ? current.filter(r => r !== roleKey) : [...current, roleKey]
    updateLevel(levelIdx, "notify_roles", next.join(","))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{rule?.id ? "SLA-Regel bearbeiten" : "Neue SLA-Regel"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Name *</label>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Standard-SLA" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Typ</label>
              <select className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
                <option value="ticket">Tickets</option>
                <option value="order">Bestellungen</option>
              </select>
            </div>
          </div>

          {/* Match criteria */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zuordnungskriterien</p>
            <p className="text-xs text-muted-foreground">Leer = gilt für alle. Mehrere Kriterien = alle müssen zutreffen.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Kategorie</label>
                <input className={inp + " text-xs"} value={form.match_category || ""} onChange={e => setForm(f => ({ ...f, match_category: e.target.value }))} placeholder="Alle" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Abteilung</label>
                <select className={inp + " text-xs"} value={form.match_department || ""} onChange={e => setForm(f => ({ ...f, match_department: e.target.value }))}>
                  <option value="">Alle Abteilungen</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{(d as any).display_name || d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Priorität</label>
                <select className={inp + " text-xs"} value={form.match_priority || ""} onChange={e => setForm(f => ({ ...f, match_priority: e.target.value }))}>
                  {PRIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Time targets */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Erste Reaktion (Std.)</label>
              <input type="number" step="0.5" className={inp} value={form.response_hours ?? ""} onChange={e => setForm(f => ({ ...f, response_hours: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="z.B. 4" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Lösung / Abschluss (Std.)</label>
              <input type="number" step="0.5" className={inp} value={form.resolution_hours ?? ""} onChange={e => setForm(f => ({ ...f, resolution_hours: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="z.B. 24" />
            </div>
          </div>

          {/* Escalation levels (especially for orders) */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Eskalationsstufen</p>
                <p className="text-xs text-muted-foreground mt-0.5">Zeitspannen nach Erstellung, ab denen eskaliert wird.</p>
              </div>
              <Button variant="outline" size="sm" onClick={addLevel}><Plus className="h-3.5 w-3.5" /> Stufe</Button>
            </div>

            {form.levels.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Keine Eskalationsstufen definiert</p>
            )}

            {form.levels.map((lvl, i) => (
              <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: lvl.color }}>
                    {i + 1}
                  </div>
                  <input className={inp + " flex-1 text-sm font-medium"} value={lvl.name} onChange={e => updateLevel(i, "name", e.target.value)} />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">nach</span>
                    <input type="number" step="0.5" className={inp + " w-20 text-center"} value={lvl.hours_after} onChange={e => updateLevel(i, "hours_after", parseFloat(e.target.value) || 0)} />
                    <span className="text-xs text-muted-foreground">Std.</span>
                  </div>
                  <button onClick={() => removeLevel(i)} className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Benachrichtigen:</p>
                  <div className="flex flex-wrap gap-1">
                    {roles.map(r => {
                      const active = (lvl.notify_roles || "").split(",").includes(r.key_name)
                      return (
                        <button key={r.key_name} type="button" onClick={() => toggleRole(i, r.key_name)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all ${
                            active ? (r.color || "bg-primary/10 text-primary border-primary/30") : "border-muted text-muted-foreground/50 hover:text-muted-foreground"
                          }`}>
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <Button onClick={save} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : <><Save className="h-4 w-4" />{rule?.id ? "Speichern" : "Erstellen"}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SlaPage() {
  const [rules, setRules] = useState<SlaRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editRule, setEditRule] = useState<SlaRule | null | "new">(null)
  const [tab, setTab] = useState<"ticket" | "order">("ticket")
  const [roles, setRoles] = useState<RoleDef[]>([])

  const load = () => {
    setLoading(true)
    fetch("/api/sla")
      .then(r => r.json())
      .then(d => { setRules(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  useEffect(() => {
    load()
    fetchRoles().then(setRoles)
    fetch("/api/departments").then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const remove = async (rule: SlaRule) => {
    if (!confirm(`SLA "${rule.name}" wirklich löschen?`)) return
    await fetch(`/api/sla/${rule.id}`, { method: "DELETE" })
    load()
  }

  const toggleActive = async (rule: SlaRule) => {
    await fetch(`/api/sla/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, active: rule.active ? 0 : 1 }),
    })
    load()
  }

  const filtered = rules.filter(r => r.type === tab)

  const formatHours = (h: number | null) => {
    if (h === null) return "—"
    if (h < 1) return `${Math.round(h * 60)} Min.`
    if (h >= 24 && h % 24 === 0) return `${h / 24} Tag${h / 24 > 1 ? "e" : ""}`
    return `${h} Std.`
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="h-6 w-6" /> SLA-Verwaltung</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Service Level Agreements für Tickets und Bestellungen</p>
        </div>
        <Button onClick={() => setEditRule("new")}><Plus className="h-4 w-4" /> Neue SLA-Regel</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-muted/30 p-1 w-fit">
        <button onClick={() => setTab("ticket")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "ticket" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Tickets
        </button>
        <button onClick={() => setTab("order")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "order" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Bestellungen
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <Clock className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Keine SLA-Regeln für {tab === "ticket" ? "Tickets" : "Bestellungen"}</p>
          <button onClick={() => setEditRule("new")} className="mt-3 text-sm text-primary hover:underline">Erste Regel erstellen →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rule => (
            <div key={rule.id} className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all ${!rule.active ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Active toggle */}
                <button onClick={() => toggleActive(rule)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${rule.active ? "bg-primary" : "bg-muted-foreground/20"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.active ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{rule.name}</p>
                    {rule.match_category && <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">Kat: {rule.match_category}</span>}
                    {rule.match_department && <span className="text-xs bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5">Abt: {rule.match_department}</span>}
                    {rule.match_priority && <span className="text-xs bg-red-500/10 text-red-600 rounded-full px-2 py-0.5">Prio: {rule.match_priority}</span>}
                    {!rule.match_category && !rule.match_department && !rule.match_priority && (
                      <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">Standard (alle)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {rule.response_hours != null && <span>Reaktion: <strong className="text-foreground">{formatHours(rule.response_hours)}</strong></span>}
                    {rule.resolution_hours != null && <span>Lösung: <strong className="text-foreground">{formatHours(rule.resolution_hours)}</strong></span>}
                    {rule.levels?.length > 0 && <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> {rule.levels.length} Eskalationsstufe{rule.levels.length > 1 ? "n" : ""}</span>}
                  </div>
                </div>

                {/* Escalation level preview */}
                {rule.levels?.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {rule.levels.map((lvl, i) => (
                      <div key={i} title={`${lvl.name}: nach ${lvl.hours_after}h`}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: lvl.color }}>
                        {lvl.hours_after}h
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditRule(rule)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(rule)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editRule && (
        <RuleModal
          rule={editRule === "new" ? undefined : editRule}
          roles={roles}
          departments={departments}
          onClose={() => setEditRule(null)}
          onSaved={() => { setEditRule(null); load() }}
        />
      )}
    </div>
  )
}
