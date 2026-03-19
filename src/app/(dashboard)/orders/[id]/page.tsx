"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ShoppingCart, Loader2, Calendar, Package, Check, Clock, X, ChevronRight, Key, Search, ExternalLink, Mail, Cpu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { de } from "date-fns/locale"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  requested: { label: "Angefragt", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
  approved: { label: "Genehmigt", color: "bg-blue-500/10 text-blue-600" },
  ordered: { label: "Bestellt", color: "bg-purple-500/10 text-purple-600" },
  shipped: { label: "Versandt", color: "bg-amber-500/10 text-amber-600" },
  delivered: { label: "Geliefert", color: "bg-emerald-500/10 text-emerald-600" },
  completed: { label: "Abgeschlossen", color: "bg-emerald-500/10 text-emerald-700" },
  rejected: { label: "Abgelehnt", color: "bg-red-500/10 text-red-600" },
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch"
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  none: "Manuell abschließen",
  cost_entry: "Kosten eintragen",
  approval: "Genehmigen / Ablehnen",
  asset_assign: "Asset zuweisen",
  access_code_gen: "Zugangscode generieren",
  access_code_confirm: "Zugangscode bestätigen",
}

function StepIcon({ status }: { status: string }) {
  if (status === "completed") return <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"><Check className="h-3.5 w-3.5 text-white" /></div>
  if (status === "active") return <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 ring-4 ring-primary/20"><ChevronRight className="h-3.5 w-3.5 text-white" /></div>
  return <div className="h-7 w-7 rounded-full border-2 border-muted-foreground/30 bg-background flex items-center justify-center shrink-0"><Clock className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
}

// ── Action panels ─────────────────────────────────────────────────────────────

function ActionAdvance({ onAction, step }: { onAction: (action: string, body?: any) => Promise<void>; step: any }) {
  const [busy, setBusy] = useState(false)
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); await onAction("advance"); setBusy(false) }}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {step.step_name} abschließen
    </button>
  )
}

function ActionCostEntry({ onAction }: { onAction: (action: string, body?: any) => Promise<void> }) {
  const [cost, setCost] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    await onAction("cost_entry", { total_cost: cost ? parseFloat(cost) : undefined, notes })
    setBusy(false)
  }
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Gesamtkosten (€)</label>
        <input type="number" step="0.01" placeholder="0.00"
          className="flex h-9 w-36 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={cost} onChange={e => setCost(e.target.value)} />
      </div>
      <div className="flex-1 min-w-32">
        <label className="text-xs text-muted-foreground mb-1 block">Notiz (optional)</label>
        <input placeholder="z.B. Angebotsnummer..."
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <button disabled={busy} onClick={submit}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors h-9">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Kosten speichern
      </button>
    </div>
  )
}

