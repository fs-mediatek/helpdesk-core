"use client"
import { useState, useEffect, useRef } from "react"
import { Plus, Pencil, Trash2, X, Loader2, Search, Package, Monitor, Upload, CheckCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { usePathname } from "next/navigation"

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; color: string; href: string }> = {
  windows: { label: "Windows", emoji: "🪟", color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800", href: "/assets/windows" },
  ios: { label: "iOS / iPadOS", emoji: "🍎", color: "bg-gray-500/10 text-gray-600 border-gray-300 dark:border-gray-700", href: "/assets/ios" },
  android: { label: "Android", emoji: "🤖", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800", href: "/assets/android" },
  other: { label: "Sonstiges", emoji: "📦", color: "bg-muted text-muted-foreground border-muted", href: "/assets" },
}

const STATUS_CONFIG: Record<string, { label: string; variant: string }> = {
  available: { label: "Verfügbar", variant: "success" },
  assigned: { label: "Zugewiesen", variant: "info" },
  maintenance: { label: "Wartung", variant: "warning" },
  retired: { label: "Ausgemustert", variant: "destructive" },
}

const DEVICE_TYPES = ["Laptop", "Desktop", "Smartphone", "Tablet", "Server", "Drucker", "Sonstiges"]

// ─── CSV Parser ───
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current); current = ""; continue }
    current += ch
  }
  result.push(current)
  return result
}
function parseCSV(text: string): Record<string, string>[] {
  const raw = text.replace(/^\uFEFF/, "")
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || "").trim()]))
  })
}

