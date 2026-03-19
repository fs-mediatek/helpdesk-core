"use client"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, UserPlus, UserMinus, CheckCircle, Circle, ChevronRight,
  Clock, User, Building2, Mail, Calendar, FileText, Users, MessageSquare, GitBranch
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const STATUS_CFG: Record<string, { label: string; variant: string }> = {
  pending: { label: "Ausstehend", variant: "secondary" },
  in_progress: { label: "In Bearbeitung", variant: "info" },
  completed: { label: "Abgeschlossen", variant: "success" },
  cancelled: { label: "Abgebrochen", variant: "destructive" },
}

const STEP_STATUS_ICON: Record<string, any> = {
  completed: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  active: <div className="h-5 w-5 rounded-full border-[3px] border-primary animate-pulse" />,
  pending: <Circle className="h-5 w-5 text-muted-foreground/30" />,
  skipped: <Circle className="h-5 w-5 text-muted-foreground/20 line-through" />,
}

export default function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [advancing, setAdvancing] = useState(false)
  const [notes, setNotes] = useState("")

  const load = async () => {
    const [d, me] = await Promise.all([
      fetch(`/api/onboarding/${id}`).then(r => r.json()),
      fetch("/api/auth/me").then(r => r.json()),
    ])
    setData(d)
    setSession(me)
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!data || data.error) return <div className="text-center py-20 text-muted-foreground">Nicht gefunden</div>

  const isOnboarding = data.type === "onboarding"
  const status = STATUS_CFG[data.status] || STATUS_CFG.pending
  const steps = data.steps || []
  const checklist = data.checklist || []
  const stepDefs = data.stepDefs || []
  const currentStep = steps.find((s: any) => s.status === "active")
  const currentStepDef = stepDefs.find((d: any) => d.step_order === currentStep?.step_order)
  const roles = session?.role?.split(",").map((r: string) => r.trim()) || []
  const assignedRoles = currentStepDef?.assigned_roles?.split(",").map((r: string) => r.trim()) || []
  const canAct = roles.includes("admin") || assignedRoles.length === 0 || roles.some((r: string) => assignedRoles.includes(r))
  const allDone = data.status === "completed"

  const advance = async () => {
    setAdvancing(true)
    await fetch(`/api/onboarding/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance", notes }),
    })
    setNotes("")
    await load()
    setAdvancing(false)
  }

  const toggleChecklist = async (itemId: number) => {
    await fetch(`/api/onboarding/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_checklist", item_id: itemId }),
    })
    load()
  }

  const completedChecklist = checklist.filter((c: any) => c.done).length
  const totalChecklist = checklist.length

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/p/onboarding" className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${isOnboarding ? "bg-emerald-600" : "bg-red-500"}`}>
            {isOnboarding ? <UserPlus className="h-6 w-6" /> : <UserMinus className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold">{data.employee_name}</h1>
            <p className="text-sm text-muted-foreground">{isOnboarding ? "Onboarding" : "Offboarding"}</p>
          </div>
        </div>
        <Badge variant={status.variant as any} className="text-sm px-3 py-1">{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main content ─── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Workflow Progress */}
          <div className="rounded-2xl border bg-card shadow-sm p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><GitBranch className="h-4 w-4 text-muted-foreground" /> Fortschritt</h2>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Kein Workflow konfiguriert. Bitte unter Workflows definieren.</p>
            ) : (
              <div className="space-y-0">
                {steps.map((step: any, i: number) => {
                  const isActive = step.status === "active"
                  const isCompleted = step.status === "completed"
                  return (
                    <div key={step.id} className="flex gap-3">
                      {/* Timeline line + icon */}
                      <div className="flex flex-col items-center">
                        <div className="shrink-0">{STEP_STATUS_ICON[step.status]}</div>
                        {i < steps.length - 1 && (
                          <div className={`w-0.5 flex-1 min-h-[24px] my-1 ${isCompleted ? "bg-emerald-500/40" : "bg-muted-foreground/15"}`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className={`flex-1 pb-4 ${isActive ? "" : ""}`}>
                        <p className={`text-sm font-medium ${isCompleted ? "text-emerald-600" : isActive ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.step_name}
                        </p>
                        {isCompleted && step.completed_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Abgeschlossen am {new Date(step.completed_at).toLocaleDateString("de-DE")}
                            {step.notes && ` — ${step.notes}`}
                          </p>
                        )}
                        {isActive && canAct && !allDone && (
                          <div className="mt-3 rounded-xl border bg-primary/5 border-primary/20 p-3 space-y-2">
                            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              placeholder="Optionale Notiz zum Schritt..." />
                            <Button size="sm" onClick={advance} disabled={advancing}>
                              {advancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5" /> Schritt abschließen</>}
                            </Button>
                          </div>
                        )}
                        {isActive && !canAct && (
                          <p className="text-xs text-amber-600 mt-1">Zuständig: {assignedRoles.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Checkliste</h2>
                <span className="text-xs text-muted-foreground">{completedChecklist} / {totalChecklist}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0}%` }} />
              </div>
              <div className="space-y-1">
                {checklist.map((item: any) => (
                  <button key={item.id} onClick={() => toggleChecklist(item.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-all hover:bg-muted/50 ${item.done ? "opacity-60" : ""}`}>
                    <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      item.done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"
                    }`}>
                      {item.done && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4">
          {/* Details */}
          <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</h3>
            {data.employee_email && (
              <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span>{data.employee_email}</span></div>
            )}
            {data.department && (
              <div className="flex items-center gap-2 text-sm"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /><span>{data.department}</span></div>
            )}
            {data.start_date && (
              <div className="flex items-center gap-2 text-sm"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /><span>{isOnboarding ? "Start" : "Letzter Tag"}: {new Date(data.start_date).toLocaleDateString("de-DE")}</span></div>
            )}
            {data.assigned_to_name && (
              <div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" /><span>Zuständig: {data.assigned_to_name}</span></div>
            )}
            <div className="flex items-center gap-2 text-sm"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span>Erstellt: {new Date(data.created_at).toLocaleDateString("de-DE")}</span></div>
            {data.created_by_name && (
              <div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" /><span>Von: {data.created_by_name}</span></div>
            )}
          </div>

          {/* Notes */}
          {data.notes && (
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notizen</h3>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}

          {/* Quick stats */}
          <div className="rounded-2xl border bg-card shadow-sm p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Workflow</span>
                <span className="font-medium">{steps.filter((s: any) => s.status === "completed").length} / {steps.length} Schritte</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Checkliste</span>
                <span className="font-medium">{completedChecklist} / {totalChecklist} Punkte</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
