"use client"
import { useState, useEffect } from "react"
import { FileText, Plus, Search, Loader2, X, Trash2, Copy, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const CATEGORIES = ["Allgemein", "Hardware", "Software", "Netzwerk", "Passwort", "Drucker", "E-Mail", "Sonstiges"]

interface Template {
  id: number
  title: string
  content: string
  category: string | null
  tags: string | null
  created_by_name?: string
}

const emptyForm = { title: "", content: "", category: "", tags: "" }

function TemplateModal({ tpl, onClose, onSaved }: { tpl?: Template; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(tpl ? {
    title: tpl.title, content: tpl.content, category: tpl.category || "", tags: tpl.tags || ""
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) { setError("Titel und Inhalt erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const url = tpl ? `/api/templates/${tpl.id}` : "/api/templates"
      const method = tpl ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{tpl ? "Vorlage bearbeiten" : "Neue Vorlage"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div>
            <label className="text-sm font-medium mb-1 block">Titel *</label>
            <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Passwort zurücksetzen" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Kategorie</label>
              <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Keine Kategorie</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tags</label>
              <input className={inp} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="passwort, reset, ad" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Inhalt *</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={7}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Vorlagentext..."
            />
          </div>
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
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editTpl, setEditTpl] = useState<Template | null | "new">(null)
  const [copied, setCopied] = useState<number | null>(null)

  const load = () => {
    const p = new URLSearchParams()
    if (search) p.set("search", search)
    fetch(`/api/templates?${p}`)
      .then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [search])

  const copy = (t: Template) => {
    navigator.clipboard.writeText(t.content)
    setCopied(t.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const remove = async (t: Template) => {
    if (!confirm(`Vorlage "${t.title}" wirklich löschen?`)) return
    await fetch(`/api/templates/${t.id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Antwortvorlagen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vorgefertigte Antworten verwalten</p>
        </div>
        <Button onClick={() => setEditTpl("new")}><Plus className="h-4 w-4" /> Neue Vorlage</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Vorlagen suchen..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Vorlagen vorhanden</p>
          <button onClick={() => setEditTpl("new")} className="mt-3 text-sm text-primary hover:underline">Erste Vorlage erstellen</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <div key={t.id} className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditTpl(t)}>
                  <h3 className="font-medium text-sm truncate hover:text-primary transition-colors">{t.title}</h3>
                  {t.category && <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.category}</span>}
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditTpl(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Bearbeiten">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => copy(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Kopieren">
                    {copied === t.id ? <span className="text-xs text-emerald-600 font-bold">✓</span> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => remove(t)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{t.content}</p>
              {t.tags && <p className="text-xs text-muted-foreground/60 truncate">{t.tags}</p>}
            </div>
          ))}
        </div>
      )}

      {editTpl && (
        <TemplateModal
          tpl={editTpl === "new" ? undefined : editTpl}
          onClose={() => setEditTpl(null)}
          onSaved={() => { setEditTpl(null); load() }}
        />
      )}
    </div>
  )
}