// ─── CSV Import Modal ───
function CsvImportModal({ platform, onClose, onDone }: { platform: string; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target?.result as string)
        if (parsed.length === 0) { setError("CSV konnte nicht gelesen werden"); return }
        if (!parsed[0]["Device name"]) { setError("Spalte 'Device name' nicht gefunden. Ist dies ein Intune-Export?"); return }
        setRows(parsed)
      } catch { setError("CSV-Datei konnte nicht verarbeitet werden") }
    }
    reader.readAsText(file, "utf-8")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const startImport = async () => {
    setImporting(true); setError(null)
    try {
      const BATCH = 50
      let totalImported = 0, totalUpdated = 0
      const allUserMatches: any[] = []
      const allPhoneMatches: any[] = []
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const res = await fetch("/api/assets/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch, platform }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Import fehlgeschlagen")
        totalImported += data.imported
        totalUpdated += data.updated
        if (data.userMatches) allUserMatches.push(...data.userMatches)
        if (data.phoneMatches) allPhoneMatches.push(...data.phoneMatches)
      }
      setResult({ imported: totalImported, updated: totalUpdated, total: rows.length, userMatches: allUserMatches, phoneMatches: allPhoneMatches })
    } catch (e: any) { setError(e.message) } finally { setImporting(false) }
  }

  // Preview: first 5 rows
  const preview = rows.slice(0, 5)
  const previewCols = platform === "android"
    ? ["Device name", "Serial number", "Manufacturer", "Model", "Phone number", "Primary user email address"]
    : ["Device name", "Serial number", "Manufacturer", "Model", "Primary user email address"]
  const colLabels: Record<string, string> = {
    "Device name": "Gerätename", "Serial number": "Seriennr.", "Manufacturer": "Hersteller",
    "Model": "Modell", "Primary user email address": "E-Mail", "Phone number": "Telefon",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Upload className="h-5 w-5" /> CSV-Import (Intune)</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          {result ? (
            /* ─── Result ─── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-emerald-600">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="font-semibold text-lg">Import abgeschlossen</p>
                  <p className="text-sm text-muted-foreground">{result.total} Geräte verarbeitet</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-4">
                  <p className="text-2xl font-bold text-emerald-600">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">Neu importiert</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-muted-foreground">Aktualisiert</p>
                </div>
              </div>
              {result.userMatches?.length > 0 && (
                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium mb-2">Benutzer-Zuordnungen ({result.userMatches.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.userMatches.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{m.deviceName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{m.userName}</span>
                        <span className="text-muted-foreground">({m.email})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.phoneMatches?.length > 0 && (
                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium mb-2">Mobilfunkvertrag-Zuordnungen ({result.phoneMatches.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.phoneMatches.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-mono">{m.deviceName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{m.phone}</span>
                        {m.contractUser && <span className="text-muted-foreground">({m.contractUser})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-2 border-t">
                <Button onClick={() => { onDone(); onClose() }}>Schließen</Button>
              </div>
            </div>
          ) : rows.length === 0 ? (
            /* ─── File selection ─── */
            <div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">CSV-Datei hierher ziehen</p>
                <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
                <p className="text-xs text-muted-foreground mt-3">Intune-Export: DevicesWithInventory_*.csv</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
            </div>
          ) : (
            /* ─── Preview ─── */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Monitor className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">{rows.length} Geräte erkannt</p>
                  <p className="text-sm text-muted-foreground">Vorschau der ersten {preview.length} Einträge</p>
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {previewCols.map(c => (
                        <th key={c} className="text-left px-3 py-2 font-medium text-muted-foreground">{colLabels[c] || c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        {previewCols.map(c => (
                          <td key={c} className="px-3 py-2 truncate max-w-[180px]">{row[c] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  Vorhandene Geräte (gleiche Seriennr. oder Intune-ID) werden aktualisiert. Neue Geräte werden angelegt.
                  Bekannte E-Mail-Adressen werden automatisch zugeordnet.
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <button onClick={() => setRows([])} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  Andere Datei
                </button>
                <Button onClick={startImport} disabled={importing}>
                  {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importiere {rows.length} Geräte...</> : <>Import starten ({rows.length} Geräte)</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Asset Modal ───
function AssetModal({ asset, suppliers, onClose, onSaved }: { asset?: any; suppliers: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: asset?.name || "",
    asset_tag: asset?.asset_tag || "",
    type: asset?.type || "Laptop",
    platform: asset?.platform || "windows",
    status: asset?.status || "available",
    model: asset?.model || "",
    manufacturer: asset?.manufacturer || "",
    serial_number: asset?.serial_number || "",
    notes: asset?.notes || "",
    purchase_price: asset?.purchase_price || "",
    supplier_id: asset?.supplier_id || "",
    invoice_number: asset?.invoice_number || "",
    commissioned_at: asset?.commissioned_at ? (asset.commissioned_at as string).substring(0, 10) : "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const body = {
        ...form,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        commissioned_at: form.commissioned_at || null,
      }
      const res = await fetch(asset ? `/api/assets/${asset.id}` : "/api/assets", {
        method: asset ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          <h2 className="text-lg font-semibold">{asset ? "Asset bearbeiten" : "Neues Asset"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Name *</label>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. N-2024-PF1N0SB3" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Asset Tag</label>
              <input className={inp} value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} placeholder="z.B. AST-0042" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Plattform</label>
              <select className={inp} value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                {Object.entries(PLATFORM_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Gerätetyp</label>
              <select className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Hersteller</label>
              <input className={inp} value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="z.B. LENOVO" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Modell</label>
              <input className={inp} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="z.B. ThinkPad X1 Carbon" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Seriennummer</label>
              <input className={inp} value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="z.B. PF1N0SB3" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select className={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* ─── Beschaffung ─── */}
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Beschaffung</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Preis (EUR)</label>
                <input type="number" step="0.01" className={inp} value={form.purchase_price}
                  onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Händler</label>
                <select className={inp} value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">— Kein Händler —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Rechnungsnummer</label>
                <input className={inp} value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="z.B. RE-2025-001" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Erstinbetriebnahme</label>
                <input type="date" className={inp} value={form.commissioned_at}
                  onChange={e => setForm(f => ({ ...f, commissioned_at: e.target.value }))} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Notizen</label>
            <textarea rows={2}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Zusätzliche Informationen..." />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : asset ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main ───
export function AssetsClient({ platform }: { platform?: string }) {
  const pathname = usePathname()
  const [assets, setAssets] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [session, setSession] = useState<any>(null)
  const [editAsset, setEditAsset] = useState<any | null | "new">(null)
  const [showImport, setShowImport] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (platform) params.set("platform", platform)
    const [data, me, sup] = await Promise.all([
      fetch(`/api/assets?${params}`).then(r => r.json()).catch(() => []),
      fetch("/api/auth/me").then(r => r.json()).catch(() => null),
      fetch("/api/suppliers").then(r => r.json()).catch(() => []),
    ])
    setAssets(Array.isArray(data) ? data : [])
    setSession(me)
    setSuppliers(Array.isArray(sup) ? sup : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [platform])

  const roles: string[] = session?.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const canEdit = roles.some(r => ["admin", "agent"].includes(r))
  const isAdmin = roles.includes("admin")

  const remove = async (a: any) => {
    if (!confirm(`"${a.name}" wirklich löschen?`)) return
    await fetch(`/api/assets/${a.id}`, { method: "DELETE" })
    setAssets(prev => prev.filter(x => x.id !== a.id))
  }

  const filtered = assets.filter(a =>
    (statusFilter === "all" || a.status === statusFilter) &&
    (!search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_tag?.toLowerCase().includes(search.toLowerCase()) ||
      a.model?.toLowerCase().includes(search.toLowerCase()) ||
      a.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
      a.assigned_to_name?.toLowerCase().includes(search.toLowerCase()))
  )

  const platformInfo = platform ? PLATFORM_CONFIG[platform] : null
  const stats = {
    total: assets.length,
    available: assets.filter(a => a.status === "available").length,
    assigned: assets.filter(a => a.assigned_to_user_id != null).length,
  }
  const platformCounts = !platform
    ? Object.fromEntries(Object.keys(PLATFORM_CONFIG).map(p => [p, assets.filter(a => (a.platform || "other") === p).length]))
    : null

  const TABS = [
    { href: "/assets", label: "Alle", icon: <Monitor className="h-3.5 w-3.5" />, active: !platform },
    { href: "/assets/windows", label: "Windows", icon: <span>🪟</span>, active: platform === "windows" },
    { href: "/assets/ios", label: "iOS / iPadOS", icon: <span>🍎</span>, active: platform === "ios" },
    { href: "/assets/android", label: "Android", icon: <span>🤖</span>, active: platform === "android" },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {platformInfo ? <>{platformInfo.emoji} {platformInfo.label}</> : "Assets"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {platformInfo ? `${platformInfo.label}-Geräte verwalten` : "IT-Hardware & Geräteverwaltung"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (platform === "windows" || platform === "android") && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" /> CSV-Import
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setEditAsset("new")}><Plus className="h-4 w-4" /> Neues Asset</Button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border bg-muted/30 p-1 w-fit">
        {TABS.map(tab => (
          <Link key={tab.href} href={tab.href}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              tab.active ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Platform overview cards (all-view only) */}
      {!platform && platformCounts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["windows", "ios", "android", "other"] as const).map(key => {
            const cfg = PLATFORM_CONFIG[key]
            return (
              <Link key={key} href={key === "other" ? "/assets" : cfg.href}
                className="rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <span className="text-2xl font-bold">{platformCounts[key]}</span>
                </div>
                <p className="text-sm font-medium">{cfg.label}</p>
                <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors mt-0.5">Anzeigen →</p>
              </Link>
            )
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Geräte gesamt</p>
          <p className="text-2xl font-bold mt-0.5">{stats.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-emerald-600 font-medium">Verfügbar</p>
          <p className="text-2xl font-bold mt-0.5 text-emerald-600">{stats.available}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-blue-600 font-medium">Zugewiesen</p>
          <p className="text-2xl font-bold mt-0.5 text-blue-600">{stats.assigned}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Name, Seriennr., Hersteller, Modell..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="flex h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">Alle Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">Keine Assets gefunden</p>
            {canEdit && (
              <button onClick={() => setEditAsset("new")} className="mt-3 text-sm text-primary hover:underline">
                Erstes Asset anlegen →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Gerät</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Hersteller / Modell</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Seriennr.</th>
                {!platform && <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Plattform</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Zugewiesen an</th>
                {canEdit && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(a => {
                const plat = PLATFORM_CONFIG[a.platform || "other"] || PLATFORM_CONFIG.other
                const status = STATUS_CONFIG[a.status] || { label: a.status, variant: "secondary" }
                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center text-xl shrink-0">
                          {plat.emoji}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{a.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {a.asset_tag && <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{a.asset_tag}</span>}
                            {a.type && <span className="text-[10px] text-muted-foreground">{a.type}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.manufacturer && <p className="text-xs font-semibold">{a.manufacturer}</p>}
                      {a.model && <p className="text-xs text-muted-foreground">{a.model}</p>}
                      {!a.manufacturer && !a.model && <span className="text-muted-foreground opacity-30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {a.serial_number ? (
                        <span className="font-mono text-xs">{a.serial_number}</span>
                      ) : (
                        <span className="text-muted-foreground opacity-30">—</span>
                      )}
                    </td>
                    {!platform && (
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${plat.color}`}>
                          {plat.emoji} {plat.label}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Badge variant={status.variant as any}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {a.assigned_to_name ?? <span className="opacity-30">—</span>}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditAsset(a)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => remove(a)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {editAsset && (
        <AssetModal
          asset={editAsset === "new" ? undefined : editAsset}
          suppliers={suppliers}
          onClose={() => setEditAsset(null)}
          onSaved={() => { setEditAsset(null); load() }}
        />
      )}

      {showImport && (
        <CsvImportModal platform={platform || "windows"} onClose={() => setShowImport(false)} onDone={load} />
      )}
    </div>
  )
}
