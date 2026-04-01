"use client"
import { useState, useEffect, useRef } from "react"
import { GitBranch, Plus, Pencil, Trash2, X, Loader2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Users, Zap, Package, UserPlus, UserMinus, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchRoles, type RoleDef } from "@/lib/roles"

const COLOR_OPTIONS = [
  { value: "blue", label: "Blau", cls: "bg-blue-500" },
  { value: "purple", label: "Lila", cls: "bg-purple-500" },
  { value: "green", label: "Grün", cls: "bg-emerald-500" },
  { value: "amber", label: "Orange", cls: "bg-amber-500" },
  { value: "red", label: "Rot", cls: "bg-red-500" },
  { value: "teal", label: "Türkis", cls: "bg-teal-500" },
]

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600 border-blue-200",
  purple: "bg-purple-500/10 text-purple-600 border-purple-200",
  green: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  amber: "bg-amber-500/10 text-amber-600 border-amber-200",
  red: "bg-red-500/10 text-red-600 border-red-200",
  teal: "bg-teal-500/10 text-teal-600 border-teal-200",
}

// Roles loaded dynamically — see WorkflowsPage component

const ACTION_TYPES = [
  { value: "none", label: "Kein (manuell fortschreiten)" },
  { value: "cost_entry", label: "Kosteneingabe" },
  { value: "approval", label: "Genehmigung (mit Ablehnung)" },
  { value: "asset_assign", label: "Asset-Zuweisung" },
  { value: "access_code_gen", label: "Zugangscode generieren" },
  { value: "access_code_confirm", label: "Zugangscode bestätigen" },
]

interface Step {
  step_name: string
  description: string
  assigned_roles: string
  action_type: string
}

interface Category {
  id: number
  name: string
  description: string | null
  color: string
  steps: Step[]
}

function RoleChips({ selected, onChange, roles }: { selected: string[]; onChange: (roles: string[]) => void; roles: RoleDef[] }) {
  const toggle = (role: string) =>
    onChange(selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role])
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map(r => {
        const active = selected.includes(r.key_name)
        return (
          <button
            key={r.key_name}
            type="button"
            onClick={() => toggle(r.key_name)}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-all ${
              active ? (r.color || "bg-primary/10 text-primary border-primary/30") : "border-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

function StepEditor({ steps, onChange, roles }: { steps: Step[]; onChange: (steps: Step[]) => void; roles: RoleDef[] }) {
  const add = () => onChange([...steps, { step_name: "", description: "", assigned_roles: "", action_type: "none" }])
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof Step, val: string) =>
    onChange(steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...steps]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }
  const inp = "flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const selectedRoles = step.assigned_roles ? step.assigned_roles.split(",").map(r => r.trim()).filter(Boolean) : []
        return (
          <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors">
                  <ArrowUp className="h-3 w-3 text-muted-foreground" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors">
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
              <input
                className={inp + " flex-1"}
                value={step.step_name}
                onChange={e => update(i, "step_name", e.target.value)}
                placeholder={`Schritt ${i + 1} (z.B. Genehmigung durch Führungskraft)`}
              />
              <button type="button" onClick={() => remove(i)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="pl-10 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sonderaktion</label>
                <select
                  className={inp + " text-xs"}
                  value={step.action_type || "none"}
                  onChange={e => update(i, "action_type", e.target.value)}
                >
                  {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Beschreibung (optional)</label>
                <input
                  className={inp + " text-xs"}
                  value={step.description}
                  onChange={e => update(i, "description", e.target.value)}
                  placeholder="Kurze Beschreibung..."
                />
              </div>
            </div>
            <div className="pl-10">
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1 block">
                <Users className="h-3 w-3" /> Benutzergruppen (wer bearbeitet diesen Schritt)
              </label>
              <RoleChips
                selected={selectedRoles}
                onChange={r => update(i, "assigned_roles", r.join(","))}
                roles={roles}
              />
            </div>
          </div>
        )
      })}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
        <Plus className="h-3.5 w-3.5" /> Schritt hinzufügen
      </button>
    </div>
  )
}

