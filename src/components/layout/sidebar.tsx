"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard, Ticket, ShoppingCart, BookOpen, Users,
  Settings, MapPin, FileText, Package, Network, UserPlus, UserMinus,
  ChevronLeft, ChevronRight, Headphones, Puzzle, Truck, GitBranch, LayoutGrid,
  Monitor, Smartphone, Cpu, Clock, BarChart2, Wrench, Building2,
  type LucideIcon
} from "lucide-react"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  key: string
  label: string
  icon: LucideIcon
  children?: { href: string; label: string; emoji: string; adminOnly?: boolean }[]
}

const coreNavItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "my-devices", href: "/my-devices", label: "Meine Geräte", icon: Smartphone },
  { key: "tickets", href: "/tickets", label: "Tickets", icon: Ticket },
  { key: "orders", href: "/orders", label: "Bestellungen", icon: ShoppingCart },
  { key: "catalog", href: "/catalog", label: "Produktkatalog", icon: LayoutGrid },
  { key: "workflows", href: "/workflows", label: "Workflows", icon: GitBranch },
  { key: "sla", href: "/sla", label: "SLA", icon: Clock },
  {
    key: "assets", href: "/assets", label: "Assets", icon: Monitor,
    children: [
      { href: "/assets/windows", label: "Windows", emoji: "🪟" },
      { href: "/assets/ios", label: "iOS / iPadOS", emoji: "🍎" },
      { href: "/assets/android", label: "Android", emoji: "🤖" },
    ]
  },
  { key: "inventory", href: "/inventory", label: "Inventar", icon: Package },
  { key: "suppliers", href: "/suppliers", label: "Lieferanten", icon: Truck },
  { key: "kb", href: "/kb", label: "Wissensdatenbank", icon: BookOpen },
  { key: "locations", href: "/locations", label: "Standorte", icon: MapPin },
  { key: "templates", href: "/templates", label: "Vorlagen", icon: FileText },
  {
    key: "onboarding", href: "/p/onboarding", label: "On- & Offboarding", icon: UserPlus,
    children: [
      { href: "/p/onboarding/onboarding", label: "Onboarding", emoji: "👤" },
      { href: "/offboarding", label: "Offboarding", emoji: "👋" },
      { href: "/p/onboarding/settings", label: "Konfiguration", emoji: "⚙️", adminOnly: true },
      { href: "/offboarding/settings", label: "Offb.-Konfiguration", emoji: "⚙️", adminOnly: true },
    ]
  },
  { key: "analytics", href: "/p/ticket-analytics", label: "Auswertungen", icon: BarChart2 },
  {
    key: "mobile-contracts", href: "/p/mobile-contracts", label: "Mobilfunk", icon: Smartphone,
    children: [
      { href: "/p/mobile-contracts/invoices", label: "Rechnungen", emoji: "📄" },
      { href: "/p/mobile-contracts/cost-centers", label: "Kostenstellen", emoji: "🏢" },
      { href: "/p/mobile-contracts/analytics", label: "Auswertung", emoji: "📊" },
    ]
  },
  { key: "maintenance", href: "/p/system-maintenance", label: "Systemwartung", icon: Wrench },
  { key: "plugins", href: "/plugins", label: "Module & Add-ons", icon: Puzzle },
  { key: "users", href: "/users", label: "Benutzer", icon: Users },
  { key: "settings", href: "/settings", label: "Einstellungen", icon: Settings },
]

// Export for use in settings page
export const NAV_ITEMS_META = coreNavItems.map(i => ({ key: i.key, label: i.label }))

interface PluginNavItem {
  label: string
  href: string
  icon: string
  pluginId: string
}

function getIcon(name: string): LucideIcon {
  return (LucideIcons as any)[name] ?? Package
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [navVisibility, setNavVisibility] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/settings/nav').then(r => r.ok ? r.json() : {}),
    ]).then(([me, nav]) => {
      // User roles
      if (me?.role) {
        setUserRoles(me.role.split(",").map((r: string) => r.trim()))
      }

      // Nav visibility
      if (nav && typeof nav === "object") {
        setNavVisibility(nav as Record<string, string>)
      }
      setReady(true)
    }).catch(() => setReady(true))
  }, [])

  // Filter nav items based on visibility settings
  const isAdmin = userRoles.includes("admin")
  const isRoleAllowed = (key: string, defaultHidden?: boolean) => {
    if (isAdmin) return true
    const allowed = navVisibility[key]
    if (!allowed) return !defaultHidden // no config = visible (unless default hidden)
    const allowedRoles = allowed.split(",").map(r => r.trim())
    return userRoles.some(r => allowedRoles.includes(r))
  }

  const visibleNavItems = coreNavItems.filter(item => {
    if (item.key === "settings") return isRoleAllowed(item.key, true)
    return isRoleAllowed(item.key)
  })

  return (
    <aside className={cn(
      "relative flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Headphones className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm truncate">HelpDesk</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {!ready && (
          <div className="space-y-1 px-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-9 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}
        {ready && visibleNavItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          const hasChildren = item.children && item.children.length > 0
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
              {hasChildren && !collapsed && active && (
                <div className="ml-5 pl-3 border-l-2 border-muted-foreground/15 space-y-0.5 mt-0.5 mb-1">
                  {item.children!.filter(child => !child.adminOnly || isAdmin).map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + "/")
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-150",
                          childActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <span className="text-sm leading-none">{child.emoji}</span>
                        <span className="truncate">{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      </nav>

      {/* Collapse button */}
      <div className="border-t p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
