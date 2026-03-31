"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Settings, Save, Send, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const inp = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export default function OffboardingSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [checklistText, setChecklistText] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")

  useEffect(() => {
    fetch("/api/offboarding/config")
      .then(r => r.json())
      .then(data => {
        if (data.checklist) {
          setChecklistText(Array.isArray(data.checklist) ? data.checklist.join("\n") : data.checklist)
        }
        if (data.email_subject) setEmailSubject(data.email_subject)
        if (data.email_body) setEmailBody(data.email_body)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch("/api/offboarding/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist: checklistText.split("\n").map(l => l.trim()).filter(Boolean),
          email_subject: emailSubject,
          email_body: emailBody,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || "Fehler beim Speichern.")
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.")
    }
    setSaving(false)
  }

  const sendTestMail = async () => {
    setSendingTest(true)
    setTestSent(false)
    try {
      const res = await fetch("/api/offboarding/config/test-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_subject: emailSubject,
          email_body: emailBody,
        }),
      })
      if (res.ok) {
        setTestSent(true)
        setTimeout(() => setTestSent(false), 3000)
      }
    } catch {
      // ignore
    }
    setSendingTest(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/offboarding" className="p-2 rounded-lg border hover:bg-muted transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-11 w-11 rounded-xl bg-red-500 flex items-center justify-center text-white">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Offboarding-Konfiguration</h1>
            <p className="text-sm text-muted-foreground">Checkliste und E-Mail-Vorlage verwalten</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-200 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6 animate-fade-in">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Default Checklist */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="px-6 py-3 border-b bg-muted/20">
            <h2 className="font-semibold text-sm">Default-Checkliste</h2>
          </div>
          <div className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ein Eintrag pro Zeile. Diese Checkliste wird bei jedem neuen Offboarding automatisch erstellt.
            </p>
            <textarea
              rows={10}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={checklistText}
              onChange={e => setChecklistText(e.target.value)}
              placeholder={"E-Mail-Konto deaktivieren\nVPN-Zugang sperren\nAD-Konto deaktivieren\nSchlüssel einsammeln\n..."}
            />
          </div>
        </div>

        {/* Section 2: Email Template */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="px-6 py-3 border-b bg-muted/20">
            <h2 className="font-semibold text-sm">E-Mail-Vorlage</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Betreff</label>
              <input
                className={inp}
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Bestätigung Geräte-Rückgabe - {{name}}"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Inhalt (HTML)</label>
              <textarea
                rows={12}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                placeholder={"<p>Hallo {{name}},</p>\n<p>hiermit bestätigen wir die Rückgabe folgender Geräte:</p>\n{{devices}}\n<p>Letzter Arbeitstag: {{date}}</p>\n<p>Mit freundlichen Grüßen<br>{{company}}</p>"}
              />
            </div>
            <div className="rounded-lg bg-muted/30 border px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Verfügbare Platzhalter:</p>
              <div className="flex flex-wrap gap-2">
                {["{{name}}", "{{date}}", "{{devices}}", "{{company}}"].map(ph => (
                  <code key={ph} className="text-xs bg-muted px-2 py-1 rounded font-mono">{ph}</code>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={sendTestMail} disabled={sendingTest}>
                {sendingTest ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : testSent ? (
                  <>Gesendet!</>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Test-Mail senden
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end mt-8 pt-6 border-t gap-3">
        {saved && <span className="text-sm text-emerald-600">Gespeichert!</span>}
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              Speichern
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
