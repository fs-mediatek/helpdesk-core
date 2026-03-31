"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, UserMinus, Search, Calendar, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { de } from "date-fns/locale"

const inp = "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

const EXIT_REASONS = [
  { value: "kuendigung", label: "Kündigung" },
  { value: "aufhebung", label: "Aufhebung" },
  { value: "befristung", label: "Befristung" },
  { value: "ruhestand", label: "Ruhestand" },
  { value: "sonstige", label: "Sonstige" },
]

export default function NewOffboardingPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [lastWorkingDay, setLastWorkingDay] = useState("")
  const [exitReason, setExitReason] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/offboarding/search-users?search=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(data => {
          setResults(Array.isArray(data) ? data : [])
          setSearching(false)
        })
        .catch(() => {
          setResults([])
          setSearching(false)
        })
    }, 300)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    doSearch(value)
  }

  const selectUser = (user: any) => {
    setSelectedUser(user)
    setSearch("")
    setResults([])
  }

  const submit = async () => {
    if (!selectedUser) return
    if (!lastWorkingDay) {
      setError("Bitte den letzten Arbeitstag angeben.")
      return
    }
    if (!exitReason) {
      setError("Bitte einen Austrittsgrund wählen.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUser.id,
          last_working_day: lastWorkingDay,
          exit_reason: exitReason,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Fehler beim Erstellen des Offboardings.")
        setSubmitting(false)
        return
      }
      router.push(`/offboarding/${data.id}`)
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.")
      setSubmitting(false)
    }
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
            <UserMinus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Neues Offboarding</h1>
            <p className="text-sm text-muted-foreground">Mitarbeiter für Offboarding auswählen</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-200 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-6 animate-fade-in">
          {error}
        </div>
      )}

      {/* User Search */}
      {!selectedUser && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="px-6 py-3 border-b bg-muted/20">
              <h2 className="font-semibold text-sm">Mitarbeiter suchen</h2>
            </div>
            <div className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className={`${inp} pl-9`}
                  placeholder="Name oder E-Mail eingeben..."
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="mt-3 space-y-1 max-h-[400px] overflow-y-auto">
                  {results.map((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => selectUser(user)}
                      className="w-full flex items-center gap-4 rounded-xl border px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                        {user.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {user.department && (
                          <p className="text-xs text-muted-foreground">{user.department}</p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Package className="h-3 w-3" />
                          <span>{user.asset_count ?? 0} Geräte zugewiesen</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {search.trim() && !searching && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Keine Mitarbeiter gefunden.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected User Form */}
      {selectedUser && (
        <div className="space-y-6">
          {/* Selected user info */}
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="px-6 py-3 border-b bg-muted/20">
              <h2 className="font-semibold text-sm">Ausgewählter Mitarbeiter</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-medium shrink-0">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{selectedUser.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  {selectedUser.department && (
                    <p className="text-sm text-muted-foreground">{selectedUser.department}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{selectedUser.asset_count ?? 0} Geräte</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  Ändern
                </Button>
              </div>
            </div>
          </div>

          {/* Offboarding details */}
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="px-6 py-3 border-b bg-muted/20">
              <h2 className="font-semibold text-sm">Offboarding-Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Letzter Arbeitstag *</label>
                  <input
                    type="date"
                    className={inp}
                    value={lastWorkingDay}
                    onChange={e => setLastWorkingDay(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Austrittsgrund *</label>
                  <select
                    className={inp}
                    value={exitReason}
                    onChange={e => setExitReason(e.target.value)}
                  >
                    <option value="">— Auswählen —</option>
                    {EXIT_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Anmerkungen</label>
                <textarea
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optionale Anmerkungen zum Offboarding..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/offboarding" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Abbrechen
            </Link>
            <Button onClick={submit} disabled={submitting} size="lg">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserMinus className="h-4 w-4 mr-1.5" />
                  Offboarding durchführen
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