function ActionApproval({ onAction }: { onAction: (action: string, body?: any) => Promise<void> }) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  if (showReject) return (
    <div className="space-y-2">
      <textarea rows={2} placeholder="Ablehnungsgrund *"
        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={() => setShowReject(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent transition-colors">Zurück</button>
        <button disabled={busy || !reason.trim()} onClick={async () => { setBusy(true); await onAction("reject", { reason }); setBusy(false) }}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Ablehnen
        </button>
      </div>
    </div>
  )
  return (
    <div className="flex gap-2">
      <button onClick={() => setShowReject(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors">
        <X className="h-4 w-4" /> Ablehnen
      </button>
      <button disabled={busy} onClick={async () => { setBusy(true); await onAction("approve"); setBusy(false) }}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Genehmigen
      </button>
    </div>
  )
}

function ActionAssetAssign({ onAction }: { onAction: (action: string, body?: any) => Promise<void> }) {
  const [assets, setAssets] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)

  const fetchAssets = async (q: string) => {
    setLoadingAssets(true)
    const res = await fetch(`/api/assets?search=${encodeURIComponent(q)}`)
    const data = await res.json()
    setAssets(Array.isArray(data) ? data : [])
    setLoadingAssets(false)
  }

  useEffect(() => { fetchAssets("") }, [])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input placeholder="Asset suchen (Name, Tag...)"
          className="flex h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={search} onChange={e => { setSearch(e.target.value); fetchAssets(e.target.value) }} />
      </div>
      {loadingAssets ? (
        <div className="text-xs text-muted-foreground">Lade Assets...</div>
      ) : (
        <div className="max-h-40 overflow-y-auto rounded-lg border bg-background divide-y text-sm">
          {assets.length === 0 && <div className="px-3 py-2 text-muted-foreground text-xs">Keine Assets gefunden</div>}
          {assets.map((a: any) => (
            <div key={a.id}
              onClick={() => setSelected(a.id)}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-muted/50 transition-colors ${selected === a.id ? "bg-primary/10" : ""}`}>
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">{a.name}</span>
              {a.asset_tag && <span className="text-xs text-muted-foreground">{a.asset_tag}</span>}
              {selected === a.id && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
            </div>
          ))}
        </div>
      )}
      <button disabled={!selected || busy} onClick={async () => { setBusy(true); await onAction("asset_assign", { asset_id: selected }); setBusy(false) }}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Asset zuweisen
      </button>
    </div>
  )
}

function ActionAccessCodeGen({ onAction, order }: { onAction: (action: string, body?: any) => Promise<void>; order: any }) {
  const [busy, setBusy] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(order.access_code || null)

  const generate = async () => {
    setBusy(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "access_code_gen" })
    })
    const data = await res.json()
    if (data.access_code) setGeneratedCode(data.access_code)
    await onAction("_reload")
    setBusy(false)
  }

  if (generatedCode) return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Zugangscode für den Mitarbeiter:</p>
      <div className="inline-flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-3">
        <Key className="h-5 w-5 text-primary" />
        <span className="text-3xl font-mono font-bold tracking-widest text-primary">{generatedCode}</span>
      </div>
      <p className="text-xs text-muted-foreground">Teile diesen Code mit dem Mitarbeiter. Er wird bei der Übergabe benötigt.</p>
    </div>
  )

  return (
    <button disabled={busy} onClick={generate}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />} Zugangscode generieren
    </button>
  )
}

function ActionAccessCodeConfirm({ onAction, orderId }: { onAction: (action: string, body?: any) => Promise<void>; orderId: string }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (!code.trim()) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "access_code_confirm", code: code.trim() })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Fehler"); setBusy(false); return }
      await onAction("_reload")
    } catch { setError("Netzwerkfehler") }
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Vom Mitarbeiter genannten Zugangscode eingeben:</p>
      <div className="flex items-center gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="z.B. AX3K7P"
          maxLength={8}
          className="flex h-10 w-40 rounded-lg border border-input bg-background px-3 text-center font-mono text-lg font-bold tracking-widest uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button disabled={busy || !code.trim()} onClick={confirm}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Bestätigen
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function SupplierPanel({ supplier, orderTitle }: { supplier: any; orderTitle: string }) {
  const subject = encodeURIComponent(`Angebotsanfrage: ${orderTitle}`)
  const body = encodeURIComponent(`Sehr geehrte Damen und Herren,\n\nwir bitten um ein Angebot für folgendes Produkt:\n${orderTitle}\n\nBitte senden Sie uns Ihr Angebot an diese E-Mail-Adresse.\n\nMit freundlichen Grüßen`)
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lieferant</p>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{supplier.name}</p>
          {supplier.contact_email && <p className="text-xs text-muted-foreground truncate">{supplier.contact_email}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        {supplier.website && (
          <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            <ExternalLink className="h-3 w-3" /> Website öffnen
          </a>
        )}
        {supplier.contact_email && (
          <a href={`mailto:${supplier.contact_email}?subject=${subject}&body=${body}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors">
            <Mail className="h-3 w-3" /> Angebot anfordern
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)

  const load = async () => {
    const [orderRes, meRes] = await Promise.all([
      fetch(`/api/orders/${id}`).then(r => r.json()).catch(() => null),
      fetch("/api/auth/me").then(r => r.json()).catch(() => null),
    ])
    setOrder(orderRes)
    setSession(meRes)
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const doAction = async (action: string, body?: any) => {
    if (action === "_reload") { await load(); return }
    await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    })
    await load()
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!order || order.error) return <div className="text-muted-foreground py-16 text-center">Bestellung nicht gefunden.</div>

  const statusInfo = STATUS_CONFIG[order.status] || { label: order.status, color: "bg-muted text-muted-foreground" }
  const activeStep = order.steps?.find((s: any) => s.status === "active")
  const isDone = order.status === "completed" || order.status === "rejected"

  // Role-based permission check
  const myRoles: string[] = session?.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const isAdmin = myRoles.includes("admin")
  const stepRoles: string[] = activeStep?.assigned_roles
    ? activeStep.assigned_roles.split(",").map((r: string) => r.trim()).filter(Boolean)
    : []
  const canAct = !isDone && activeStep && (isAdmin || stepRoles.length === 0 || stepRoles.some((r: string) => myRoles.includes(r)))

  const actionType = activeStep?.action_type || "none"

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/orders")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="rounded-xl bg-primary/10 p-3">
            <ShoppingCart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">{order.order_number}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{order.title}</h1>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active step action panel */}
          {canAct && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold">{activeStep.step_name}</span>
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Aktiv</span>
                </div>
                <p className="text-xs text-muted-foreground">{ACTION_TYPE_LABELS[actionType]}</p>
                {stepRoles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Zuständig: {stepRoles.join(", ")}
                  </p>
                )}
              </div>
              {actionType === "none" && <ActionAdvance onAction={doAction} step={activeStep} />}
              {actionType === "cost_entry" && <ActionCostEntry onAction={doAction} />}
              {actionType === "cost_entry" && order.supplier_info && (
                <SupplierPanel supplier={order.supplier_info} orderTitle={order.title} />
              )}
              {actionType === "approval" && <ActionApproval onAction={doAction} />}
              {actionType === "asset_assign" && <ActionAssetAssign onAction={doAction} />}
              {actionType === "access_code_gen" && <ActionAccessCodeGen onAction={doAction} order={order} />}
              {actionType === "access_code_confirm" && <ActionAccessCodeConfirm onAction={doAction} orderId={id} />}
            </div>
          )}

          {/* No permission notice */}
          {!isDone && activeStep && !canAct && (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              Dieser Schritt wird bearbeitet von: <strong>{stepRoles.join(", ") || "beliebige Gruppe"}</strong>
            </div>
          )}

          {/* Progress Steps */}
          {order.steps?.length > 0 && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Fortschritt</h2>
              <div className="space-y-0">
                {order.steps.map((step: any, i: number) => (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <StepIcon status={step.status} />
                      {i < order.steps.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 ${step.status === "completed" ? "bg-emerald-400" : "bg-muted"}`} style={{ minHeight: "24px" }} />
                      )}
                    </div>
                    <div className="pb-5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${step.status === "active" ? "text-primary" : step.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.step_name}
                        </span>
                        {step.action_type && step.action_type !== "none" && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{ACTION_TYPE_LABELS[step.action_type] || step.action_type}</span>
                        )}
                      </div>
                      {step.completed_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(step.completed_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          {step.completed_by_name && ` · ${step.completed_by_name}`}
                        </p>
                      )}
                      {step.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{step.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {order.description && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Beschreibung</h2>
              <p className="text-sm whitespace-pre-wrap">{order.description}</p>
            </div>
          )}

          {/* Rejection reason */}
          {order.status === "rejected" && order.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-500/5 p-5">
              <h2 className="font-semibold text-sm text-red-600 uppercase tracking-wide mb-2">Ablehnungsgrund</h2>
              <p className="text-sm">{order.rejection_reason}</p>
            </div>
          )}

          {/* Items */}
          {order.items?.length > 0 && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Positionen</h2>
              <div className="space-y-2">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{item.item_name}</span>
                      {item.specs && <span className="text-xs text-muted-foreground">({item.specs})</span>}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>× {item.quantity}</span>
                      {item.unit_price && <span>{(item.unit_price * item.quantity).toFixed(2)} €</span>}
                    </div>
                  </div>
                ))}
                {order.total_cost && (
                  <div className="flex justify-end pt-2 font-semibold text-sm">
                    Gesamt: {parseFloat(order.total_cost).toFixed(2)} €
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Priorität</p>
                <p className="font-medium">{PRIORITY_LABELS[order.priority] || order.priority}</p>
              </div>
              {order.category_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Produktklasse</p>
                  <p className="font-medium">{order.category_name}</p>
                </div>
              )}
              {order.supplier && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Lieferant</p>
                  <p className="font-medium">{order.supplier}</p>
                </div>
              )}
              {order.total_cost && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Gesamtkosten</p>
                  <p className="font-medium">{parseFloat(order.total_cost).toFixed(2)} €</p>
                </div>
              )}
              {order.asset_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Zugewiesenes Asset</p>
                  <p className="font-medium">{order.asset_name}{order.asset_tag ? ` (${order.asset_tag})` : ""}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Angefragt von</p>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {order.requested_by_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <span>{order.requested_by_name}</span>
                </div>
              </div>
              {order.approved_by_name && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Genehmigt von</p>
                  <p className="font-medium">{order.approved_by_name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Erstellt</p>
                <p>{format(new Date(order.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>
              </div>
              {order.estimated_delivery && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Gewünschte Lieferung</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <p>{format(new Date(order.estimated_delivery), "dd.MM.yyyy", { locale: de })}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Available assets for quick assignment (privileged users only) */}
          {!isDone && myRoles.some(r => ["admin", "agent", "disposition", "assistenz", "fuehrungskraft"].includes(r)) && order.available_assets?.length > 0 && (
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Verfügbare Geräte</h2>
              </div>
              <div className="space-y-1.5">
                {order.available_assets.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-xs">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{a.name}</p>
                      {a.asset_tag && <p className="text-muted-foreground">{a.asset_tag}</p>}
                    </div>
                    <button
                      onClick={() => doAction("asset_assign", { asset_id: a.id })}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-1 text-[10px] font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Check className="h-2.5 w-2.5" /> Zuweisen
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Nicht zugewiesene Geräte passend zur Bestellung</p>
            </div>
          )}

          {/* Access code display for requester */}
          {order.access_code && order.status !== "completed" && (
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 text-center space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Dein Zugangscode</p>
              <div className="text-4xl font-mono font-bold tracking-widest text-primary">{order.access_code}</div>
              <p className="text-xs text-muted-foreground">Nenne diesen Code der IT bei der Geräteübergabe.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
