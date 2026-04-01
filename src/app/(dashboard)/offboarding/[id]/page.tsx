"use client"
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Loader2, UserMinus, CheckCircle2, Package, Send, Calendar,
  Mail, Building2, User, Clock, FileText, Settings, Search, Upload, X, Camera
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { format } from "date-fns"
import { de } from "date-fns/locale"

const STATUS_CFG: Record<string, { label: string; variant: string }> = {
  pending: { label: "Ausstehend", variant: "secondary" },
  in_progress: { label: "In Bearbeitung", variant: "info" },
  completed: { label: "Abgeschlossen", variant: "success" },
  cancelled: { label: "Abgebrochen", variant: "destructive" },
}

const EXIT_REASON_LABELS: Record<string, string> = {
  kuendigung: "Kündigung",
  aufhebung: "Aufhebung",
  befristung: "Befristung",
  ruhestand: "Ruhestand",
  sonstige: "Sonstige",
}

type ConditionField = { key: string; label: string; options: { value: string; label: string }[] }

const SMARTPHONE_FIELDS: ConditionField[] = [
  { key: "gehaeuse", label: "Gehäuse", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "gebrauchsspuren", label: "Gebrauchsspuren" }, { value: "beschaedigt", label: "Beschädigt" },
  ]},
  { key: "display", label: "Display", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "kratzer", label: "Kratzer" }, { value: "beschaedigt", label: "Beschädigt" }, { value: "defekt", label: "Defekt" },
  ]},
  { key: "ladekabel_netzteil", label: "Ladekabel + Netzteil", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" }, { value: "defekt", label: "Defekt" },
  ]},
  { key: "sim_karte", label: "SIM-Karte", options: [
    { value: "entfernt", label: "Entfernt" }, { value: "noch_eingelegt", label: "Noch eingelegt" }, { value: "nicht_vorhanden", label: "Nicht vorhanden" },
  ]},
  { key: "schutzhuelle", label: "Schutzhülle", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" }, { value: "beschaedigt", label: "Beschädigt" },
  ]},
]

const LAPTOP_FIELDS: ConditionField[] = [
  { key: "gehaeuse", label: "Gehäuse", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "gebrauchsspuren", label: "Gebrauchsspuren" }, { value: "beschaedigt", label: "Beschädigt" },
  ]},
  { key: "display", label: "Display", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "kratzer", label: "Kratzer" }, { value: "beschaedigt", label: "Beschädigt" }, { value: "defekt", label: "Defekt" },
  ]},
  { key: "tastatur", label: "Tastatur", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "abgenutzt", label: "Abgenutzt" }, { value: "defekt", label: "Defekt" },
  ]},
  { key: "touchpad", label: "Touchpad", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "defekt", label: "Defekt" },
  ]},
  { key: "ladekabel_netzteil", label: "Ladekabel + Netzteil", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" }, { value: "defekt", label: "Defekt" },
  ]},
  { key: "tasche_rucksack", label: "Tasche/Rucksack", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" },
  ]},
  { key: "dockingstation", label: "Dockingstation", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" }, { value: "nicht_zugehoerig", label: "Nicht zugehörig" },
  ]},
  { key: "maus", label: "Maus", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" },
  ]},
]

const MONITOR_FIELDS: ConditionField[] = [
  { key: "gehaeuse", label: "Gehäuse", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "gebrauchsspuren", label: "Gebrauchsspuren" }, { value: "beschaedigt", label: "Beschädigt" },
  ]},
  { key: "display_oberflaeche", label: "Display/Oberfläche", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "kratzer", label: "Kratzer" }, { value: "beschaedigt", label: "Beschädigt" },
  ]},
  { key: "kabel", label: "Kabel", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" },
  ]},
  { key: "standfuss_halterung", label: "Standfuß/Halterung", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" },
  ]},
]

const DEFAULT_FIELDS: ConditionField[] = [
  { key: "gehaeuse", label: "Gehäuse", options: [
    { value: "einwandfrei", label: "Einwandfrei" }, { value: "gebrauchsspuren", label: "Gebrauchsspuren" }, { value: "beschaedigt", label: "Beschädigt" },
  ]},
  { key: "zubehoer", label: "Zubehör", options: [
    { value: "vollstaendig", label: "Vollständig" }, { value: "unvollstaendig", label: "Unvollständig" }, { value: "fehlt", label: "Fehlt" },
  ]},
  { key: "kabel", label: "Kabel", options: [
    { value: "vorhanden", label: "Vorhanden" }, { value: "fehlt", label: "Fehlt" },
  ]},
]