function CategoryModal({ cat, roles, onClose, onSaved }: { cat?: Category; roles: RoleDef[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: cat?.name || "",
    description: cat?.description || "",
    color: cat?.color || "blue",
    steps: cat?.steps?.length
      ? cat.steps.map(s => ({
          step_name: s.step_name,
          description: (s as any).description || "",
          assigned_roles: (s as any).assigned_roles || "",
          action_type: (s as any).action_type || "none",
        }))
      : [
          { step_name: "Anfrage eingegangen", description: "", assigned_roles: "user", action_type: "none" },
          { step_name: "In Prüfung", description: "", assigned_roles: "agent", action_type: "cost_entry" },
          { step_name: "Genehmigung", description: "", assigned_roles: "fuehrungskraft", action_type: "approval" },
          { step_name: "Bestellung aufgegeben", description: "", assigned_roles: "agent", action_type: "none" },
          { step_name: "Asset zuweisen", description: "", assigned_roles: "agent", action_type: "asset_assign" },
          { step_name: "Zugangscode generieren", description: "", assigned_roles: "agent", action_type: "access_code_gen" },
          { step_name: "Übergabe bestätigen", description: "", assigned_roles: "agent", action_type: "access_code_confirm" },
        ]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    const validSteps = form.steps.filter(s => s.step_name.trim())
    if (validSteps.length === 0) { setError("Mindestens ein Schritt erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(cat ? `/api/order-categories/${cat.id}` : "/api/order-categories", {
        method: cat ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, steps: validSteps })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{cat ? "Produktklasse bearbeiten" : "Neue Produktklasse"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Name *</label>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Hardware, Software, Büromaterial" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Farbe</label>
              <div className="flex gap-2 mt-1">
                {COLOR_OPTIONS.map(c => (
                  <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, color: c.value }))}
                    className={`h-7 w-7 rounded-full ${c.cls} transition-all ${form.color === c.value ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"}`}
                    title={c.label} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Beschreibung</label>
            <input className={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Wofür wird diese Kategorie verwendet?" />
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">Workflow-Schritte *</label>
            <StepEditor steps={form.steps} onChange={steps => setForm(f => ({ ...f, steps }))} roles={roles} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : cat ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  none: "", cost_entry: "Kosten", approval: "Genehmigung", asset_assign: "Asset",
  access_code_gen: "Code-Gen", access_code_confirm: "Code-Bestätigung"
}

// ── Products Tab ─────────────────────────────────────────────────────────────

function ProductWorkflowModal({ product, categories, roles, onClose, onSaved }: { roles: RoleDef[];
  product: any; categories: Category[]; onClose: () => void; onSaved: () => void
}) {
  const [categoryId, setCategoryId] = useState(product.category_id ? String(product.category_id) : "")
  const [saving, setSaving] = useState(false)
  const selectedCat = categories.find(c => String(c.id) === categoryId)

  const save = async () => {
    setSaving(true)
    await fetch(`/api/catalog/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: product.name,
        description: product.description,
        category_id: categoryId ? parseInt(categoryId) : null,
        inventory_item_id: product.inventory_item_id,
        emoji: product.emoji,
        price_estimate: product.price_estimate,
        sort_order: product.sort_order,
        requires_description: product.requires_description,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Workflow für „{product.name}"</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Product preview */}
          <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {product.image_url
                ? <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-2xl">{product.emoji || "📦"}</span>
              }
            </div>
            <div>
              <p className="font-semibold text-sm">{product.name}</p>
              {product.description && <p className="text-xs text-muted-foreground mt-0.5">{product.description}</p>}
            </div>
          </div>

          {/* Category selection */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Produktklasse (Workflow)</label>
            <select
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="">— Standard-Workflow (ohne Genehmigung) —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Workflow step preview */}
          {selectedCat && (selectedCat.steps?.length ?? 0) > 0 && (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow-Schritte</p>
              {selectedCat.steps.map((step, i) => {
                const stepRoles = step.assigned_roles ? step.assigned_roles.split(",").map(r => r.trim()).filter(Boolean) : []
                const needsFK = step.action_type === "approval" && stepRoles.includes("fuehrungskraft")
                const rlMap = Object.fromEntries(roles.map(r => [r.key_name, r.label]))
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 bg-background flex items-center justify-center text-xs text-muted-foreground font-mono shrink-0">
                      {i + 1}
                    </div>
                    <span className={needsFK ? "font-medium" : ""}>{step.step_name}</span>
                    {needsFK && (
                      <span className="ml-auto shrink-0 text-xs bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-800 rounded-full px-1.5 py-0.5">
                        FK-Genehmigung ✓
                      </span>
                    )}
                    {!needsFK && stepRoles.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">{stepRoles.map(r => rlMap[r] || r).join(", ")}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!categoryId && (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/30 border px-3 py-2">
              Ohne Produktklasse wird ein Standard-Workflow ohne Genehmigungsschritte verwendet.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductsTab({ categories, roles }: { categories: Category[]; roles: RoleDef[] }) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editProduct, setEditProduct] = useState<any | null>(null)

  const loadProducts = () => {
    fetch("/api/catalog").then(r => r.json())
      .then(d => { setProducts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(loadProducts, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-amber-500/5 border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        <p className="font-medium mb-0.5">Gemischter Warenkorb — automatische Eskalation</p>
        <p className="text-xs">Enthält ein Warenkorb Produkte aus unterschiedlichen Workflows, wird automatisch der strengste Workflow angewendet. Wenn mindestens ein Produkt eine Führungskraft-Genehmigung erfordert, gilt das für die gesamte Bestellung.</p>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed text-muted-foreground">
          <Package className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Produkte im Katalog</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map(p => {
            const cat = categories.find(c => c.id === p.category_id)
            const colorCls = cat ? (COLOR_MAP[cat.color] || COLOR_MAP.blue) : null
            const hasFK = cat?.steps?.some(s => s.action_type === "approval" && s.assigned_roles?.split(",").map(r => r.trim()).includes("fuehrungskraft"))
            return (
              <div key={p.id} className="rounded-xl border bg-card shadow-sm overflow-hidden group">
                <div className="h-28 bg-muted/30 flex items-center justify-center overflow-hidden">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    : <span className="text-5xl">{p.emoji || "📦"}</span>
                  }
                </div>
                <div className="p-3 space-y-2">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap min-h-[22px]">
                    {cat ? (
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-medium ${colorCls}`}>{cat.name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">Standard</span>
                    )}
                    {hasFK && (
                      <span className="text-xs bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-800 rounded-full px-1.5 py-0.5">FK</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditProduct(p)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <GitBranch className="h-3 w-3" /> Workflow zuweisen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editProduct && (
        <ProductWorkflowModal
          product={editProduct}
          categories={categories}
          roles={roles}
          onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); loadProducts() }}
        />
      )}
    </div>
  )
}

