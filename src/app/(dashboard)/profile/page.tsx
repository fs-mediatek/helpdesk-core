"use client"
import { useState, useEffect } from "react"
import { Loader2, Save, User, Bell, Lock, Mail, Phone, Building2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const NOTIFY_OPTIONS = [
  { key: "notify_ticket_created", label: "Neues Ticket erstellt", desc: "Wenn ein Ticket in meinem Namen erstellt wird" },
  { key: "notify_ticket_status", label: "Statusänderung", desc: "Wenn sich der Status meines Tickets ändert (z.B. In Bearbeitung, Gelöst)" },
  { key: "notify_ticket_comment", label: "Neuer Kommentar", desc: "Wenn jemand einen Kommentar zu meinem Ticket schreibt" },
  { key: "notify_ticket_assigned", label: "Ticket zugewiesen", desc: "Wenn mir ein Ticket zur Bearbeitung zugewiesen wird" },
  { key: "notify_order_status", label: "Bestellstatus", desc: "Wenn sich der Status meiner Bestellung ändert" },
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const load = () => {
    fetch("/api/profile")
      .then(r => r.json())
      .then(data => { setProfile(data); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => {
    load()
    fetch("/api/departments").then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const save = async () => {
    setError(null)
    if (newPassword && newPassword !== confirmPassword) {
      setError("Passwörter stimmen nicht überein")
      return
    }
    if (newPassword && newPassword.length < 6) {
      setError("Passwort muss mind. 6 Zeichen haben")
      return
    }
    setSaving(true)
    try {
      const body: any = {
        phone: profile.phone,
        department: profile.department,
        notify_ticket_created: profile.notify_ticket_created,
        notify_ticket_status: profile.notify_ticket_status,
        notify_ticket_comment: profile.notify_ticket_comment,
        notify_ticket_assigned: profile.notify_ticket_assigned,
        notify_order_status: profile.notify_order_status,
      }
      if (newPassword) body.new_password = newPassword
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  const toggleNotify = (key: string) => {
    setProfile((p: any) => ({ ...p, [key]: p[key] ? 0 : 1 }))
  }

  const inp = "flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (!profile) return null

  const initials = profile.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mein Profil</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Persönliche Einstellungen und Benachrichtigungen</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere...</>
            : saved ? <><CheckCircle className="h-4 w-4" />Gespeichert</>
            : <><Save className="h-4 w-4" />Speichern</>}
        </Button>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 border border-red-200 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

      {/* Profile card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{profile.role}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Persönliche Daten</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <div className="flex h-9 items-center rounded-lg border bg-muted/30 px-3 text-sm">{profile.name}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-Mail</label>
              <div className="flex h-9 items-center rounded-lg border bg-muted/30 px-3 text-sm">{profile.email}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone className="h-3 w-3" /> Telefon</label>
              <input className={inp} value={profile.phone || ""} onChange={e => setProfile((p: any) => ({ ...p, phone: e.target.value }))} placeholder="+49 ..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Building2 className="h-3 w-3" /> Abteilung</label>
              <select className={inp} value={profile.department || ""} onChange={e => setProfile((p: any) => ({ ...p, department: e.target.value }))}>
                <option value="">— Keine —</option>
                {departments.map(d => <option key={d.id} value={d.name}>{(d as any).display_name || d.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Notification preferences */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">E-Mail-Benachrichtigungen</span>
        </div>
        <div className="divide-y">
          {NOTIFY_OPTIONS.map(opt => {
            const enabled = !!profile[opt.key]
            return (
              <div key={opt.key} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">{opt.desc}</p>
                </div>
                <button
                  onClick={() => toggleNotify(opt.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="px-6 py-3 bg-muted/20 border-t">
          <p className="text-xs text-muted-foreground">Benachrichtigungen in der App (Glocke) sind immer aktiv. Hier steuern Sie nur die E-Mail-Benachrichtigungen.</p>
        </div>
      </div>

      {/* Password change */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Passwort ändern</span>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Neues Passwort</label>
            <input type="password" className={inp} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mind. 6 Zeichen" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Passwort bestätigen</label>
            <input type="password" className={inp} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Passwort wiederholen" />
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500">Passwörter stimmen nicht überein</p>
          )}
          <p className="text-xs text-muted-foreground">Leer lassen, wenn das Passwort nicht geändert werden soll.</p>
        </div>
      </div>
    </div>
  )
}