function getConditionFields(device: any): ConditionField[] {
  const platform = (device.asset_platform || device.platform || "").toLowerCase()
  const type = (device.asset_type || device.type || "").toLowerCase()
  const name = (device.device_name || device.name || "").toLowerCase()

  // Smartphone/Tablet
  if (platform === "ios" || platform === "android") return SMARTPHONE_FIELDS

  // Laptop
  if (platform === "windows" || platform === "macos") return LAPTOP_FIELDS

  // Monitor/Peripherie
  if (platform === "other" || type.includes("monitor") || type.includes("dock") || type.includes("board")
      || name.includes("monitor") || name.includes("dock") || name.includes("board")) return MONITOR_FIELDS

  return DEFAULT_FIELDS
}

function isDamageValue(value: string): boolean {
  return value === "beschaedigt" || value === "defekt"
}

const inp = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export default function OffboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [returnModal, setReturnModal] = useState<any>(null)
  const [returnCondition, setReturnCondition] = useState<Record<string, string>>({})
  const [returnNote, setReturnNote] = useState("")
  const [returning, setReturning] = useState(false)
  const [returnPhotos, setReturnPhotos] = useState<{ field: string; url: string }[]>([])
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [conditionFields, setConditionFields] = useState<ConditionField[]>(DEFAULT_FIELDS)
  const [sendingMail, setSendingMail] = useState(false)
  const [showMailForm, setShowMailForm] = useState(false)
  const [privateEmail, setPrivateEmail] = useState("")
  const [ccAddresses, setCcAddresses] = useState("")
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [mailResult, setMailResult] = useState<any>(null)

  const load = async () => {
    const [d, me] = await Promise.all([
      fetch(`/api/offboarding/${id}`).then(r => r.json()),
      fetch("/api/auth/me").then(r => r.json()),
    ])
    setData(d)
    setSession(me)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!data || data.error) return <div className="text-center py-20 text-muted-foreground">Nicht gefunden</div>

  const status = STATUS_CFG[data.status] || STATUS_CFG.pending
  const checklist = data.checklist || []
  const devices = data.devices || []
  const completedChecklist = checklist.filter((c: any) => c.done).length
  const totalChecklist = checklist.length
  const devicesReturned = devices.filter((d: any) => d.status === "returned").length
  const devicesTotal = devices.length
  const allDevicesReturned = devicesTotal > 0 && devicesReturned === devicesTotal
  const roles = session?.role?.split(",").map((r: string) => r.trim()) || []
  const isAdminOrAgent = roles.includes("admin") || roles.includes("agent")

  const toggleChecklist = async (itemId: number) => {
    await fetch(`/api/offboarding/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_checklist", item_id: itemId }),
    })
    load()
  }

  const openReturnModal = (device: any) => {
    setReturnModal(device)
    const fields = getConditionFields(device)
    setConditionFields(fields)
    const initial: Record<string, string> = {}
    fields.forEach(f => { initial[f.key] = f.options[0]?.value || "einwandfrei" })
    setReturnCondition(initial)
    setReturnNote("")
    setReturnPhotos([])
  }

  const uploadPhoto = async (file: File, deviceId: number, field: string) => {
    setUploadingField(field)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("device_id", String(deviceId))
    formData.append("field", field)
    try {
      const res = await fetch(`/api/offboarding/${id}/devices/upload`, { method: "POST", body: formData })
      const result = await res.json()
      if (res.ok && result.url) {
        setReturnPhotos(prev => [...prev, { field, url: result.url }])
      } else {
        alert("Upload fehlgeschlagen: " + (result.error || "Unbekannter Fehler"))
      }
    } catch {
      alert("Upload fehlgeschlagen")
    }
    setUploadingField(null)
  }

  const removePhoto = (index: number) => {
    setReturnPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const submitReturn = async () => {
    if (!returnModal) return
    setReturning(true)
    await fetch(`/api/offboarding/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "return_device",
        device_id: returnModal.id,
        condition: returnCondition,
        note: returnNote,
        photos: returnPhotos.length > 0 ? returnPhotos : undefined,
      }),
    })
    setReturnModal(null)
    setReturning(false)
    load()
  }

  const updateStatus = async (newStatus: string) => {
    setUpdatingStatus(true)
    await fetch(`/api/offboarding/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status: newStatus }),
    })
    await load()
    setUpdatingStatus(false)
  }

  const sendConfirmationMail = async () => {
    if (!privateEmail || !privateEmail.includes("@")) { alert("Bitte private E-Mail-Adresse eingeben"); return }
    setSendingMail(true)
    const res = await fetch(`/api/offboarding/${id}/send-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ private_email: privateEmail, cc_addresses: ccAddresses }),
    })
    const result = await res.json()
    setSendingMail(false)
    if (!res.ok) { alert("Fehler: " + (result.error || "Unbekannter Fehler")); return }
    setMailResult(result)
    setShowMailForm(false)
    await load()
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/offboarding" className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 w-12 rounded-2xl bg-red-500 flex items-center justify-center text-white shrink-0">
            <UserMinus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{data.employee_name}</h1>
            <p className="text-sm text-muted-foreground">Offboarding</p>
          </div>
        </div>
        <Badge variant={status.variant as any} className="text-sm px-3 py-1">{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main content ─── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Employee Info Card */}
          <div className="rounded-2xl border bg-card shadow-sm p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Mitarbeiter-Informationen
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{data.employee_name}</span>
              </div>
              {data.employee_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">E-Mail:</span>
                  <span className="font-medium">{data.employee_email}</span>
                </div>
              )}
              {data.department && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Abteilung:</span>
                  <span className="font-medium">{data.department}</span>
                </div>
              )}
              {data.last_working_day && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Letzter Arbeitstag:</span>
                  <span className="font-medium">{format(new Date(data.last_working_day), "dd.MM.yyyy", { locale: de })}</span>
                </div>
              )}
              {data.exit_reason && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Austrittsgrund:</span>
                  <span className="font-medium">{EXIT_REASON_LABELS[data.exit_reason] || data.exit_reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Checkliste
                </h2>
                <span className="text-xs text-muted-foreground">{completedChecklist} / {totalChecklist}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-1">
                {checklist.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left transition-all hover:bg-muted/50 ${item.done ? "opacity-60" : ""}`}
                  >
                    <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      item.done ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"
                    }`}>
                      {item.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Device Returns */}
          {devices.length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" /> Geräte-Rückgabe
                </h2>
                <span className="text-xs text-muted-foreground">{devicesReturned} / {devicesTotal} zurückgegeben</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${devicesTotal > 0 ? (devicesReturned / devicesTotal) * 100 : 0}%` }}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Gerät</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Asset-Tag</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Seriennummer</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Zustand</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device: any) => (
                      <tr key={device.id} className="border-b last:border-0">
                        <td className="py-3 pr-3">
                          <p className="font-medium">{device.name || device.device_name}</p>
                          {device.type && <p className="text-xs text-muted-foreground">{device.type}</p>}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">{device.asset_tag || "—"}</td>
                        <td className="py-3 pr-3 text-muted-foreground">{device.serial_number || "—"}</td>
                        <td className="py-3 pr-3">
                          {device.status === 'returned' ? (
                            <div className="flex items-center gap-1.5 text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm">Zurückgegeben</span>
                            </div>
                          ) : (
                            <Badge variant="secondary">Ausstehend</Badge>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground text-sm">
                          {device.return_condition_summary || "—"}
                        </td>
                        <td className="py-3 text-right">
                          {device.status !== 'returned' && (
                            <Button variant="outline" size="sm" onClick={() => openReturnModal(device)}>
                              Zurücknehmen
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirmation Mail — already sent */}
          {data.confirmation_sent_at && (
            <div className="rounded-2xl border bg-emerald-500/5 border-emerald-500/20 shadow-sm overflow-hidden">
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <h2 className="text-sm font-semibold">Rückgabebestätigung versendet</h2>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Datum:</span> {new Date(data.confirmation_sent_at).toLocaleDateString("de-DE")} um {new Date(data.confirmation_sent_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</p>
                  {mailResult && (
                    <>
                      <p><span className="text-muted-foreground">AN:</span> {mailResult.sent_to}</p>
                      <p><span className="text-muted-foreground">BCC:</span> {mailResult.bcc}</p>
                      <p><span className="text-muted-foreground">CC:</span> {mailResult.cc?.join(", ") || "—"}</p>
                    </>
                  )}
                  {!mailResult && data.notes && (() => {
                    const logMatch = data.notes.match(/AN:\s*(.+)\nBCC:\s*(.+)\nCC:\s*(.+)/m)
                    if (!logMatch) return null
                    return (
                      <>
                        <p><span className="text-muted-foreground">AN:</span> {logMatch[1]}</p>
                        <p><span className="text-muted-foreground">BCC:</span> {logMatch[2]}</p>
                        <p><span className="text-muted-foreground">CC:</span> {logMatch[3]}</p>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Mail — not yet sent */}
          {allDevicesReturned && !data.confirmation_sent_at && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              {!showMailForm && (
                <div className="px-5 py-4 flex items-center justify-center">
                  <Button size="lg" className="w-full" onClick={() => setShowMailForm(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Geräterücknahme abschließen
                  </Button>
                </div>
              )}
              {showMailForm && (
                <>
                  <div className="px-5 py-3 border-b bg-muted/30">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Send className="h-4 w-4" /> Rückgabebestätigung versenden
                    </h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Private E-Mail-Adresse des Mitarbeiters (BCC) *</label>
                      <input
                        type="email"
                        className={inp}
                        placeholder="vorname.nachname@privat.de"
                        value={privateEmail}
                        onChange={e => setPrivateEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Wird als BCC gesendet — nicht für andere Empfänger sichtbar.</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Weitere Empfänger (CC)</label>
                      <input
                        type="text"
                        className={inp}
                        placeholder="person1@firma.de, person2@firma.de"
                        value={ccAddresses}
                        onChange={e => setCcAddresses(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Komma-getrennt. Ersteller des Offboardings und durchführender Agent werden automatisch ins CC genommen.</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        AN: {data.employee_email || "—"} · BCC: {privateEmail || "—"} · CC: Ersteller + Agent {ccAddresses ? `+ ${ccAddresses}` : ""}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowMailForm(false)}>Abbrechen</Button>
                        <Button size="sm" onClick={sendConfirmationMail} disabled={sendingMail || !privateEmail}>
                          {sendingMail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                          Bestätigung senden
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4">
          {/* Status Card */}
          {isAdminOrAgent && (
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Status ändern</h3>
              <select
                className={inp}
                value={data.status}
                onChange={e => updateStatus(e.target.value)}
                disabled={updatingStatus}
              >
                <option value="pending">Ausstehend</option>
                <option value="in_progress">In Bearbeitung</option>
                <option value="completed">Abgeschlossen</option>
                <option value="cancelled">Abgebrochen</option>
              </select>
            </div>
          )}

          {/* Progress Overview */}
          <div className="rounded-2xl border bg-card shadow-sm p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fortschritt</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Checkliste</span>
                <span className="font-medium">{completedChecklist} / {totalChecklist} Punkte</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Geräte</span>
                <span className="font-medium">{devicesReturned} / {devicesTotal} zurück</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</h3>
            {data.created_at && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Erstellt: {format(new Date(data.created_at), "dd.MM.yyyy", { locale: de })}</span>
              </div>
            )}
            {data.created_by_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Von: {data.created_by_name}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {data.notes && (
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Anmerkungen</h3>
              <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
            </div>
          )}

          {/* Back link */}
          <Link
            href="/offboarding"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Übersicht
          </Link>
        </div>
      </div>

      {/* ─── Return Device Modal ─── */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setReturnModal(null)} />
          <div className="relative bg-card border rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Gerät zurücknehmen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {returnModal.name || returnModal.device_name}
                {returnModal.asset_tag ? ` (${returnModal.asset_tag})` : ""}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-medium">Zustandsbewertung</h3>
              {conditionFields.map(field => (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm text-muted-foreground shrink-0 w-36">{field.label}</label>
                    <select
                      className={inp}
                      value={returnCondition[field.key] || field.options[0]?.value}
                      onChange={e => setReturnCondition(prev => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      {field.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {isDamageValue(returnCondition[field.key]) && (
                    <div className="ml-36 pl-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {returnPhotos.filter(p => p.field === field.key).map((photo, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={photo.url}
                              alt={`${field.label} Foto`}
                              className="h-16 w-16 object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(returnPhotos.indexOf(photo))}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <label className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors">
                          {uploadingField === field.key ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <Camera className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground mt-0.5">Foto</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingField !== null}
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f && returnModal) uploadPhoto(f, returnModal.id, field.key)
                              e.target.value = ""
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Foto der Beschädigung hinzufügen</p>
                    </div>
                  )}
                </div>
              ))}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Notiz</label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={returnNote}
                  onChange={e => setReturnNote(e.target.value)}
                  placeholder="Optionale Notiz zum Zustand..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setReturnModal(null)}>Abbrechen</Button>
              <Button onClick={submitReturn} disabled={returning}>
                {returning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Zurücknehmen
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