// ── Action Types Tab ─────────────────────────────────────────────────────────

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const ICONS: Record<string, string> = {
    "Fortschreiten": "▶️", "Kosten": "💰", "Genehmigung": "✅", "Ablehnung": "❌", "Computer": "🖥️",
    "Schlüssel": "🔑", "Schloss": "🔐", "Zahnrad": "⚙️", "Dokument": "📄", "Ordner": "📁",
    "E-Mail": "📧", "Telefon": "📞", "Kalender": "📅", "Uhr": "⏰", "Warnung": "⚠️",
    "Info": "ℹ️", "Stern": "⭐", "Herz": "❤️", "Feuer": "🔥", "Blitz": "⚡",
    "Lupe": "🔍", "Stift": "✏️", "Schere": "✂️", "Paket": "📦", "LKW": "🚚",
    "Haus": "🏠", "Gebäude": "🏢", "Fabrik": "🏭", "Drucker": "🖨️", "Kamera": "📷",
    "Diagramm": "📊", "Tabelle": "📋", "Vertrag": "📝", "Geld": "💵", "Kreditkarte": "💳",
    "Handshake": "🤝", "Daumen hoch": "👍", "Person": "👤", "Team": "👥", "Krone": "👑",
    "Rakete": "🚀", "Ziel": "🎯", "Pokal": "🏆", "Flagge": "🏁", "Glühbirne": "💡",
    "Werkzeug": "🔧", "Hammer": "🔨", "Schild": "🛡️", "Welt": "🌍", "Wolke": "☁️",
    "Server": "🗄️", "Datenbank": "💾", "WLAN": "📶", "Batterie": "🔋", "Stecker": "🔌",
    "Medizin": "💊", "Spritze": "💉", "Ambulanz": "🚑", "Buch": "📚", "Absolvent": "🎓",
    "Musik": "🎵", "Video": "🎬", "Puzzle": "🧩", "Magnet": "🧲", "Mikroskop": "🔬",
  }
  const filtered = Object.entries(ICONS).filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-background text-2xl hover:border-muted-foreground/40 hover:bg-muted/50 transition-colors shrink-0">
        {value || "⚙️"}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-2 w-72 rounded-xl border bg-card shadow-xl overflow-hidden animate-fade-in">
          <div className="p-2 border-b">
            <input className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Icon suchen..." autoFocus />
          </div>
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
            {filtered.map(([name, emoji]) => (
              <button key={name} type="button" title={name} onClick={() => { onChange(emoji); setOpen(false); setSearch("") }}
                className={`h-9 w-full rounded-lg flex items-center justify-center text-lg hover:bg-muted transition-colors ${value === emoji ? "bg-primary/15 ring-1 ring-primary/30" : ""}`}>
                {emoji}
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-8 text-xs text-muted-foreground text-center py-4">Nichts gefunden</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionTypesTab() {
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ key: "", label: "", description: "", icon: "⚙️" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const load = () => {
    fetch("/api/action-types").then(r => r.json())
      .then(d => { setTypes(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  const save = async () => {
    if (!editing) return
    setSaving(true)
    await fetch("/api/action-types", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) })
    setTypes(prev => prev.map(t => t.key === editing.key ? editing : t))
    setEditing(null); setSaving(false)
  }

  const createNew = async () => {
    if (!newForm.key.trim() || !newForm.label.trim()) { setError("Key und Bezeichnung erforderlich"); return }
    setSaving(true); setError(null)
    const res = await fetch("/api/action-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newForm) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowNew(false); setNewForm({ key: "", label: "", description: "", icon: "⚙️" }); setSaving(false); load()
  }

  const remove = async (key: string) => {
    if (!confirm("Sonderaktion wirklich löschen?")) return
    await fetch("/api/action-types", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
    load()
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sonderaktionen sind spezielle Verhaltensweisen, die einem Workflow-Schritt zugewiesen werden können.
        </p>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> Neue Sonderaktion</Button>
      </div>

      {/* New action form */}
      {showNew && (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Neue Sonderaktion erstellen</p>
            <button onClick={() => { setShowNew(false); setError(null) }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>}
          <div className="grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
            <div>
              <label className="text-xs font-medium mb-1 block">Icon</label>
              <IconPicker value={newForm.icon} onChange={v => setNewForm(f => ({ ...f, icon: v }))} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Bezeichnung *</label>
              <input className={inp} value={newForm.label} onChange={e => {
                setNewForm(f => ({ ...f, label: e.target.value, key: f.key || e.target.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") }))
              }} placeholder="z.B. Dokument hochladen" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Schlüssel *</label>
              <input className={inp + " font-mono"} value={newForm.key} onChange={e => setNewForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} placeholder="z.B. upload_doc" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Beschreibung</label>
            <textarea rows={2} className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} placeholder="Was soll der Bearbeiter bei diesem Schritt tun?" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={createNew} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Erstellen
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {types.map(t => (
          <div key={t.key} className="rounded-xl border bg-card p-4 shadow-sm">
            {editing?.key === t.key ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[auto_1fr] gap-2 items-end">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Icon</label>
                    <IconPicker value={editing.icon} onChange={v => setEditing((x: any) => ({ ...x, icon: v }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Bezeichnung</label>
                    <input className={inp} value={editing.label} onChange={e => setEditing((x: any) => ({ ...x, label: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Beschreibung</label>
                  <textarea rows={2} className="flex w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={editing.description || ""} onChange={e => setEditing((x: any) => ({ ...x, description: e.target.value }))} placeholder="Beschreibung..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent transition-colors">Abbrechen</button>
                  <Button size="sm" onClick={save} disabled={saving}>Speichern</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t.label}</span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{t.key}</span>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => setEditing({ ...t })} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  {!t.is_system && <button onClick={() => remove(t.key)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Onboarding Workflow Tab ──────────────────────────────────────────────────

function OnboardingWorkflowTab({ roles, actionTypes }: { roles: RoleDef[]; actionTypes: { key: string; label: string }[] }) {
  const [obSteps, setObSteps] = useState<Step[]>([])
  const [offSteps, setOffSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [subTab, setSubTab] = useState<"onboarding" | "offboarding">("onboarding")

  useEffect(() => {
    Promise.all([
      fetch("/api/onboarding-workflows?type=onboarding").then(r => r.json()),
      fetch("/api/onboarding-workflows?type=offboarding").then(r => r.json()),
    ]).then(([ob, off]) => {
      setObSteps((ob as any[]).map(s => ({ step_name: s.step_name, description: s.description || "", assigned_roles: s.assigned_roles || "", action_type: s.action_type || "none" })))
      setOffSteps((off as any[]).map(s => ({ step_name: s.step_name, description: s.description || "", assigned_roles: s.assigned_roles || "", action_type: s.action_type || "none" })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const saveSteps = async () => {
    setSaving(true)
    await Promise.all([
      fetch("/api/onboarding-workflows", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "onboarding", steps: obSteps }) }),
      fetch("/api/onboarding-workflows", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "offboarding", steps: offSteps }) }),
    ])
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const steps = subTab === "onboarding" ? obSteps : offSteps
  const setSteps = subTab === "onboarding" ? setObSteps : setOffSteps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          <button onClick={() => setSubTab("onboarding")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${subTab === "onboarding" ? "bg-card shadow-sm text-emerald-600" : "text-muted-foreground"}`}>
            <UserPlus className="h-3 w-3" /> Onboarding
          </button>
          <button onClick={() => setSubTab("offboarding")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${subTab === "offboarding" ? "bg-card shadow-sm text-red-500" : "text-muted-foreground"}`}>
            <UserMinus className="h-3 w-3" /> Offboarding
          </button>
        </div>
        <Button size="sm" onClick={saveSteps} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? "Gespeichert" : "Schritte speichern"}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground mb-3">
          {subTab === "onboarding"
            ? "Workflow-Schritte für neue Mitarbeiter (z.B. Personalakte, Hardware, Zugänge, Einarbeitung)"
            : "Workflow-Schritte beim Austritt (z.B. Zugänge sperren, Hardware einsammeln, Abmeldungen)"}
        </p>
        <StepEditor steps={steps} onChange={setSteps} roles={roles} />
      </div>
    </div>
  )
}

// ── Templates Tab ────────────────────────────────────────────────────────────

interface WorkflowTemplate {
  id: number
  name: string
  description: string
  category: string
  steps: Step[]
  status: string
}

const TEMPLATE_CATEGORY_OPTIONS = [
  { value: "order", label: "Bestellung" },
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
  { value: "general", label: "Allgemein" },
]

const TEMPLATE_CATEGORY_BADGE: Record<string, string> = {
  order: "bg-blue-500/10 text-blue-600 border-blue-200",
  onboarding: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  offboarding: "bg-red-500/10 text-red-600 border-red-200",
  general: "bg-gray-500/10 text-gray-600 border-gray-200",
}

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  order: "Bestellung",
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  general: "Allgemein",
}

function TemplateModal({ template, actionTypes, roles, onClose, onSaved }: {
  template?: WorkflowTemplate; actionTypes: { key: string; label: string }[]; roles: RoleDef[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: template?.name || "",
    description: template?.description || "",
    category: template?.category || "general",
    steps: template?.steps?.length
      ? template.steps.map(s => ({ step_name: s.step_name, description: s.description || "", assigned_roles: s.assigned_roles || "", action_type: s.action_type || "none" }))
      : [{ step_name: "", description: "", assigned_roles: "", action_type: "none" }],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { step_name: "", description: "", assigned_roles: "", action_type: "none" }] }))
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
  const updateStep = (i: number, field: keyof Step, val: string) =>
    setForm(f => ({ ...f, steps: f.steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }))
  const moveStep = (i: number, dir: -1 | 1) => {
    const arr = [...form.steps]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setForm(f => ({ ...f, steps: arr }))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    const validSteps = form.steps.filter(s => s.step_name.trim())
    if (validSteps.length === 0) { setError("Mindestens ein Schritt erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(template ? `/api/workflow-templates/${template.id}` : "/api/workflow-templates", {
        method: template ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, steps: validSteps })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{template ? "Template bearbeiten" : "Neues Template"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div>
            <label className="text-sm font-medium mb-1 block">Name *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Standard-Onboarding IT" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Beschreibung</label>
            <textarea rows={2} className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Wofür wird dieses Template verwendet?" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Kategorie</label>
            <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {TEMPLATE_CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block">Workflow-Schritte *</label>
            <div className="space-y-3">
              {form.steps.map((step, i) => {
                const selectedRoles = step.assigned_roles ? step.assigned_roles.split(",").map(r => r.trim()).filter(Boolean) : []
                return (
                  <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors">
                          <ArrowUp className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button type="button" onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors">
                          <ArrowDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                      <input
                        className={inp + " flex-1"}
                        value={step.step_name}
                        onChange={e => updateStep(i, "step_name", e.target.value)}
                        placeholder={`Schritt ${i + 1}`}
                      />
                      <button type="button" onClick={() => removeStep(i)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="pl-10 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Aktionstyp</label>
                        <select
                          className={inp + " text-xs"}
                          value={step.action_type || "none"}
                          onChange={e => updateStep(i, "action_type", e.target.value)}
                        >
                          {actionTypes.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Zugewiesene Rollen (kommagetrennt)</label>
                        <input
                          className={inp + " text-xs"}
                          value={step.assigned_roles}
                          onChange={e => updateStep(i, "assigned_roles", e.target.value)}
                          placeholder="z.B. agent, fuehrungskraft"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              <button type="button" onClick={addStep} className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
                <Plus className="h-3.5 w-3.5" /> Schritt hinzufügen
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : template ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TemplatesTab({ roles, actionTypes }: { roles: RoleDef[]; actionTypes: { key: string; label: string }[] }) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editTemplate, setEditTemplate] = useState<WorkflowTemplate | null | "new">(null)

  const load = () => {
    fetch("/api/workflow-templates").then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(load, [])

  const remove = async (t: WorkflowTemplate) => {
    if (!confirm(`Template "${t.name}" wirklich löschen?`)) return
    await fetch(`/api/workflow-templates/${t.id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(x => x.id !== t.id))
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Wiederverwendbare Workflow-Vorlagen für alle Bereiche</p>
        </div>
        <Button onClick={() => setEditTemplate("new")}><Plus className="h-4 w-4" /> Neues Template</Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Noch keine Templates definiert</p>
          <p className="text-xs mt-1 text-center max-w-xs">Erstelle wiederverwendbare Workflow-Vorlagen für Bestellungen, Onboarding und mehr.</p>
          <button onClick={() => setEditTemplate("new")} className="mt-4 text-sm text-primary hover:underline">Erstes Template erstellen</button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Kategorie</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Schritte</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => {
                const badgeCls = TEMPLATE_CATEGORY_BADGE[t.category] || TEMPLATE_CATEGORY_BADGE.general
                return (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{t.description}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-medium ${badgeCls}`}>
                        {TEMPLATE_CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{t.steps?.length || 0}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs rounded-full border px-2 py-0.5 font-medium ${t.status === "active" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : "bg-gray-500/10 text-gray-600 border-gray-200"}`}>
                        {t.status === "active" ? "Aktiv" : t.status === "draft" ? "Entwurf" : t.status || "Aktiv"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-0.5 justify-end">
                        <button onClick={() => setEditTemplate(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(t)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editTemplate && (
        <TemplateModal
          template={editTemplate === "new" ? undefined : editTemplate}
          actionTypes={actionTypes}
          roles={roles}
          onClose={() => setEditTemplate(null)}
          onSaved={() => { setEditTemplate(null); load() }}
        />
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [tab, setTab] = useState<"categories" | "products" | "actions" | "templates" | "onboarding">("categories")
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editCat, setEditCat] = useState<Category | null | "new">(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [roles, setRoles] = useState<RoleDef[]>([])
  const [actionTypes, setActionTypes] = useState<{ key: string; label: string }[]>([])

  const load = () => {
    fetch("/api/order-categories")
      .then(r => r.json())
      .then(d => { setCategories(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => {
    load()
    fetchRoles().then(setRoles)
    fetch("/api/action-types").then(r => r.json())
      .then(d => setActionTypes(Array.isArray(d) ? d.map((a: any) => ({ key: a.key, label: a.label })) : []))
      .catch(() => {})
  }, [])

  const remove = async (cat: Category) => {
    if (!confirm(`Produktklasse "${cat.name}" wirklich löschen?`)) return
    await fetch(`/api/order-categories/${cat.id}`, { method: "DELETE" })
    setCategories(prev => prev.filter(c => c.id !== cat.id))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Bestell-, Onboarding- und Offboarding-Workflows konfigurieren</p>
        </div>
        {tab === "categories" && (
          <Button onClick={() => setEditCat("new")}><Plus className="h-4 w-4" /> Neue Produktklasse</Button>
        )}
        {tab === "products" && (
          <p className="text-xs text-muted-foreground">Produkte werden im <a href="/catalog" className="text-primary hover:underline">Produktkatalog</a> verwaltet</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setTab("categories")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "categories" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <GitBranch className="h-3.5 w-3.5" /> Produktklassen
        </button>
        <button
          onClick={() => setTab("products")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "products" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Package className="h-3.5 w-3.5" /> Produkte
        </button>
        <button
          onClick={() => setTab("actions")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "actions" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Zap className="h-3.5 w-3.5" /> Sonderaktionen
        </button>
        <button
          onClick={() => setTab("templates")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "templates" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <FileText className="h-3.5 w-3.5" /> Templates
        </button>
        <button
          onClick={() => setTab("onboarding")}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${tab === "onboarding" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <UserPlus className="h-3.5 w-3.5" /> On-/Offboarding
        </button>
      </div>

      {tab === "onboarding" && <OnboardingWorkflowTab roles={roles} actionTypes={actionTypes} />}
      {tab === "actions" && <ActionTypesTab />}
      {tab === "templates" && <TemplatesTab roles={roles} actionTypes={actionTypes} />}
      {tab === "products" && <ProductsTab categories={categories} roles={roles} />}

      {tab === "categories" && (loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed text-muted-foreground">
          <GitBranch className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Noch keine Produktklassen definiert</p>
          <p className="text-xs mt-1 text-center max-w-xs">Erstelle Produktklassen (z.B. Hardware, Software, Verbrauchsmaterial) mit jeweils eigenen Workflow-Schritten.</p>
          <button onClick={() => setEditCat("new")} className="mt-4 text-sm text-primary hover:underline">Erste Produktklasse erstellen</button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const colorCls = COLOR_MAP[cat.color] || COLOR_MAP.blue
            const isExpanded = expanded === cat.id
            return (
              <div key={cat.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${colorCls}`}>
                    {cat.name}
                  </div>
                  {cat.description && <p className="text-sm text-muted-foreground flex-1 truncate">{cat.description}</p>}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-xs text-muted-foreground mr-2">{cat.steps?.length || 0} Schritte</span>
                    <button onClick={() => setExpanded(isExpanded ? null : cat.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => setEditCat(cat)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(cat)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-5 py-4 bg-muted/20">
                    <div className="space-y-2">
                      {cat.steps?.map((step, i) => {
                        const stepRoles2 = (step as any).assigned_roles
                          ? (step as any).assigned_roles.split(",").map((r: string) => r.trim()).filter(Boolean)
                          : []
                        const actionType = (step as any).action_type || "none"
                        const rlColorMap = Object.fromEntries(roles.map(r => [r.key_name, r.color || "bg-muted"]))
                        const rlLabelMap = Object.fromEntries(roles.map(r => [r.key_name, r.label]))
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                              {i < cat.steps.length - 1 && <div className="absolute mt-7 ml-3 w-0.5 h-4 bg-muted-foreground/20" />}
                              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 bg-background flex items-center justify-center text-xs text-muted-foreground font-mono">{i + 1}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{step.step_name}</span>
                                {actionType !== "none" && (
                                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                    {ACTION_TYPE_LABELS[actionType] || actionType}
                                  </span>
                                )}
                                {stepRoles2.map((r: string) => (
                                  <span key={r} className={`text-xs rounded-full border px-1.5 py-0.5 ${rlColorMap[r] || "bg-muted"}`}>
                                    {rlLabelMap[r] || r}
                                  </span>
                                ))}
                              </div>
                              {(step as any).description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{(step as any).description}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {editCat && (
        <CategoryModal
          cat={editCat === "new" ? undefined : editCat}
          roles={roles}
          onClose={() => setEditCat(null)}
          onSaved={() => { setEditCat(null); load() }}
        />
      )}
    </div>
  )
}
