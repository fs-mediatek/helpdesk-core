"use client"
import { useState, useEffect } from "react"
import { MapPin, Plus, Loader2, X, Phone, Mail, Building2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface Location {
  id: number
  name: string
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
}

const emptyForm = { name: "", address: "", contact_name: "", contact_phone: "", contact_email: "", notes: "" }

function LocationModal({ loc, onClose, onSaved }: { loc?: Location; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(loc ? {
    name: loc.name, address: loc.address || "", contact_name: loc.contact_name || "",
    contact_phone: loc.contact_phone || "", contact_email: loc.contact_email || "", notes: loc.notes || ""
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name ist erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const url = loc ? `/api/locations/${loc.id}` : "/api/locations"
      const method = loc ? "PUT" : "POST"
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
          <h2 className="text-lg font-semibold">{loc ? "Standort bearbeiten" : "Neuer Standort"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div>
            <label className="text-sm font-medium mb-1 block">Name *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Hauptsitz München" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Adresse</label>
            <input className={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Musterstraße 1, 80333 München" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Ansprechpartner</label>
              <input className={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Max Mustermann" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Telefon</label>
              <input className={inp} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+49 89 ..." />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">E-Mail</label>
            <input type="email" className={inp} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="standort@firma.de" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notizen</label>
            <textarea className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{loc ? "Speichere..." : "Erstelle..."}</> : loc ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LocationsPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [editLoc, setEditLoc] = useState<Location | null | "new">(null)

  const load = () => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(d => { setLocations(Array.isArray(d) ? d : d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (loc: Location) => {
    if (!confirm(`Standort "${loc.name}" wirklich löschen?`)) return
    await fetch(`/api/locations/${loc.id}`, { method: "DELETE" })
    setLocations(prev => prev.filter(l => l.id !== loc.id))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Standorte</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Niederlassungen & Büros verwalten</p>
        </div>
        <Button onClick={() => setEditLoc("new")}><Plus className="h-4 w-4" /> Neuer Standort</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <MapPin className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Standorte vorhanden</p>
          <button onClick={() => setEditLoc("new")} className="mt-3 text-sm text-primary hover:underline">Ersten Standort anlegen</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map(loc => (
            <div key={loc.id} className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow group cursor-pointer" onClick={() => router.push(`/locations/${loc.id}`)}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2 shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{loc.name}</h3>
                  {loc.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{loc.address}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditLoc(loc) }} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Bearbeiten">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); remove(loc) }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {(loc.contact_name || loc.contact_phone || loc.contact_email) && (
                <div className="mt-4 space-y-1.5 border-t pt-3">
                  {loc.contact_name && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{loc.contact_name}</div>}
                  {loc.contact_phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{loc.contact_phone}</div>}
                  {loc.contact_email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3 w-3 shrink-0" />{loc.contact_email}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editLoc && (
        <LocationModal
          loc={editLoc === "new" ? undefined : editLoc}
          onClose={() => setEditLoc(null)}
          onSaved={() => { setEditLoc(null); load() }}
        />
      )}
    </div>
  )
}
