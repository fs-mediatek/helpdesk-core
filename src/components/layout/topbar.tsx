"use client"
import { useTheme } from "next-themes"
import { Sun, Moon, Bell, Search, LogOut, Ticket, MessageSquare, X, Trash2, User, Settings, ChevronDown, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"
import Link from "next/link"

const STORAGE_KEY = "notif_cleared_at"

function NotificationPanel({ onClose, onCleared }: { onClose: () => void; onCleared: () => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const clearedAt = localStorage.getItem(STORAGE_KEY)
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        let list: any[] = d.items || []
        if (clearedAt) list = list.filter(i => new Date(i.created_at) > new Date(clearedAt))
        setItems(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  const navigate = (item: any) => {
    const id = item.ticket_id || item.id
    router.push(`/tickets/${id}`)
    onClose()
  }

  const clearAll = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    setItems([])
    onCleared()
  }

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">Benachrichtigungen</span>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
              title="Alle löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">Laden...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="h-6 w-6 mb-2 opacity-30" />
            <p className="text-sm">Keine neuen Benachrichtigungen</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item, i) => (
              <button
                key={i}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => navigate(item)}
              >
                <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${
                  item.type === "new_ticket" ? "bg-primary/10 text-primary" :
                  item.type === "status_change" ? "bg-emerald-500/10 text-emerald-600" :
                  "bg-amber-500/10 text-amber-600"
                }`}>
                  {item.type === "new_ticket" ? <Ticket className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {item.type === "new_ticket"
                      ? `#${item.ticket_number} ${item.title}`
                      : item.type === "status_change" || item.is_system
                        ? `#${item.ticket_number} — ${item.body}`
                        : `${item.author_name} kommentierte: ${item.title}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(item.created_at), { locale: de, addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="border-t px-4 py-2.5 flex items-center justify-between">
          <button className="text-xs text-primary hover:underline" onClick={() => { router.push("/tickets"); onClose() }}>
            Alle Tickets anzeigen
          </button>
          <button className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={clearAll}>
            Alle löschen
          </button>
        </div>
      )}
    </div>
  )
}

export function Topbar({ user, impersonating, onMobileMenuToggle }: {
  user?: { name: string; role: string }
  impersonating?: { originalName: string }
  onMobileMenuToggle?: () => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const loadCount = () => {
    const clearedAt = localStorage.getItem(STORAGE_KEY)
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        let count = (d.items || []).length
        if (clearedAt) count = (d.items || []).filter((i: any) => new Date(i.created_at) > new Date(clearedAt)).length
        setNotifCount(count)
      })
      .catch(() => {})
  }

  useEffect(() => {
    setMounted(true)
    loadCount()
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  async function handleUnimpersonate() {
    await fetch("/api/auth/unimpersonate", { method: "POST" })
    router.refresh()
  }

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U"

  return (
    <header className={`flex h-14 items-center gap-2 md:gap-4 border-b px-3 md:px-4 lg:px-6 ${impersonating ? "bg-amber-500/10 border-amber-500/30" : "bg-card"}`}>
      {/* Mobile hamburger */}
      {onMobileMenuToggle && (
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
      )}
      <div className="flex flex-1 items-center gap-2">
        <div className="relative w-full max-w-sm hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suchen..." className="pl-8 bg-background" />
        </div>
      </div>

      {impersonating && (
        <button
          onClick={handleUnimpersonate}
          className="flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/30 transition-colors shrink-0"
          title={`Zurück zu ${impersonating.originalName}`}
        >
          <UserCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Handeln als <strong>{user?.name}</strong> — </span>
          <span>Zurück zu {impersonating.originalName}</span>
        </button>
      )}

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {mounted ? resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" /> : <span className="h-4 w-4" />}
        </Button>

        {/* Notification Bell */}
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setShowNotifications(v => !v)} className="relative">
            <Bell className="h-4 w-4" />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
          {showNotifications && (
            <NotificationPanel
              onClose={() => setShowNotifications(false)}
              onCleared={() => { setNotifCount(0) }}
            />
          )}
        </div>

        <div className="relative ml-2 pl-2 border-l" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {user && (
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role?.split(",")[0]}</p>
              </div>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card shadow-xl z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b bg-muted/20">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
              </div>
              <div className="py-1">
                <Link href="/profile" onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Mein Profil
                </Link>
                <Link href="/profile" onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Benachrichtigungen
                </Link>
                <Link href="/my-devices" onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Meine Geräte
                </Link>
              </div>
              <div className="border-t py-1">
                <button onClick={() => { setShowUserMenu(false); handleLogout() }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 transition-colors w-full">
                  <LogOut className="h-4 w-4" />
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
