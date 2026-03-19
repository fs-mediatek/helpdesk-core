"use client"
import { useState, useEffect } from "react"
import { Smartphone, Monitor, X, Loader2, CheckCircle, Check } from "lucide-react"

const PLATFORM_EMOJI: Record<string, string> = {
  windows: "🪟",
  android: "🤖",
  ios: "🍎",
}

export function DeviceClaimPrompt() {
  const [devices, setDevices] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [visible, setVisible] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState(false)
  const [claimedCount, setClaimedCount] = useState(0)
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(me => {
        if (!me?.email) return
        setUserEmail(me.email)
        const key = `device_claim_dismissed_${me.email}`
        const dismissed = localStorage.getItem(key)
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return
        return fetch("/api/assets/claim")
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setDevices(data)
              setSelected(new Set(data.map((d: any) => d.id)))
              setVisible(true)
            }
          })
      })
      .catch(() => {})
  }, [])

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const claim = async () => {
    if (selected.size === 0) return
    setClaiming(true)
    try {
      await fetch("/api/assets/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: Array.from(selected) }),
      })
      setClaimedCount(selected.size)
      setDone(true)
      setTimeout(() => setVisible(false), 2500)
    } catch {
      setClaiming(false)
    }
  }

  const dismiss = () => {
    if (userEmail) {
      localStorage.setItem(`device_claim_dismissed_${userEmail}`, Date.now().toString())
    }
    setVisible(false)
  }

  if (!visible) return null

  const hasAndroid = devices.some(d => d.platform === "android")
  const hasWindows = devices.some(d => d.platform === "windows")

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-md animate-slide-up">
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
        <div className={`px-5 py-3 flex items-center justify-between ${
          hasAndroid && !hasWindows
            ? "bg-gradient-to-r from-emerald-600 to-teal-600"
            : "bg-gradient-to-r from-blue-600 to-indigo-600"
        }`}>
          <div className="flex items-center gap-2 text-white">
            {hasAndroid && !hasWindows ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            <span className="font-semibold text-sm">Geräte erkannt</span>
          </div>
          <button onClick={dismiss} className="text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
              <p className="font-medium text-sm">{claimedCount} Gerät(e) erfolgreich übernommen!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Wählen Sie die Geräte aus, die Sie übernehmen möchten:
              </p>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {devices.map(d => {
                  const isSelected = selected.has(d.id)
                  return (
                    <button key={d.id} onClick={() => toggle(d.id)}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "bg-muted/30 hover:bg-muted/50 opacity-60"
                      }`}>
                      <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-lg">{PLATFORM_EMOJI[d.platform] || "📦"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {d.friendly_name || d.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.platform === "android"
                            ? [d.phone_number, d.serial_number].filter(Boolean).join(" · ")
                            : [d.manufacturer, d.model].filter(Boolean).join(" ") || d.serial_number || ""}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={dismiss}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  Später
                </button>
                <button onClick={claim} disabled={claiming || selected.size === 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {claiming
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : selected.size === 0
                      ? "Auswahl treffen"
                      : `${selected.size} übernehmen`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
