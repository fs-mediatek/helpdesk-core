"use client"
import { useState, useEffect, useRef } from "react"
import { Plus, Pencil, Trash2, X, Loader2, Upload, ShoppingCart, Minus, Check, ArrowRight, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

// ── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  product: any
  quantity: number
  specs?: string   // for requires_description products
}

// ── Emoji options for admin ──────────────────────────────────────────────────

const EMOJI_OPTIONS = ["💻", "🖥️", "🔌", "🖱️", "⌨️", "🎧", "📷", "📱", "🖨️", "📦", "🔋", "💾", "📡", "🖲️", "📲", "🗄️", "⌚", "🔦", "📟", "🖊️"]

// ── Stock badge helper ───────────────────────────────────────────────────────

function StockBadge({ product }: { product: any }) {
  if (product.inventory_item_id == null) return null
  const inStock = (product.stock_quantity ?? 0) > 0
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      inStock
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    }`}>
      {inStock ? "● Auf Lager" : "○ Lieferzeit"}
    </span>
  )
}

// ── Cart sidebar ─────────────────────────────────────────────────────────────

function CartSidebar({
  cart,
  onUpdateQty,
  onRemove,
  onUpdateSpecs,
  onCheckout,
  onClose,
}: {
  cart: CartItem[]
  onUpdateQty: (productId: number, qty: number) => void
  onRemove: (productId: number) => void
  onUpdateSpecs: (productId: number, specs: string) => void
  onCheckout: () => void
  onClose: () => void
}) {
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-card border-l shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Warenkorb</h2>
            <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {totalItems}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <ShoppingCart className="h-10 w-10 opacity-20" />
            <p className="text-sm">Dein Warenkorb ist leer</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map(item => (
                <div key={item.product.id} className="rounded-xl border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product.image_url
                        ? <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-2xl">{item.product.emoji || "📦"}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      {item.product.price_estimate && (
                        <p className="text-xs text-muted-foreground">~{parseFloat(item.product.price_estimate).toFixed(0)} €/Stk.</p>
                      )}
                      <StockBadge product={item.product} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => item.quantity <= 1 ? onRemove(item.product.id) : onUpdateQty(item.product.id, item.quantity - 1)}
                        className="h-6 w-6 rounded-md border bg-background hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                        className="h-6 w-6 rounded-md border bg-background hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onRemove(item.product.id)}
                        className="h-6 w-6 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-500/10 flex items-center justify-center transition-colors ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {/* Specs input for products that require description */}
                  {item.product.requires_description ? (
                    <div>
                      <textarea
                        rows={2}
                        value={item.specs || ""}
                        onChange={e => onUpdateSpecs(item.product.id, e.target.value)}
                        placeholder="Bitte genau beschreiben, was benötigt wird..."
                        className={`w-full rounded-lg border px-3 py-1.5 text-xs resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${
                          !item.specs?.trim() ? "border-amber-400/60 bg-amber-500/5" : "border-input bg-background"
                        }`}
                      />
                      {!item.specs?.trim() && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">⚠ Bitte ausfüllen vor dem Absenden</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Summary + checkout */}
            <div className="p-4 border-t space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Positionen gesamt</span>
                <span className="font-semibold">{totalItems} Artikel</span>
              </div>
              {cart.some(i => i.product.price_estimate) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Geschätzter Wert</span>
                  <span className="font-semibold">
                    ~{cart.reduce((s, i) => s + (parseFloat(i.product.price_estimate || "0") * i.quantity), 0).toFixed(0)} €
                  </span>
                </div>
              )}
              {cart.some(i => i.product.inventory_item_id != null && (i.product.stock_quantity ?? 0) === 0) && (
                <div className="rounded-lg bg-amber-500/8 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  ⏳ Einige Artikel sind nicht auf Lager — bitte mit längerer Lieferzeit rechnen.
                </div>
              )}
              <button
                onClick={onCheckout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Bestellung absenden <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Checkout modal ────────────────────────────────────────────────────────────

function CheckoutModal({
  cart,
  onClose,
  onSaved,
}: {
  cart: CartItem[]
  onClose: () => void
  onSaved: (orderId: number, orderNumber: string) => void
}) {
  const [form, setForm] = useState({ description: "", priority: "medium", estimated_delivery: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0)
  const hasOutOfStock = cart.some(i => i.product.inventory_item_id != null && (i.product.stock_quantity ?? 0) === 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const items = cart.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price_estimate || null,
        specs: i.specs || null,
      }))
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved(data.id, data.order_number)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Bestellung absenden</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          {/* Order summary */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zusammenfassung</p>
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2 text-sm">
                <span className="text-base">{item.product.emoji || "📦"}</span>
                <span className="flex-1 font-medium">{item.product.name}</span>
                <span className="text-muted-foreground">× {item.quantity}</span>
                {item.product.price_estimate && (
                  <span className="text-muted-foreground text-xs">~{(parseFloat(item.product.price_estimate) * item.quantity).toFixed(0)} €</span>
                )}
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Gesamt</span>
              <span>{totalItems} Artikel{cart.some(i => i.product.price_estimate) && ` · ~${cart.reduce((s, i) => s + (parseFloat(i.product.price_estimate || "0") * i.quantity), 0).toFixed(0)} €`}</span>
            </div>
          </div>

          {hasOutOfStock && (
            <div className="rounded-lg bg-amber-500/8 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              ⏳ Einige Artikel sind aktuell nicht auf Lager — bitte rechne mit einer etwas längeren Lieferzeit.
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Priorität</label>
            <select className={`${inp} max-w-[200px]`} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Gewünschtes Lieferdatum</label>
            <input type="date" className={inp} value={form.estimated_delivery}
              onChange={e => setForm(f => ({ ...f, estimated_delivery: e.target.value }))} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Begründung / Hinweise (optional)</label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Wofür werden die Geräte benötigt? Besondere Anforderungen?"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Sende...</> : <><Check className="h-4 w-4" />Bestellung absenden</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Success screen ────────────────────────────────────────────────────────────

function OrderSuccess({ orderNumber, orderId, onDone }: { orderNumber: string; orderId: number; onDone: () => void }) {
  const router = useRouter()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm p-8 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Bestellung eingegangen!</h2>
          <p className="text-muted-foreground text-sm mt-1">Deine Bestellung wurde erfolgreich aufgegeben.</p>
          <p className="font-mono font-semibold mt-2 text-primary">{orderNumber}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={onDone} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            Weiter shoppen
          </button>
          <button onClick={() => router.push(`/orders/${orderId}`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Status verfolgen <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Admin product modal ───────────────────────────────────────────────────────

function ProductModal({ product, categories, inventoryItems, suppliers, onClose, onSaved }: {
  product?: any; categories: any[]; inventoryItems: any[]; suppliers: any[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    category_id: product?.category_id ? String(product.category_id) : "",
    inventory_item_id: product?.inventory_item_id ? String(product.inventory_item_id) : "",
    supplier_id: product?.supplier_id ? String(product.supplier_id) : "",
    emoji: product?.emoji || "📦",
    price_estimate: product?.price_estimate ? String(product.price_estimate) : "",
    sort_order: product?.sort_order ? String(product.sort_order) : "0",
    requires_description: !!product?.requires_description,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url || null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError("Name erforderlich"); return }
    setSaving(true); setError(null)
    try {
      const body = {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        inventory_item_id: form.inventory_item_id ? parseInt(form.inventory_item_id) : null,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        price_estimate: form.price_estimate ? parseFloat(form.price_estimate) : null,
        sort_order: parseInt(form.sort_order) || 0,
        requires_description: form.requires_description,
      }
      const res = await fetch(product ? `/api/catalog/${product.id}` : "/api/catalog", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
      onSaved()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const uploadImage = async (file: File) => {
    if (!product) return
    setUploadingImage(true)
    const fd = new FormData()
    fd.append("image", file)
    const res = await fetch(`/api/catalog/${product.id}/image`, { method: "POST", body: fd })
    const data = await res.json()
    if (data.url) setImageUrl(data.url)
    setUploadingImage(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{product ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>}

          <div className="flex gap-4 items-start">
            <div className="relative shrink-0">
              <div
                className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                onClick={() => product && fileRef.current?.click()}
                title={product ? "Bild hochladen" : "Erst speichern, dann Bild hochladen"}
              >
                {uploadingImage ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl">{form.emoji}</span>
                )}
              </div>
              {product && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Upload className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Name *</label>
                <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Notebook, Monitor..." />
              </div>
              {!product && <p className="text-xs text-muted-foreground">Bild kann nach dem Erstellen hochgeladen werden.</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Emoji (Fallback wenn kein Bild)</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(em => (
                <button key={em} type="button"
                  onClick={() => setForm(f => ({ ...f, emoji: em }))}
                  className={`h-9 w-9 rounded-lg text-xl transition-all ${form.emoji === em ? "bg-primary/20 ring-2 ring-primary/50" : "bg-muted/30 hover:bg-muted/60"}`}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Beschreibung</label>
            <input className={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Kurze Beschreibung des Produkts" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Workflow (Produktklasse)</label>
              <select className={inp} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">— Standard-Workflow —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Richtpreis (€)</label>
              <input type="number" step="0.01" className={inp} value={form.price_estimate}
                onChange={e => setForm(f => ({ ...f, price_estimate: e.target.value }))} placeholder="z.B. 899.00" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Lagerartikel verknüpfen</label>
            <select className={inp} value={form.inventory_item_id} onChange={e => setForm(f => ({ ...f, inventory_item_id: e.target.value }))}>
              <option value="">— Kein Lagerartikel —</option>
              {inventoryItems.map(i => (
                <option key={i.id} value={i.id}>{i.name} (Bestand: {i.quantity} {i.unit})</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Wenn verknüpft, sehen Besteller ob das Produkt auf Lager ist.</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Lieferant</label>
            <select className={inp} value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
              <option value="">— Kein Lieferant —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.website ? ` · ${s.website}` : ""}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Zugehöriger Händler für Angebotsanfragen.</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Sortierung</label>
            <input type="number" className={inp} value={form.sort_order}
              onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, requires_description: !f.requires_description }))}
              className={`relative h-5 w-9 rounded-full transition-colors ${form.requires_description ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.requires_description ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Beschreibung erforderlich</p>
              <p className="text-xs text-muted-foreground">Besteller müssen beim Checkout eine Beschreibung angeben</p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Abbrechen</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</> : product ? "Speichern" : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main catalog / shop page ──────────────────────────────────────────────────

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [editProduct, setEditProduct] = useState<any | null | "new">(null)

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [success, setSuccess] = useState<{ id: number; number: string } | null>(null)

  const [catalogManagerRoles, setCatalogManagerRoles] = useState<string[]>(["admin"])

  const load = async () => {
    const [prod, cats, inv, me, settingsRes, sups] = await Promise.all([
      fetch("/api/catalog").then(r => r.json()).catch(() => []),
      fetch("/api/order-categories").then(r => r.json()).catch(() => []),
      fetch("/api/inventory").then(r => r.json()).catch(() => []),
      fetch("/api/auth/me").then(r => r.json()).catch(() => null),
      fetch("/api/settings").then(r => r.json()).catch(() => ({})),
      fetch("/api/suppliers").then(r => r.json()).catch(() => []),
    ])
    setProducts(Array.isArray(prod) ? prod : [])
    setCategories(Array.isArray(cats) ? cats : [])
    setInventoryItems(Array.isArray(inv) ? inv : [])
    setSuppliers(Array.isArray(sups) ? sups : [])
    setSession(me)
    const managerRoles = (settingsRes.catalog_manager_roles || "admin").split(",").map((r: string) => r.trim()).filter(Boolean)
    setCatalogManagerRoles(managerRoles)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const roles: string[] = session?.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const isAdmin = roles.some(r => catalogManagerRoles.includes(r))

  // Cart helpers
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1 }]
    })
  }
  const updateQty = (productId: number, qty: number) =>
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  const removeFromCart = (productId: number) =>
    setCart(prev => prev.filter(i => i.product.id !== productId))
  const updateSpecs = (productId: number, specs: string) =>
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, specs } : i))
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const getCartQty = (productId: number) => cart.find(i => i.product.id === productId)?.quantity ?? 0

  const remove = async (p: any) => {
    if (!confirm(`"${p.name}" wirklich löschen?`)) return
    await fetch(`/api/catalog/${p.id}`, { method: "DELETE" })
    setProducts(prev => prev.filter(x => x.id !== p.id))
  }

  const filtered = search
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()))
    : products

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produktkatalog</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Produkte auswählen und in den Warenkorb legen</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setEditProduct("new")}>
              <Plus className="h-4 w-4" /> Neues Produkt
            </Button>
          )}
          <button
            onClick={() => setCartOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            Warenkorb
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input
          className="flex h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Produkte suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map(p => {
            const qty = getCartQty(p.id)
            const inCart = qty > 0
            return (
              <div key={p.id} className={`group rounded-xl border bg-card shadow-sm overflow-hidden hover:shadow-md transition-all ${inCart ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
                {/* Image */}
                <div className="relative h-32 bg-muted/30 flex items-center justify-center">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    : <span className="text-5xl">{p.emoji || "📦"}</span>
                  }
                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditProduct(p)} className="h-7 w-7 rounded-lg bg-card border shadow-sm flex items-center justify-center hover:bg-accent transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => remove(p)} className="h-7 w-7 rounded-lg bg-card border shadow-sm flex items-center justify-center hover:bg-red-500/10 hover:text-red-600 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {/* Cart badge */}
                  {inCart && (
                    <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shadow">
                      {qty}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <StockBadge product={p} />
                    {p.price_estimate && (
                      <span className="text-xs font-medium text-muted-foreground">~{parseFloat(p.price_estimate).toFixed(0)} €</span>
                    )}
                  </div>

                  {/* Add to cart / qty controls */}
                  {inCart ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => qty <= 1 ? removeFromCart(p.id) : updateQty(p.id, qty - 1)}
                        className="h-8 w-8 rounded-lg border bg-background hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex-1 text-center text-sm font-semibold">{qty}</span>
                      <button
                        onClick={() => updateQty(p.id, qty + 1)}
                        className="h-8 w-8 rounded-lg border bg-background hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(p.id)}
                        className="h-8 w-8 rounded-lg border text-muted-foreground hover:bg-red-500/10 hover:text-red-600 flex items-center justify-center transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium py-1.5 transition-colors"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> In den Warenkorb
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {isAdmin && (
            <button onClick={() => setEditProduct("new")}
              className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-card flex flex-col items-center justify-center gap-2 h-[220px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium">Produkt hinzufügen</span>
            </button>
          )}
        </div>
      )}

      {/* Floating checkout bar when cart has items */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-3 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-2xl hover:bg-primary/90 transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{cartCount} Artikel im Warenkorb</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {cart.some(i => i.product.price_estimate) && `~${cart.reduce((s, i) => s + (parseFloat(i.product.price_estimate || "0") * i.quantity), 0).toFixed(0)} €`}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cart sidebar */}
      {cartOpen && (
        <CartSidebar
          cart={cart}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onUpdateSpecs={updateSpecs}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true) }}
          onClose={() => setCartOpen(false)}
        />
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onSaved={(id, number) => {
            setCheckoutOpen(false)
            setCart([])
            setSuccess({ id, number })
          }}
        />
      )}

      {/* Success screen */}
      {success && (
        <OrderSuccess
          orderId={success.id}
          orderNumber={success.number}
          onDone={() => setSuccess(null)}
        />
      )}

      {/* Admin product modal */}
      {editProduct && (
        <ProductModal
          product={editProduct === "new" ? undefined : editProduct}
          categories={categories}
          inventoryItems={inventoryItems}
          suppliers={suppliers}
          onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); load() }}
        />
      )}
    </div>
  )
}
