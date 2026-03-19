"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Headphones, Loader2, CheckCircle, ArrowRight, Building2, User, Lock, Database } from "lucide-react"

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0) // 0=check, 1=company, 2=admin, 3=done
  const [checking, setChecking] = useState(true)
  const [dbOk, setDbOk] = useState(false)
  const [hasUsers, setHasUsers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [company, setCompany] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [adminPassword2, setAdminPassword2] = useState("")

  const inp = "flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"

  useEffect(() => {
    fetch("/api/setup/check")
      .then(r => r.json())
      .then(d => { setDbOk(d.db_ok); setHasUsers(d.has_users); setChecking(false); if (d.has_users) router.push("/login") })
      .catch(() => { setChecking(false) })
  }, [])

  const finish = async () => {
    if (!adminName.trim() || !adminEmail.trim()) { setError("Name und E-Mail erforderlich"); return }
    if (adminPassword.length < 6) { setError("Passwort muss mind. 6 Zeichen haben"); return }
    if (adminPassword !== adminPassword2) { setError("Passwörter stimmen nicht überein"); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/setup/finish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: company, admin_name: adminName, admin_email: adminEmail, admin_password: adminPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep(3)
      setTimeout(() => router.push("/login"), 3000)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 mb-4">
            <Headphones className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">HelpDesk</h1>
          <p className="text-white/40 mt-1">Ersteinrichtung</p>
        </div>

        {checking ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mx-auto mb-3" />
            <p className="text-white/50">System wird geprüft...</p>
          </div>
        ) : step === 3 ? (
          /* ── Done ── */
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Einrichtung abgeschlossen!</h2>
            <p className="text-white/50 mb-6">Du wirst gleich zum Login weitergeleitet...</p>
            <Loader2 className="h-5 w-5 animate-spin text-white/30 mx-auto" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Steps indicator */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {[
                { icon: Database, label: "System" },
                { icon: Building2, label: "Firma" },
                { icon: User, label: "Admin" },
              ].map((s, i) => {
                const Icon = s.icon
                const active = step === i
                const done = step > i
                return (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-8 h-px ${done ? "bg-emerald-500" : "bg-white/10"}`} />}
                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      done ? "bg-emerald-500/20 text-emerald-400" : active ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-white/30"
                    }`}>
                      {done ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      {s.label}
                    </div>
                  </div>
                )
              })}
            </div>

            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}

            {/* Step 0: System check */}
            {step === 0 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Systemprüfung</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    {dbOk ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Loader2 className="h-4 w-4 text-red-400" />}
                    <span className={dbOk ? "text-white" : "text-red-400"}>Datenbankverbindung {dbOk ? "erfolgreich" : "fehlgeschlagen"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-white">Node.js Runtime</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-white">Next.js Framework</span>
                  </div>
                </div>
                {dbOk && (
                  <button onClick={() => setStep(1)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                    Weiter <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {!dbOk && <p className="text-xs text-red-400">Bitte .env.local prüfen und Datenbank starten.</p>}
              </div>
            )}

            {/* Step 1: Company */}
            {step === 1 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Unternehmen</h2>
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Unternehmensname</label>
                  <input className={inp} value={company} onChange={e => setCompany(e.target.value)} placeholder="Meine Firma GmbH" />
                </div>
                <button onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Weiter <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 2: Admin account */}
            {step === 2 && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Administrator-Account</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Name *</label>
                    <input className={inp} value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Max Mustermann" />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">E-Mail *</label>
                    <input type="email" className={inp} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@firma.de" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Passwort *</label>
                    <input type="password" className={inp} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Mind. 6 Zeichen" />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Passwort bestätigen *</label>
                    <input type="password" className={inp} value={adminPassword2} onChange={e => setAdminPassword2(e.target.value)} placeholder="Wiederholen" />
                  </div>
                </div>
                <button onClick={finish} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {saving ? "Wird eingerichtet..." : "Einrichtung abschließen"}
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-8">HelpDesk Core v1.0</p>
      </div>
    </div>
  )
}
