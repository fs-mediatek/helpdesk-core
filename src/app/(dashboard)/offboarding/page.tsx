"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { UserMinus, Plus, Loader2, Search, Calendar, Package } from "lucide-react"
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

export default function OffboardingPage() {
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  useEffect(() => {
    fetch("/api/offboarding")
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = data.filter(item => {
    if (statusFilter && item.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        item.employee_name?.toLowerCase().includes(s) ||
        item.department?.toLowerCase().includes(s) ||
        item.employee_email?.toLowerCase().includes(s)
      )
    }
    return true
  })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-red-500 flex items-center justify-center text-white">
            <UserMinus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Offboarding</h1>
            <p className="text-sm text-muted-foreground">Mitarbeiter-Austritte verwalten</p>
          </div>
        </div>
        <Link href="/offboarding/new">
          <Button><Plus className="h-4 w-4 mr-1.5" /> Neues Offboarding</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Name, Abteilung, E-Mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Alle Status</option>
          <option value="pending">Ausstehend</option>
          <option value="in_progress">In Bearbeitung</option>
          <option value="completed">Abgeschlossen</option>
          <option value="cancelled">Abgebrochen</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {data.length === 0 ? "Noch keine Offboardings vorhanden." : "Keine Ergebnisse gefunden."}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mitarbeiter</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Abteilung</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Letzter Arbeitstag</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Geräte-Rückgabe</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Erstellt am</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const status = STATUS_CFG[item.status] || STATUS_CFG.pending
                const devicesReturned = item.devices_returned ?? 0
                const devicesTotal = item.devices_total ?? 0
                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/offboarding/${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{item.employee_name}</p>
                        {item.employee_email && (
                          <p className="text-xs text-muted-foreground">{item.employee_email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.department || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.last_working_day
                        ? format(new Date(item.last_working_day), "dd.MM.yyyy", { locale: de })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant as any}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex-1 max-w-[80px]">
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${devicesTotal > 0 ? (devicesReturned / devicesTotal) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{devicesReturned}/{devicesTotal}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.created_at
                        ? format(new Date(item.created_at), "dd.MM.yyyy", { locale: de })
                        : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
