"use client"
import { useState, useEffect } from "react"
import { Package, Plus, Pencil, Trash2, X, Loader2, Search, AlertTriangle, ArrowUp, ArrowDown, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

const CATEGORIES: Record<string, string> = {
  accessory: "Zubehör", consumable: "Verbrauchsmaterial", cable: "Kabel", adapter: "Adapter", spare: "Ersatzteile", other: "Sonstiges"
}

interface Item {
  id: number; name: string; category: string; sku: string | null; location: string | null
  quantity: number; min_quantity: number; unit: string; price: number | null; notes: string | null
  supplier_id: number | null; supplier_name: string | null; active: number
}

const emptyForm = { name: "", category: "accessory", sku: "", location: "Lager", quantity: 0, min_quantity: 0, unit: "Stk.", price: "", notes: "" }

function ItemModal({ item, onClose, onSaved }: { item?: Item; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(item ? {
    name: item.name, category: item.category, sku: item.sku || "", location: item.location || "Lager",
    quantity: item.quantity, min_quantity: item.min_quantity, unit: item.unit, price: item.price?.toString() || "", notes: item.notes || ""
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const body = { ...form, price: form.price ? parseFloat(form.price) : null, quantity: parseInt(String(form.quantity)), min_quantity: parseInt(String(form.min_quantity)) }
      const res = await fetch(item ? `/api/inventory/${item.id}` : "/api/inventory", {
        method: item ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
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
          <h2 className="text-lg font-semibold">{item ? "Artikel bearbeiten" : "Neuer Artikel"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div><label className="text-sm font-medium mb-1 block">Name *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. USB-Hub" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">Kategorie</label>
              <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div><label className="text-sm font-medium mb-1 block">Artikelnummer (SKU)</label>
              <input className={inp} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="ART-001" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-sm font-medium mb-1 block">{item ? "Mindestbestand" : "Anfangsbestand"}</label>
              <input type="number" className={inp} min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Mindestbestand</label>
              <input type="number" className={inp} min="0" value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Einheit</label>
              <input className={inp} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="Stk." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">Lagerort</label>
              <input className={inp} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Lager" /></div>
            <div><label className="text-sm font-medium mb-1 block">Preis (€)</label>
              <input type="number" step="0.01" className={inp} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Notizen</label>
            <textarea className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : item ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StockModal({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"in" | "out" | "correction">("in")
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/inventory/${item.id}/stock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, quantity, reason })
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Bestand anpassen</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">Aktueller Bestand: <span className="font-semibold text-foreground">{item.quantity} {item.unit}</span></div>
          <div>
            <label className="text-sm font-medium mb-2 block">Buchungstyp</label>
            <div className="grid grid-cols-3 gap-2">
              {(["in", "out", "correction"] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${type === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
                  {t === "in" ? <><ArrowUp className="h-3 w-3" />Eingang</> : t === "out" ? <><ArrowDown className="h-3 w-3" />Ausgang</> : <><RotateCcw className="h-3 w-3" />Korrektur</>}
                </button>
              ))}
            </div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Menge</label>
            <input type="number" min="1" className={inp} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} /></div>
          <div><label className="text-sm font-medium mb-1 block">Grund (optional)</label>
            <input className={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="z.B. Lieferung von Amazon" /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buchen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterLow, setFilterLow] = useState(false)
  const [editItem, setEditItem] = useState<Item | null | "new">(null)
  const [stockItem, setStockItem] = useState<Item | null>(null)

  const load = () => {
    fetch("/api/inventory")
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (item: Item) => {
    if (!confirm(`"${item.name}" wirklich löschen?`)) return
    await fetch(`/api/inventory/${item.id}`, { method: "DELETE" })
    setItems(prev => prev.filter(x => x.id !== item.id))
  }

  const filtered = items.filter(i => {
    if (filterLow && !(i.quantity <= i.min_quantity && i.min_quantity > 0)) return false
    return !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku || "").toLowerCase().includes(search.toLowerCase())
  })

  const lowCount = items.filter(i => i.quantity <= i.min_quantity && i.min_quantity > 0).length

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Lager & Zubehör verwalten</p>
        </div>
        <Button onClick={() => setEditItem("new")}><Plus className="h-4 w-4" /> Neuer Artikel</Button>
      </div>

      {lowCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-500/5 px-4 py-3 flex items-center gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 dark:text-amber-400"><strong>{lowCount}</strong> Artikel unter Mindestbestand</span>
          <button onClick={() => setFilterLow(v => !v)} className="ml-auto text-xs text-amber-700 dark:text-amber-400 hover:underline">
            {filterLow ? "Alle anzeigen" : "Nur diese anzeigen"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="flex h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Artikel suchen..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Artikel</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kategorie</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bestand</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lagerort</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(item => {
                const isLow = item.min_quantity > 0 && item.quantity <= item.min_quantity
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 shrink-0 ${isLow ? "bg-amber-500/10" : "bg-primary/10"}`}>
                          <Package className={`h-4 w-4 ${isLow ? "text-amber-600" : "text-primary"}`} />
                        </div>
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{CATEGORIES[item.category] || item.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${isLow ? "text-amber-600" : ""}`}>{item.quantity}</span>
                        <span className="text-muted-foreground text-xs">{item.unit}</span>
                        {isLow && <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />Min: {item.min_quantity}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.location || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setStockItem(item)} className="px-2 py-1 rounded-lg text-xs hover:bg-muted transition-colors text-muted-foreground border" title="Bestand anpassen">
                          ±
                        </button>
                        <button onClick={() => setEditItem(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Bearbeiten">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(item)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors" title="Löschen">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">{filterLow ? "Keine Artikel unter Mindestbestand" : "Keine Artikel vorhanden"}</p>
              {!filterLow && <button onClick={() => setEditItem("new")} className="mt-3 text-sm text-primary hover:underline">Ersten Artikel anlegen</button>}
            </div>
          )}
        </div>
      )}

      {editItem && (
        <ItemModal item={editItem === "new" ? undefined : editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load() }} />
      )}
      {stockItem && (
        <StockModal item={stockItem} onClose={() => setStockItem(null)} onSaved={() => { setStockItem(null); load() }} />
      )}
    </div>
  )
}
