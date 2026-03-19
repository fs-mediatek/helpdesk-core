"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, UserPlus, Save, Check, Package, Key, ShoppingCart, Plus, X, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface CartItem { product: any; quantity: number }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="px-6 py-3 border-b bg-muted/20"><h2 className="font-semibold text-sm">{title}</h2></div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

export default function EquipmentPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<any>(null)
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [suggestedIds, setSuggestedIds] = useState<number[]>([])
  const [presetName, setPresetName] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [facilityNotes, setFacilityNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem("onboarding_draft")
    if (!raw) { router.push("/onboarding/new"); return }
    const d = JSON.parse(raw)
    setDraft(d)
    setFacilityNotes(d.facility_notes || "")

    // Load products and equipment suggestions
    Promise.all([
      fetch("/api/catalog").then(r => r.json()).catch(() => []),
      fetch(`/api/onboarding/equipment?department=${encodeURIComponent(d.department || "")}&job_title=${encodeURIComponent(d.job_title || "")}`).then(r => r.json()).catch(() => ({ products: [] })),
    ]).then(([catalog, suggestion]) => {
      const prods = Array.isArray(catalog) ? catalog : []
      setAllProducts(prods)
      const suggestedProds = suggestion.products || []
      const sugIds = suggestedProds.map((p: any) => p.id)
      setSuggestedIds(sugIds)
      if (suggestion.preset?.name) setPresetName(suggestion.preset.name)
      // Pre-fill cart with suggested products
      setCart(suggestedProds.map((p: any) => ({ product: prods.find((pr: any) => pr.id === p.id) || p, quantity: 1 })))
      setLoading(false)
    })
  }, [])

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id)
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { product, quantity: 1 }]
    })
  }

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(c => c.product.id !== productId))
  }

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c
      const newQty = c.quantity + delta
      return newQty <= 0 ? c : { ...c, quantity: newQty }
    }))
  }

  const inCart = (productId: number) => cart.some(c => c.product.id === productId)

  const submit = async () => {
    if (!draft) return
    setSaving(true); setError(null)
    try {
      // 1. Create onboarding request
      const onboardingBody = {
        ...draft,
        facility_notes: facilityNotes,
        employee_name: `${draft.first_name} ${draft.last_name}`.trim(),
        project_email: draft.project_emails?.length > 0 ? JSON.stringify(draft.project_emails) : null,
      }
      const obRes = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(onboardingBody) })
      const obData = await obRes.json()
      if (!obRes.ok) throw new Error(obData.error || "Onboarding konnte nicht erstellt werden")
      const onboardingId = obData.id

      // 2. Create order for equipment if cart has items
      if (cart.length > 0) {
        const items = cart.map(c => ({ name: c.product.name, quantity: c.quantity, product_id: c.product.id }))
        const employeeName = `${draft.first_name} ${draft.last_name}`.trim()
        const orderBody = {
          title: `Ausstattung: ${employeeName}`,
          description: `Bestellung im Rahmen des Onboarding-Prozesses für ${employeeName}.`,
          priority: "medium",
          items,
        }
        const ordRes = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(orderBody) })
        const ordData = await ordRes.json()

        // 3. Link tickets: add comment on onboarding ticket referencing order
        if (ordData.id && obData.id) {
          // Get the onboarding's ticket_id
          const obDetail = await fetch(`/api/onboarding/${onboardingId}`).then(r => r.json()).catch(() => null)
          if (obDetail?.ticket_id && ordData.order_number) {
            await fetch(`/api/tickets/${obDetail.ticket_id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}) // trigger to get ticket_id
            }).catch(() => {})
            // Add linking comment on onboarding ticket
            await fetch(`/api/tickets/${obDetail.ticket_id}/comments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: `Verknüpfte Bestellung: ${ordData.order_number} — ${cart.length} Artikel bestellt.`, is_internal: false }),
            }).catch(() => {})
          }
        }
      }

      sessionStorage.removeItem("onboarding_draft")
      router.push(`/onboarding/${onboardingId}`)
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  if (loading || !draft) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const employeeName = `${draft.first_name} ${draft.last_name}`.trim()
  const otherProducts = allProducts.filter(p => !inCart(p.id))

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/onboarding/new" className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-11 w-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ausstattung & Facility</h1>
            <p className="text-sm text-muted-foreground">Technische Ausstattung für {employeeName} — {draft.department || "Keine Abteilung"}</p>
          </div>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold"><Check className="h-3.5 w-3.5" /></div>
          <span className="text-sm text-muted-foreground">Persönliche Daten</span>
        </div>
        <div className="h-px flex-1 bg-primary/30" />
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
          <span className="text-sm font-medium">Ausstattung & Facility</span>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6">{error}</div>}

      <div className="space-y-6">

        {/* Suggested equipment */}
        <Section title={presetName ? `Vorgeschlagene Ausstattung — ${presetName}` : "Vorgeschlagene Ausstattung"}>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Vorschläge für diese Kombination aus Abteilung und Position. Produkte manuell hinzufügen.</p>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 rounded-xl border p-3 bg-primary/5 border-primary/20">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                    {item.product.image_url ? <img src={item.product.image_url} alt="" className="h-full w-full object-cover rounded-lg" /> : (item.product.emoji || "📦")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    {suggestedIds.includes(item.product.id) && <p className="text-[10px] text-primary">Vorgeschlagen</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product.id, -1)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Additional products */}
        {otherProducts.length > 0 && (
          <Section title="Weitere Produkte hinzufügen">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {otherProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border p-3 hover:border-primary/30 hover:bg-primary/5 transition-all text-center">
                  <span className="text-2xl">{p.emoji || "📦"}</span>
                  <span className="text-xs font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Facility */}
        <Section title="Facility — Schlüssel & Transponder">
          <textarea rows={4} className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={facilityNotes} onChange={e => setFacilityNotes(e.target.value)}
            placeholder="Benötigte Schlüssel, Transponder, Zugangsberechtigungen..." />
          <p className="text-xs text-muted-foreground">Berechtigungsmatrix wird in einer zukünftigen Version integriert.</p>
        </Section>
      </div>

      {/* Summary + Submit */}
      <div className="mt-8 pt-6 border-t">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {cart.length > 0 ? `${cart.reduce((s, c) => s + c.quantity, 0)} Artikel in ${cart.length} Produkten` : "Keine Ausstattung ausgewählt"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/onboarding/new" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Zurück</Link>
            <Button onClick={submit} disabled={saving} size="lg">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird erstellt...</>
                : <><Save className="h-4 w-4" /> Onboarding starten{cart.length > 0 ? " & bestellen" : ""}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
