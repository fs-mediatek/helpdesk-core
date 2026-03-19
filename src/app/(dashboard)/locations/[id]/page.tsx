"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { MapPin, Phone, Mail, Building2, ArrowLeft, Package, Ticket, Loader2, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"

function LocationMap({ address }: { address: string }) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!address) return
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
      headers: { "Accept-Language": "de" }
    })
      .then(r => r.json())
      .then(data => {
        if (data[0]) setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
        else setError(true)
      })
      .catch(() => setError(true))
  }, [address])

  if (!address) return null
  if (error) return (
    <div className="rounded-xl border bg-muted/30 flex items-center justify-center h-48 text-sm text-muted-foreground">
      Karte konnte nicht geladen werden
    </div>
  )
  if (!coords) return (
    <div className="rounded-xl border bg-muted/30 flex items-center justify-center h-48">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  const { lat, lon } = coords
  const delta = 0.005
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`

  return (
    <iframe
      src={src}
      className="w-full h-64 rounded-xl border"
      loading="lazy"
      title="Standort auf Karte"
    />
  )
}

function EditModal({ loc, onClose, onSaved }: { loc: any; onClose: () => void; onSaved: (updated: any) => void }) {
  const [form, setForm] = useState({
    name: loc.name, address: loc.address || "", contact_name: loc.contact_name || "",
    contact_phone: loc.contact_phone || "", contact_email: loc.contact_email || "", notes: loc.notes || ""
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved({ ...loc, ...form })
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Standort bearbeiten</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-3">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}
          <div><label className="text-sm font-medium mb-1 block">Name *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="text-sm font-medium mb-1 block">Adresse</label>
            <input className={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Musterstraße 1, 80333 München" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium mb-1 block">Ansprechpartner</label>
              <input className={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div><label className="text-sm font-medium mb-1 block">Telefon</label>
              <input className={inp} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">E-Mail</label>
            <input type="email" className={inp} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
          <div><label className="text-sm font-medium mb-1 block">Notizen</label>
            <textarea className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loc, setLoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetch(`/api/locations/${id}`)
      .then(r => r.json())
      .then(d => { setLoc(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!loc || loc.error) return <div className="text-muted-foreground py-16 text-center">Standort nicht gefunden.</div>

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/locations")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="rounded-xl bg-primary/10 p-3">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{loc.name}</h1>
            {loc.address && <p className="text-muted-foreground text-sm mt-0.5">{loc.address}</p>}
          </div>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" /> Bearbeiten
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2"><Package className="h-4 w-4 text-blue-600" /></div>
            <div>
              <div className="text-2xl font-bold">{loc.asset_count ?? 0}</div>
              <div className="text-sm text-muted-foreground">Assets</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2"><Ticket className="h-4 w-4 text-amber-600" /></div>
            <div>
              <div className="text-2xl font-bold">{loc.open_tickets ?? 0}</div>
              <div className="text-sm text-muted-foreground">Offene Tickets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact + Map */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Contact info */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Kontakt</h2>
          {loc.contact_name && (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{loc.contact_name}</span>
            </div>
          )}
          {loc.contact_phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${loc.contact_phone}`} className="text-sm hover:text-primary transition-colors">{loc.contact_phone}</a>
            </div>
          )}
          {loc.contact_email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${loc.contact_email}`} className="text-sm hover:text-primary transition-colors">{loc.contact_email}</a>
            </div>
          )}
          {!loc.contact_name && !loc.contact_phone && !loc.contact_email && (
            <p className="text-sm text-muted-foreground">Kein Ansprechpartner hinterlegt</p>
          )}
          {loc.notes && (
            <div className="border-t pt-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-1">Notizen</h3>
              <p className="text-sm">{loc.notes}</p>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Karte</h2>
          {loc.address ? (
            <LocationMap address={loc.address} />
          ) : (
            <div className="rounded-xl border bg-muted/30 flex items-center justify-center h-48 text-sm text-muted-foreground">
              Keine Adresse hinterlegt
            </div>
          )}
          {loc.address && (
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(loc.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              In OpenStreetMap öffnen ↗
            </a>
          )}
        </div>
      </div>

      {editing && (
        <EditModal
          loc={loc}
          onClose={() => setEditing(false)}
          onSaved={updated => { setLoc((prev: any) => ({ ...prev, ...updated })); setEditing(false) }}
        />
      )}
    </div>
  )
}
