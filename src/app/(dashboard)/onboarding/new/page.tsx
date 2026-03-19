"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Loader2, UserPlus, UserMinus, Save, Plus, X, FolderOpen, FolderClosed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import Link from "next/link"

// ─── Multi-item list component ───
function MultiItemList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("")
  const add = () => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft("") } }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2">
          <span className="flex-1 text-sm whitespace-pre-wrap">{item}</span>
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="p-0.5 text-muted-foreground hover:text-red-500 shrink-0 mt-0.5"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <input className={inp} value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }} />
        <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()} type="button"><Plus className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  )
}

const inp = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="px-6 py-3 border-b bg-muted/20"><h2 className="font-semibold text-sm">{title}</h2></div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

function Toggle({ label, checked, onChange: onToggle }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <button type="button" onClick={() => onToggle(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/20"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  )
}

export default function NewOnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get("type") || "onboarding"
  const isOnboarding = typeParam === "onboarding"

  const [form, setForm] = useState<Record<string, any>>({
    type: typeParam,
    employee_number: "", first_name: "", last_name: "", employee_email: "", birth_date: "",
    onboarding_status: "", department: "", hire_date: "", timecard_date: "", contract_end_date: "",
    weekly_hours: "", break_times: "", vacation_current: "", vacation_full: "",
    location_id: "", room_number: "", phone_extension: "", supervisor_id: "", cost_center: "",
    project: "", folders_open: [] as string[], folders_close: [] as string[],
    project_emails: [] as string[], job_title: "", access_stepnova: false, stepnova_assignment: "",
    access_datev: false, access_elo: false, elo_client: "", facility_notes: "", notes: "",
  })

  const [departments, setDepartments] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [supervisors, setSupervisors] = useState<any[]>([])
  const [options, setOptions] = useState<Record<string, any>>({})
  const [phonePrefix, setPhonePrefix] = useState("03641 806")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Load base data
  useEffect(() => {
    Promise.all([
      fetch("/api/departments").then(r => r.json()).catch(() => []),
      fetch("/api/locations").then(r => r.json()).catch(() => []),
      fetch("/api/onboarding/options").then(r => r.json()).catch(() => ({})),
    ]).then(([deps, locs, opts]) => {
      setDepartments(Array.isArray(deps) ? deps : [])
      setLocations(Array.isArray(locs) ? locs : [])
      setOptions(opts || {})
      if (opts?._phone_prefix) setPhonePrefix(opts._phone_prefix)
    })
  }, [])

  // Load supervisors when department changes
  useEffect(() => {
    const dept = form.department
    fetch(`/api/onboarding/supervisors?department=${encodeURIComponent(dept || "")}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setSupervisors(list)
        // Auto-select if exactly one supervisor for this department
        if (dept && list.length === 1) {
          set("supervisor_id", String(list[0].id))
        } else if (dept && list.length > 0 && !list.find((s: any) => String(s.id) === form.supervisor_id)) {
          // Current selection not in new list — auto-select first
          set("supervisor_id", String(list[0].id))
        }
      })
      .catch(() => setSupervisors([]))
  }, [form.department])

  const set = (key: string, value: any) => {
    setForm(f => ({ ...f, [key]: value }))
    if (fieldError === key) { setFieldError(null); setError(null) }
  }

  // Check if department is "Aus- & Weiterbildung" or sub
  const showBreakTimes = departments.some(d =>
    (d.name === form.department || d.display_name?.includes(form.department)) &&
    (d.display_name?.includes("Aus- & Weiterbildung") || d.name === "Aus- & Weiterbildung" || form.department === "Aus- & Weiterbildung")
  ) || form.department === "Aus- & Weiterbildung"

  const goToEquipment = () => {
    // Validate required fields and scroll to first missing
    const checks: { key: string; ref: string; msg: string }[] = [
      { key: "first_name", ref: "first_name", msg: "Vorname erforderlich" },
      { key: "last_name", ref: "last_name", msg: "Nachname erforderlich" },
    ]
    for (const c of checks) {
      if (!form[c.key]?.trim()) {
        setError(c.msg)
        setFieldError(c.key)
        const el = document.querySelector(`[data-field="${c.ref}"]`)
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
        ;(el?.querySelector("input, select") as HTMLElement)?.focus()
        return
      }
    }
    setFieldError(null)
    setError(null)
    sessionStorage.setItem("onboarding_draft", JSON.stringify(form))
    router.push("/onboarding/new/equipment")
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/p/onboarding" className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex items-center gap-3 flex-1">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-white ${isOnboarding ? "bg-emerald-600" : "bg-red-500"}`}>
            {isOnboarding ? <UserPlus className="h-5 w-5" /> : <UserMinus className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold">{isOnboarding ? "Neues Onboarding" : "Neues Offboarding"}</h1>
            <p className="text-sm text-muted-foreground">{isOnboarding ? "Neuen Mitarbeiter anlegen" : "Offboarding-Prozess starten"}</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6 animate-fade-in">{error}</div>}

      <div className="space-y-6">

        {/* ═══ Persönliche Daten ═══ */}
        <Section title="Persönliche Daten">
          <div className="grid grid-cols-2 gap-4">
            <div data-field="first_name">
              <label className={`text-sm font-medium mb-1.5 block ${fieldError === "first_name" ? "text-red-500" : ""}`}>Vorname *</label>
              <input className={`${inp} ${fieldError === "first_name" ? "border-red-500 ring-1 ring-red-500/30" : ""}`} value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="Max" />
              {fieldError === "first_name" && <p className="text-[11px] text-red-500 mt-1">Bitte Vorname eingeben</p>}
            </div>
            <div data-field="last_name">
              <label className={`text-sm font-medium mb-1.5 block ${fieldError === "last_name" ? "text-red-500" : ""}`}>Nachname *</label>
              <input className={`${inp} ${fieldError === "last_name" ? "border-red-500 ring-1 ring-red-500/30" : ""}`} value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="Mustermann" />
              {fieldError === "last_name" && <p className="text-[11px] text-red-500 mt-1">Bitte Nachname eingeben</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mitarbeiternummer</label>
              <input className={inp} value={form.employee_number} onChange={e => set("employee_number", e.target.value)} placeholder="z.B. 10042" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Geburtsdatum</label>
              <DatePicker value={form.birth_date} onChange={v => set("birth_date", v)} placeholder="TT.MM.JJJJ" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">E-Mail-Adresse</label>
              <input type="email" className={inp} value={form.employee_email} onChange={e => set("employee_email", e.target.value)} placeholder="max.mustermann@firma.de" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <select className={inp} value={form.onboarding_status} onChange={e => set("onboarding_status", e.target.value)}>
                <option value="">— Auswählen —</option>
                {(options.status || []).map((o: any) => <option key={o.id} value={o.value}>{o.value}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* ═══ Beschäftigung ═══ */}
        <Section title="Beschäftigung">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Neueinstellung zum</label>
              <DatePicker value={form.hire_date} onChange={v => set("hire_date", v)} placeholder="Datum wählen" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">In timeCard zu führen ab</label>
              <DatePicker value={form.timecard_date} onChange={v => set("timecard_date", v)} placeholder="Datum wählen" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Befristung bis</label>
              <DatePicker value={form.contract_end_date} onChange={v => set("contract_end_date", v)} placeholder="Unbefristet" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Wochenstunden / Verteilung</label>
              <input className={inp} value={form.weekly_hours} onChange={e => set("weekly_hours", e.target.value)} placeholder="z.B. 40h / Mo-Fr" />
            </div>
          </div>
          {showBreakTimes && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Pausenzeiten</label>
              <input className={inp} value={form.break_times} onChange={e => set("break_times", e.target.value)} placeholder="z.B. 30 Min. ab 6h, 45 Min. ab 9h" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Urlaub im aktuellen Jahr</label>
              <input className={inp} value={form.vacation_current} onChange={e => set("vacation_current", e.target.value)} placeholder="z.B. 15 Tage (anteilig)" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Urlaub für ein volles Jahr</label>
              <input className={inp} value={form.vacation_full} onChange={e => set("vacation_full", e.target.value)} placeholder="z.B. 30 Tage" />
            </div>
          </div>
        </Section>

        {/* ═══ Organisatorisches ═══ */}
        <Section title="Organisatorisches">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Bereich / Abteilung</label>
              <select className={inp} value={form.department} onChange={e => set("department", e.target.value)}>
                <option value="">— Auswählen —</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.display_name || d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Vorgesetzte/r</label>
              <select className={inp} value={form.supervisor_id} onChange={e => set("supervisor_id", e.target.value)}>
                <option value="">— Auswählen —</option>
                {supervisors.map((u: any) => <option key={u.id} value={u.id}>{u.name}{u.department ? ` (${u.department})` : ""}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Jobbezeichnung</label>
              <select className={inp} value={form.job_title} onChange={e => set("job_title", e.target.value)}>
                <option value="">— Auswählen —</option>
                {(options.jobtitel || []).map((o: any) => <option key={o.id} value={o.value}>{o.value}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Maßnahme / Projekt</label>
              <select className={inp} value={form.project} onChange={e => set("project", e.target.value)}>
                <option value="">— Auswählen —</option>
                {(options.massnahme || []).map((o: any) => <option key={o.id} value={o.value}>{o.value}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Kostenstelle</label>
              <input className={inp} value={form.cost_center} onChange={e => set("cost_center", e.target.value)} placeholder="Kostenstelle suchen..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Standort</label>
              <select className={inp} value={form.location_id} onChange={e => set("location_id", e.target.value)}>
                <option value="">— Auswählen —</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Raumnummer</label>
              <input className={inp} value={form.room_number} onChange={e => set("room_number", e.target.value)} placeholder="z.B. 2.14" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Rufnummer (Nebenstelle)</label>
              <div className="flex items-center gap-0">
                <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-input bg-muted/50 px-3 text-sm text-muted-foreground shrink-0">{phonePrefix}</span>
                <input className={inp + " rounded-l-none"} value={form.phone_extension} onChange={e => set("phone_extension", e.target.value)} placeholder="123" />
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ Projekt-E-Mails ═══ */}
        <Section title="Projekt- oder sachbezogene E-Mail-Adressen">
          <MultiItemList items={form.project_emails} onChange={v => set("project_emails", v)} placeholder="E-Mail-Adresse eingeben und Enter drücken..." />
        </Section>

        {/* ═══ Ordner & Berechtigungen ═══ */}
        <Section title="Ordner & Berechtigungen">
          <div>
            <label className="text-sm font-medium mb-1.5 flex items-center gap-2 block"><FolderOpen className="h-4 w-4 text-emerald-500" /> Freizugebende Ordner</label>
            <MultiItemList items={form.folders_open} onChange={v => set("folders_open", v)} placeholder="Ordnerpfad eingeben und Enter drücken..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 flex items-center gap-2 block"><FolderClosed className="h-4 w-4 text-red-500" /> Zu sperrende Ordner</label>
            <MultiItemList items={form.folders_close} onChange={v => set("folders_close", v)} placeholder="Ordnerpfad eingeben und Enter drücken..." />
          </div>
        </Section>

        {/* ═══ Systemzugänge ═══ */}
        <Section title="Systemzugänge">
          <Toggle label="Zugang zu StepNova erforderlich" checked={form.access_stepnova} onChange={v => set("access_stepnova", v)} />
          {form.access_stepnova && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Zuordnung zu Maßnahme in StepNova</label>
              <input className={inp} value={form.stepnova_assignment} onChange={e => set("stepnova_assignment", e.target.value)} placeholder="Maßnahme in StepNova..." />
            </div>
          )}
          <Toggle label="Zugang zu DATEV erforderlich" checked={form.access_datev} onChange={v => set("access_datev", v)} />
          <Toggle label="Zugang zu ELO erforderlich" checked={form.access_elo} onChange={v => set("access_elo", v)} />
          {form.access_elo && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">ELO-Client</label>
              <div className="flex gap-3">
                {["ELO Java-Client", "ELO Webclient"].map(opt => (
                  <button key={opt} type="button" onClick={() => set("elo_client", opt)}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                      form.elo_client === opt ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:border-muted-foreground/30"
                    }`}>{opt}</button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ═══ Notizen ═══ */}
        <Section title="Weitere Notizen">
          <textarea rows={3} className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="Sonstige Hinweise..." />
        </Section>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <Link href="/p/onboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Abbrechen</Link>
        <Button onClick={goToEquipment} size="lg">
          Weiter zu Ausstattung & Facility <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
