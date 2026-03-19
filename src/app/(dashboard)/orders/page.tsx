"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShoppingCart, Search, Loader2, ShoppingBag, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"
import { useRouter } from "next/navigation"
import Link from "next/link"

const orderStatusConfig: Record<string, { label: string; variant: any }> = {
  requested: { label: "Angefragt", variant: "secondary" },
  approved: { label: "Genehmigt", variant: "info" },
  ordered: { label: "Bestellt", variant: "purple" },
  shipped: { label: "Versandt", variant: "warning" },
  delivered: { label: "Geliefert", variant: "success" },
  completed: { label: "Abgeschlossen", variant: "success" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setSession(d)).catch(() => {})
  }, [])

  const load = () => {
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    fetch(`/api/orders?${params}`)
      .then(r => r.json())
      .then(data => { setOrders(Array.isArray(data) ? data : data.orders || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  const roles: string[] = session?.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const isPrivileged = roles.some(r => ["admin", "agent", "disposition", "assistenz", "fuehrungskraft"].includes(r))

  const filtered = search
    ? orders.filter(o => o.title?.toLowerCase().includes(search.toLowerCase()))
    : orders

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bestellungen</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isPrivileged ? "Beschaffung & Procurement" : "Meine Bestellungen"}
          </p>
        </div>
        {/* Users go to the catalog/shop, privileged users stay here */}
        <Link href="/catalog"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">
          <ShoppingBag className="h-4 w-4" /> Zum Shop
        </Link>
      </div>

      {/* User info banner */}
      {!isPrivileged && (
        <div className="rounded-xl border bg-primary/5 border-primary/20 px-4 py-3 flex items-center gap-3">
          <ShoppingCart className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Neue Bestellung aufgeben?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Besuche den <Link href="/catalog" className="text-primary hover:underline font-medium">Produktkatalog</Link>, um Produkte in den Warenkorb zu legen.
            </p>
          </div>
          <Link href="/catalog"
            className="ml-auto shrink-0 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 h-8 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-all">
            <ExternalLink className="h-3.5 w-3.5" /> Shop öffnen
          </Link>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Bestellungen suchen..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Alle Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(orderStatusConfig).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">Noch keine Bestellungen vorhanden</p>
              {!isPrivileged && (
                <Link href="/catalog" className="mt-3 text-sm text-primary hover:underline">
                  Jetzt im Shop bestellen →
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Titel</TableHead>
                  {isPrivileged && <TableHead>Angefragt von</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order: any) => {
                  const status = orderStatusConfig[order.status] || { label: order.status, variant: "secondary" }
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{order.order_number}</TableCell>
                      <TableCell className="font-medium">{order.title}</TableCell>
                      {isPrivileged && <TableCell className="text-sm text-muted-foreground">{order.requester_name || "—"}</TableCell>}
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {{ low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch" }[order.priority as string] || order.priority || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at), { locale: de, addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
