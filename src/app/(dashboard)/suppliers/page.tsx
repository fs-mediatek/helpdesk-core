"use client"
import { useState, useEffect } from "react"
import { Truck, Plus, Pencil, Trash2, X, Loader2, Phone, Mail, Globe, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Supplier {
  id: number; name: string; contact_name: string | null; contact_email: string | null
  contact_phone: string | null; website: string | null; address: string | null
  customer_number: string | null; notes: string | null; active: number
}

const emptyForm = { name: "", contact_name: "", contact_email: "", contact_phone: "", website: "", address: "", customer_number: "", notes: "" }

function SupplierModal({ sup, onClose, onSaved }: { sup?: Supplier; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(sup ? {
    name: sup.name, contact_name: sup.contact_name || "", contact_email: sup.contact_email || "",
    contact_phone: sup.contact_phone || "", website: sup.website || "", address: sup.address || "",
    customer_number: sup.customer_number || "", notes: sup.notes || ""
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]))
      const res = await fetch(sup ? `/api/suppliers/${sup.id}` : "/api/suppliers", {
        method: sup ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{sup ? "Lieferant bearbeiten" : "Neuer Lieferant"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div><label className="text-sm font-medium mb-1 block">Firmenname *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Dell GmbH" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">Ansprechpartner</label>
              <input className={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Kundennummer</label>
              <input className={inp} value={form.customer_number} onChange={e => setForm(f => ({ ...f, customer_number: e.target.value }))} placeholder="KD-12345" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">E-Mail</label>
              <input type="email" className={inp} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Telefon</label>
              <input className={inp} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Website</label>
            <input className={inp} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." /></div>
          <div><label className="text-sm font-medium mb-1 block">Adresse</label>
            <input className={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="text-sm font-medium mb-1 block">Notizen</label>
            <textarea className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : sup ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [editSup, setEditSup] = useState<Supplier | null | "new">(null)

  const load = () => {
    fetch("/api/suppliers")
      .then(r => r.json())
      .then(d => { setSuppliers(Array.isArray(d) ? d : d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (sup: Supplier) => {
    if (!confirm(`Lieferant "${sup.name}" wirklich löschen?`)) return
    await fetch(`/api/suppliers/${sup.id}`, { method: "DELETE" })
    setSuppliers(prev => prev.filter(s => s.id !== sup.id))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lieferanten</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Lieferantenverwaltung</p>
        </div>
        <Button onClick={() => setEditSup("new")}><Plus className="h-4 w-4" /> Neuer Lieferant</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <Truck className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Lieferanten vorhanden</p>
          <button onClick={() => setEditSup("new")} className="mt-3 text-sm text-primary hover:underline">Ersten Lieferanten anlegen</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map(sup => (
            <div key={sup.id} className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2 shrink-0">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{sup.name}</h3>
                  {sup.customer_number && <p className="text-xs text-muted-foreground mt-0.5">KD: {sup.customer_number}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setEditSup(sup)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Bearbeiten">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(sup)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {(sup.contact_name || sup.contact_phone || sup.contact_email || sup.website) && (
                <div className="mt-4 space-y-1.5 border-t pt-3">
                  {sup.contact_name && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Hash className="h-3 w-3 shrink-0" />{sup.contact_name}</div>}
                  {sup.contact_phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{sup.contact_phone}</div>}
                  {sup.contact_email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><a href={`mailto:${sup.contact_email}`} className="hover:text-primary transition-colors truncate">{sup.contact_email}</a></div>}
                  {sup.website && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe className="h-3 w-3 shrink-0" /><a href={sup.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors truncate">{sup.website.replace(/^https?:\/\//, "")}</a></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editSup && (
        <SupplierModal sup={editSup === "new" ? undefined : editSup} onClose={() => setEditSup(null)} onSaved={() => { setEditSup(null); load() }} />
      )}
    </div>
  )
}
