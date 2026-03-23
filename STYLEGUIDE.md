# HelpDesk-Core — Technik- & Style-Guide

> Referenzdokument für die Umsetzung weiterer Tools und Projekte auf Basis der HelpDesk-Core-Architektur.

---

## 1. Tech-Stack & Versionen

| Bereich | Technologie | Version |
|---------|-------------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.1.7 |
| Runtime | Node.js | 22+ |
| UI-Library | React | 19.2.3 |
| Sprache | TypeScript (strict) | 5.x |
| Styling | Tailwind CSS v4 (CSS-basiert) | 4.x |
| UI-Primitives | Radix UI + shadcn/ui | aktuell |
| Varianten | class-variance-authority (CVA) | 0.7.1 |
| Datenbank | MySQL 8.x / MariaDB | mysql2 3.20 |
| Auth | JWT via `jose` | 6.2.1 |
| Passwort-Hashing | bcryptjs | 3.0.3 |
| Rich-Text-Editor | TipTap | 3.20.4 |
| Icons | lucide-react | 0.577+ |
| Datum | date-fns | 4.1.0 |
| Charts | Recharts | 3.8.0 |
| E-Mail | Nodemailer | 8.0.2 |
| Theming | next-themes | 0.4.6 |

---

## 2. Projektstruktur

```
project-root/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Login/Setup (Route Group, kein Layout)
│   │   │   ├── login/page.tsx
│   │   │   └── setup/page.tsx
│   │   ├── (dashboard)/              # Geschützter Bereich (mit Sidebar-Layout)
│   │   │   ├── layout.tsx            # Session-Check → redirect("/login")
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── tickets/page.tsx
│   │   │   ├── tickets/[id]/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── p/[pluginId]/[[...slug]]/page.tsx   # Plugin-UI-Rendering
│   │   ├── api/                      # API-Routen
│   │   │   ├── auth/login/route.ts
│   │   │   ├── auth/logout/route.ts
│   │   │   ├── auth/me/route.ts
│   │   │   ├── tickets/route.ts      # GET (Liste) + POST (Erstellen)
│   │   │   ├── tickets/[id]/route.ts # GET + PUT + DELETE
│   │   │   ├── users/route.ts
│   │   │   ├── users/[id]/route.ts
│   │   │   ├── departments/route.ts
│   │   │   ├── plugins/[pluginId]/[[...path]]/route.ts  # Plugin-API-Router
│   │   │   └── setup/check/route.ts  # DB-Migrations bei Erststart
│   │   ├── layout.tsx                # Root-Layout (ThemeProvider)
│   │   ├── globals.css               # Tailwind v4 + CSS-Variablen
│   │   └── page.tsx                  # Redirect → /dashboard
│   ├── components/
│   │   ├── ui/                       # shadcn/Radix-Primitives
│   │   │   ├── button.tsx            # CVA: default|destructive|outline|secondary|ghost|link
│   │   │   ├── badge.tsx             # CVA: default|secondary|destructive|outline|success|warning|info|purple
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── separator.tsx
│   │   │   └── date-picker.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # Navigation + Kollaps + Plugin-Einträge
│   │   │   └── topbar.tsx            # Theme-Toggle, Benachrichtigungen, User-Menü
│   │   ├── tickets/
│   │   │   └── ticket-detail.tsx     # Ticket-Detailansicht mit Kommentaren
│   │   ├── editor/
│   │   │   ├── rich-editor.tsx       # TipTap-Editor (Bearbeitung)
│   │   │   └── rich-content.tsx      # TipTap-Content (nur Anzeige)
│   │   ├── chat/
│   │   │   └── chatbot.tsx           # AI-Chatbot (Floating Widget)
│   │   ├── plugins/
│   │   │   └── Component.tsx         # Plugin-Component-Wrapper
│   │   └── theme-provider.tsx        # next-themes Wrapper
│   ├── lib/
│   │   ├── db.ts                     # MySQL-Pool, query(), queryOne()
│   │   ├── auth.ts                   # JWT: signToken, verifyToken, getSession
│   │   ├── utils.ts                  # cn() — clsx + tailwind-merge
│   │   ├── effective-roles.ts        # Rollen-Vererbung (User + Abteilung)
│   │   ├── numbering.ts             # Ticket-/Bestellnummern-Generator
│   │   ├── sla.ts                    # SLA-Regel-Matching
│   │   ├── roles.ts                  # Rollen laden & anzeigen
│   │   ├── zammad.ts                # Zammad-API-Client
│   │   ├── microsoft.ts            # MS 365 OAuth + Graph API
│   │   ├── mail-poller.ts          # E-Mail → Ticket (Background)
│   │   ├── zammad-poller.ts        # Zammad-Sync (Background)
│   │   ├── mailer.ts               # SMTP-Transport
│   │   └── plugins/
│   │       ├── types.ts             # HelpdeskPlugin, PluginManifest, PluginAPIContext
│   │       ├── init.ts              # Migrations + onLoad()
│   │       ├── router.ts            # matchPluginRoute() — Regex-basiert
│   │       └── registry-manager.ts  # registry.ts-Datei manipulieren
│   └── plugins/
│       └── registry.ts              # Auto-generiert — NICHT MANUELL BEARBEITEN
├── packages/                         # Plugin-Pakete
│   ├── plugin-assets/
│   ├── plugin-ticket-analytics/
│   ├── plugin-system-maintenance/
│   ├── plugin-mobile-contracts/
│   └── plugin-onboarding/
├── scripts/
│   └── plugin.js                    # CLI: Plugin hinzufügen/entfernen
├── public/                          # Statische Assets (favicon etc.)
├── uploads/                         # User-Uploads (in .gitignore)
├── instrumentation.ts               # Server-Init: Plugins + Pollers starten
├── update.sh                        # Update-Skript (git pull + build + restart)
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts               # Leer — Tailwind v4 nutzt CSS
└── package.json
```

---

## 3. Konfiguration

### 3.1 TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Path-Aliases:**
- `@/lib/*` → Utilities/Services
- `@/components/*` → React-Komponenten
- `@/plugins/registry` → Plugin-Registry

### 3.2 Next.js (`next.config.ts`)

```typescript
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
}
```

### 3.3 Umgebungsvariablen (`.env.local`)

```bash
DB_HOST=localhost          # oder IP
DB_PORT=3306               # Standard MySQL
DB_NAME=helpdesk
DB_USER=helpdesk
DB_PASSWORD=<geheim>
DB_SOCKET=                 # Optional: Unix-Socket (Linux)

APP_SECRET_KEY=<zufällig>  # JWT-Signing
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=HelpDesk
```

---

## 4. Farbschema & Theming

### 4.1 CSS-Variablen (HSL-basiert)

Tailwind v4 nutzt `globals.css` statt `tailwind.config.ts`:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", sans-serif;
  --color-primary: oklch(from hsl(var(--primary)) l c h);
  /* ... weitere Mappings */
}

:root {
  --radius: 0.625rem;
  --primary: 243 75% 59%;           /* Blau-Violett */
  --background: 0 0% 98%;           /* Off-White */
  --foreground: 224 71% 4%;         /* Dunkles Blau-Grau */
  --card: 0 0% 100%;
  --muted: 220 14% 96%;
  --destructive: 0 84% 60%;         /* Rot */
}

.dark {
  --primary: 243 75% 65%;           /* Helleres Blau-Violett */
  --background: 224 71% 4%;         /* Sehr dunkles Blau */
  --foreground: 213 31% 91%;
  --card: 224 50% 8%;
  --muted: 215 20% 13%;
  --destructive: 0 63% 31%;
}
```

### 4.2 Designprinzipien

- **Primärfarbe:** Blau-Violett (`hsl(243, 75%, 59%)`)
- **Border-Radius:** `0.625rem` (rounded-lg)
- **Schrift:** Inter (Google Fonts)
- **Dark Mode:** `next-themes` mit `attribute="class"`, `enableSystem: true`
- **Animationen:** `animate-fade-in` (opacity 0→1, translateY 10px→0)

---

## 5. Datenbank-Patterns

### 5.1 Verbindungspool

```typescript
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'helpdesk',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
})

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
```

### 5.2 Wichtige Regeln

| Regel | Grund |
|-------|-------|
| `pool.execute()` mit Prepared Statements nutzen | SQL-Injection verhindern |
| `LIMIT`/`OFFSET` als String interpolieren, NICHT als `?`-Parameter | MySQL 8.4 Bug mit `pool.execute` |
| Snake_case für Spaltennamen | Konsistenz (z.B. `created_at`, `assigned_to_user_id`) |
| `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY` für IDs | Standard |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` für Zeitstempel | Automatische Zeiterfassung |
| `ENUM(...)` für feste Wertelisten | Datenintegrität |
| `VARCHAR` mit sinnvoller Längenbegrenzung | z.B. 255 für Titel, 50 für Tags |
| `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` | Emojis und Umlaute |

### 5.3 LIMIT/OFFSET-Workaround (MySQL 8.4)

```typescript
// FALSCH — wirft "Incorrect arguments to mysqld_stmt_execute":
const [rows] = await pool.execute('SELECT * FROM t LIMIT ? OFFSET ?', [limit, offset])

// RICHTIG — parseInt-Werte direkt interpolieren:
const limit = parseInt(req.query.limit || '25')
const offset = (parseInt(req.query.page || '1') - 1) * limit
const [rows] = await pool.execute(
  `SELECT * FROM t LIMIT ${limit} OFFSET ${offset}`,
  params  // nur WHERE-Parameter als ?
)
```

---

## 6. Authentifizierung & Autorisierung

### 6.1 JWT-Flow

```
Login → bcrypt.compare() → signToken({userId, email, name, role})
     → Cookie "token" setzen (httpOnly, 24h, sameSite: "lax")

Jede Anfrage → Middleware (proxy.ts) → getSessionFromRequest(req)
            → Nicht eingeloggt? → 401 / Redirect zu /login
            → Eingeloggt? → NextResponse.next()

API-Route → getSession() → session.userId, session.role
```

### 6.2 Rollen-System

```typescript
// Rollen als Komma-separierter String in users.role
// z.B. "admin,agent" oder "user,assistenz"

const isAdmin = session.role.includes("admin")
const isAgent = session.role.includes("agent")
const isPrivileged = ["admin","agent","disposition","assistenz","fuehrungskraft"]
  .some(r => session.role.includes(r))
```

**Eingebaute Rollen:**

| Rolle | Berechtigung |
|-------|-------------|
| `admin` | Vollzugriff auf alles |
| `agent` | Alle Tickets sehen/bearbeiten |
| `disposition` | Ticket-Disposition |
| `assistenz` | Tickets im Namen von Abteilungskollegen erstellen |
| `fuehrungskraft` | Nur eigene Abteilung + Unterabteilungen sehen |
| `user` | Nur eigene Tickets/Bestellungen |

### 6.3 Effektive Rollen (Vererbung)

```
Effektive Rollen = persönliche Rollen (users.role)
                 + Abteilungs-Default-Rollen (departments.default_roles)
                 + Eltern-Abteilungs-Rollen (rekursiv über parent_id)
```

### 6.4 Middleware (`src/proxy.ts`)

```typescript
const publicPaths = ["/login", "/setup", "/api/auth/login", "/api/auth/logout", "/api/setup"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (publicPaths.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url))

  const session = await getSessionFromRequest(req)
  if (!session && !pathname.startsWith("/api/"))
    return NextResponse.redirect(new URL("/login", req.url))
  if (!session && pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.next()
}
```

---

## 7. API-Patterns

### 7.1 Standard-Endpunkt-Struktur

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

// Parameter-Typ für dynamische Routen
type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest) {
  // 1. Session prüfen
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 2. Query-Parameter lesen
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")
  const offset = (page - 1) * limit

  // 3. Berechtigungen prüfen
  const isAdmin = session.role.includes("admin") || session.role.includes("agent")

  // 4. Dynamisches WHERE aufbauen
  let where = "WHERE 1=1"
  const params: any[] = []
  if (!isAdmin) { where += " AND t.requester_id = ?"; params.push(session.userId) }

  // 5. Query + Pagination
  const items = await query(
    `SELECT t.*, u.name as requester_name FROM tickets t
     LEFT JOIN users u ON t.requester_id = u.id
     ${where} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  )
  const [countResult] = await query(`SELECT COUNT(*) as total FROM tickets t ${where}`, params)

  return NextResponse.json({ tickets: items, total: (countResult as any).total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  if (!body.title) return NextResponse.json({ error: "Titel erforderlich" }, { status: 400 })

  const [result] = await query("INSERT INTO tickets (...) VALUES (...)", [...]) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const isAdmin = session.role.includes("admin")
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const allowed = ["status", "priority", "title"]
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!updates.length) return NextResponse.json({ error: "Keine Felder" }, { status: 400 })

  const sets = updates.map(([k]) => `${k} = ?`).join(", ")
  const vals = updates.map(([, v]) => v)
  await query(`UPDATE tickets SET ${sets} WHERE id = ?`, [...vals, id])

  return NextResponse.json({ success: true })
}
```

### 7.2 Fehlerbehandlung

```typescript
// Immer JSON zurückgeben
return NextResponse.json({ error: "Nachricht" }, { status: 400 })

// Standard-HTTP-Codes:
// 200 — Erfolg (GET, PUT)
// 201 — Erstellt (POST)
// 400 — Validierungsfehler
// 401 — Nicht eingeloggt
// 403 — Keine Berechtigung
// 404 — Nicht gefunden
// 500 — Serverfehler
```

### 7.3 Bekanntes Next.js-Routing-Problem

**Statische vs. dynamische Routen:** Next.js 16 matcht `/api/users/colleagues` manchmal auf `/api/users/[id]` statt auf `/api/users/colleagues`. **Lösung:** Statische Unter-Routen auf eine eigene Top-Level-Route verschieben (z.B. `/api/colleagues`).

---

## 8. UI-Komponenten & Patterns

### 8.1 Button-Varianten (CVA)

```typescript
buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

### 8.2 Badge-Varianten

```typescript
// Semantische Farbzuordnung:
// success → Grün (emerald) — für "Gelöst", "Verfügbar"
// warning → Gelb (amber) — für "Ausstehend", "Hoch"
// info → Blau — für "Offen"
// purple → Violett — für "In Arbeit"
// destructive → Rot — für "Kritisch"
// secondary → Grau — für "Niedrig", "Geschlossen"
```

### 8.3 Seitenstruktur

```tsx
// Seiten-Layout
<div className="space-y-5 animate-fade-in">
  {/* Header mit Titel + Aktions-Button */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">Seitentitel</h1>
      <p className="text-muted-foreground text-sm mt-0.5">Beschreibung</p>
    </div>
    <Button onClick={() => setShowNew(true)}>
      <Plus className="h-4 w-4" /> Neu erstellen
    </Button>
  </div>

  {/* Filter-Leiste */}
  <div className="flex gap-2 flex-wrap">
    <Input placeholder="Suchen..." className="pl-8" />
    <Select><SelectTrigger className="w-40">...</SelectTrigger></Select>
  </div>

  {/* Daten-Tabelle in Card */}
  <Card>
    <CardContent className="p-0">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Keine Einträge gefunden</p>
        </div>
      ) : (
        <Table>...</Table>
      )}
    </CardContent>
  </Card>
</div>
```

### 8.4 Dialog/Modal-Pattern

```tsx
<Dialog open={showDialog} onOpenChange={setShowDialog}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Überschrift</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Feldname</Label>
        <Input value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Select-Feld</Label>
          <Select value={form.option} onValueChange={v => setForm(f => ({ ...f, option: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
              <SelectItem value="b">Option B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Abbrechen</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Speichern...</> : "Speichern"}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### 8.5 Tabellen-Pattern

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Spalte</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Datum</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id} className="cursor-pointer">
        <TableCell>
          <Link href={`/detail/${item.id}`} className="block hover:text-primary transition-colors">
            <span className="text-xs font-mono text-muted-foreground">{item.number}</span>
            <span className="font-medium">{item.title}</span>
          </Link>
        </TableCell>
        <TableCell><Badge variant={statusVariant}>{statusLabel}</Badge></TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(item.created_at), { locale: de, addSuffix: true })}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## 9. Dashboard-Layout

### 9.1 Grundaufbau

```tsx
// src/app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const session = await getSession()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={{ name: session.name, role: session.role }} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Chatbot />
    </div>
  )
}
```

### 9.2 Sidebar-Navigation

```typescript
const navItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "tickets", href: "/tickets", label: "Tickets", icon: Ticket },
  { key: "assets", href: "/assets", label: "Assets", icon: Monitor,
    children: [
      { href: "/assets/windows", label: "Windows", emoji: "🪟" },
      { href: "/assets/ios", label: "iOS / iPadOS", emoji: "🍎" },
    ]
  },
  { key: "settings", href: "/settings", label: "Einstellungen", icon: Settings },
]
```

**Features:**
- Kollaps-Zustand (breite/schmale Sidebar)
- Rollenbasierte Sichtbarkeit via `/api/settings/nav`
- Verschachtelte Kind-Einträge
- Aktiver Zustand via `usePathname()`
- Plugin-Navigation automatisch aus `manifest.navItems`

---

## 10. Plugin-System

### 10.1 Plugin-Interface

```typescript
export interface HelpdeskPlugin {
  manifest: {
    id: string              // Eindeutige ID (z.B. "assets")
    name: string            // Anzeigename (Deutsch)
    version: string
    description: string
    icon: string            // Lucide-Icon-Name
    navItems: Array<{
      label: string         // Navigations-Label
      href: string          // Relativer Pfad → /p/<pluginId>/<href>
      icon: string
    }>
  }

  api?: Record<string, PluginAPIHandler>   // "METHOD /path/:param"
  Component?: React.ComponentType<{ slug: string[] }>
  migrations?: string[]                     // SQL-Statements
  onLoad?: () => void                       // Server-Start-Hook
}
```

### 10.2 API-Handler-Kontext

```typescript
type PluginAPIContext = {
  params: Record<string, string>           // URL-Parameter (:id etc.)
  searchParams: URLSearchParams
  session: { userId: number; email: string; name: string; role: string }
  db: {
    query: <T>(sql: string, params?: any[]) => Promise<T[]>
    queryOne: <T>(sql: string, params?: any[]) => Promise<T | null>
    insert: (sql: string, params?: any[]) => Promise<number>
  }
}
```

### 10.3 Plugin-Routen

```
API:  /api/plugins/<pluginId>/<path>     → plugin.api["METHOD /path"]
UI:   /p/<pluginId>/<slug>               → plugin.Component({ slug })
Nav:  /p/<pluginId>/<navItem.href>       → Sidebar-Eintrag
```

### 10.4 Plugin erstellen (Minimal)

```typescript
// packages/plugin-example/index.ts
import type { HelpdeskPlugin } from '../../src/lib/plugins/types'
import { ExamplePage } from './components/ExamplePage'
import { NextResponse } from 'next/server'

const plugin: HelpdeskPlugin = {
  manifest: {
    id: 'example',
    name: 'Beispiel-Plugin',
    version: '1.0.0',
    description: 'Beschreibung',
    icon: 'Puzzle',
    navItems: [{ label: 'Beispiel', href: '/', icon: 'Home' }],
  },

  migrations: [
    `CREATE TABLE IF NOT EXISTS example_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],

  api: {
    'GET /': async (_req, ctx) => {
      const items = await ctx.db.query('SELECT * FROM example_data ORDER BY created_at DESC')
      return NextResponse.json(items)
    },
    'POST /': async (req, ctx) => {
      const { name } = await req.json()
      const id = await ctx.db.insert('INSERT INTO example_data (name) VALUES (?)', [name])
      return NextResponse.json({ id }, { status: 201 })
    },
    'GET /:id': async (_req, ctx) => {
      const item = await ctx.db.queryOne('SELECT * FROM example_data WHERE id = ?', [ctx.params.id])
      if (!item) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
      return NextResponse.json(item)
    },
    'PUT /:id': async (req, ctx) => {
      const { name } = await req.json()
      await ctx.db.query('UPDATE example_data SET name = ? WHERE id = ?', [name, ctx.params.id])
      return NextResponse.json({ success: true })
    },
    'DELETE /:id': async (_req, ctx) => {
      await ctx.db.query('DELETE FROM example_data WHERE id = ?', [ctx.params.id])
      return NextResponse.json({ success: true })
    },
  },

  Component: ExamplePage,
}

export default plugin
```

### 10.5 Plugin-Registrierung

```bash
# Neues Plugin hinzufügen
node scripts/plugin.js add @helpdesk/plugin-example

# Ergebnis: src/plugins/registry.ts wird automatisch aktualisiert
```

### 10.6 Plugin-Initialisierung

```typescript
// instrumentation.ts → initPlugins()
// 1. Migrations ausführen (CREATE TABLE IF NOT EXISTS — idempotent)
// 2. onLoad() für jedes Plugin aufrufen
// Fehler werden geloggt, aber schlucken nicht den Serverstart
```

---

## 11. Namenskonventionen

### 11.1 Sprache

| Bereich | Sprache | Beispiel |
|---------|---------|---------|
| UI-Labels & Texte | **Deutsch** | "Neues Ticket erstellen", "Abbrechen" |
| Fehlermeldungen | **Deutsch** | "Ungültige Zugangsdaten" |
| DB-Spaltennamen | **Englisch**, snake_case | `created_at`, `requester_id` |
| Variablen/Funktionen | **Englisch**, camelCase | `fetchTickets`, `isAdmin` |
| Ausnahme: Deutsche Fachbegriffe | Bleiben Deutsch | `isAssistenz`, `fuehrungskraft` |
| Kommentare | Gemischt | Englisch bevorzugt |
| Commit-Messages | Deutsch oder Englisch | `fix: Katalog-Route nutzt korrekte Tabellennamen` |

### 11.2 Dateien

| Typ | Konvention | Beispiel |
|-----|-----------|---------|
| Seiten | Ordner + `page.tsx` | `tickets/[id]/page.tsx` |
| API-Routen | Ordner + `route.ts` | `api/tickets/route.ts` |
| Komponenten | kebab-case oder PascalCase | `ticket-detail.tsx`, `Sidebar` |
| Utilities | kebab-case | `effective-roles.ts`, `mail-poller.ts` |
| Plugins | `plugin-<name>` | `plugin-mobile-contracts` |

### 11.3 Status-Werte (immer Englisch)

```typescript
// Tickets: 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed'
// Assets:  'available' | 'assigned' | 'maintenance' | 'retired'
// Prozesse: 'pending' | 'in_progress' | 'completed'
```

---

## 12. Hintergrund-Jobs

### 12.1 Architektur

```typescript
// instrumentation.ts — Next.js Server-Initialisierung
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initPlugins } = await import('./src/lib/plugins/init')
    initPlugins()

    const { startMailPoller } = await import('./src/lib/mail-poller')
    startMailPoller()   // setInterval(pollOnce, 60_000)

    const { startZammadPoller } = await import('./src/lib/zammad-poller')
    startZammadPoller() // setInterval(pollOnce, 60_000)
  }
}
```

### 12.2 Poller-Pattern

```typescript
let running = false
let timer: NodeJS.Timeout | null = null

async function pollOnce() {
  if (running) return   // Keine parallelen Runs
  running = true
  try {
    const settings = await getSettingsFromDB()
    if (settings.feature_enabled !== "true") return

    // ... Logik ...
  } catch (err) {
    console.error("[Poller] Fehler:", err)
  } finally {
    running = false
  }
}

export function startPoller() {
  pollOnce()
  timer = setInterval(pollOnce, 60_000)
  console.log("[Poller] Gestartet (Intervall: 60s)")
}
```

---

## 13. Rich-Text-Editor

### 13.1 TipTap-Konfiguration

```typescript
const editor = useEditor({
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Link.configure({ openOnClick: false }),
    Image.configure({ HTMLAttributes: { class: "rounded-lg max-w-full my-4" } }),
    Placeholder.configure({ placeholder: "Schreibe hier..." }),
    Underline,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
  ],
  editorProps: {
    attributes: {
      class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-5 py-4",
    },
  },
  onUpdate: ({ editor }) => onChange(editor.getHTML()),
})
```

### 13.2 Nur-Lesen-Anzeige

```tsx
<div
  className="prose prose-sm dark:prose-invert max-w-none
    prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl
    prose-a:text-primary prose-a:underline prose-a:underline-offset-2
    prose-img:rounded-lg prose-img:max-w-full
    prose-blockquote:border-l-primary/50 prose-blockquote:bg-muted/30"
  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
/>
```

---

## 14. Ticket-/Bestellnummern

```typescript
// Konfigurierbar über Einstellungen:
// Pattern:  {PREFIX}-{YEAR}-{NUM:4}
// Prefix:   IT (Tickets), ORD (Bestellungen)
// Ergebnis: IT-2026-0042

async function generateTicketNumber(year: number, seq: number): Promise<string> {
  const pattern = await getSetting("ticket_number_pattern") || "{PREFIX}-{YEAR}-{NUM:4}"
  const prefix = await getSetting("ticket_number_prefix") || "IT"
  return applyPattern(pattern, prefix, year, seq)
}

// Counter-Tabelle: ticket_counters (year, last_number)
// ON DUPLICATE KEY UPDATE last_number = last_number + 1
```

---

## 15. SLA-Regelwerk

```typescript
// Score-basiertes Matching:
// Kategorie-Match: +4 Punkte
// Abteilung-Match: +2 Punkte
// Priorität-Match: +1 Punkt
// Catch-All:        0 Punkte (niedrigste Priorität)

// Beste Regel wird angewendet → sla_due_at = created_at + resolution_hours
```

---

## 16. Systemd-Service (Deployment)

```ini
# /etc/systemd/system/helpdesk.service
[Unit]
Description=HelpDesk Core Application
After=network.target mysql.service

[Service]
Type=simple
User=helpdesk
WorkingDirectory=/home/helpdesk/helpdesk-app
ExecStart=/usr/bin/npx next start -p 3000 -H 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Update-Prozess:**
```bash
# update.sh
sudo systemctl stop helpdesk
git fetch origin && git reset --hard origin/main
npm ci --silent
npx next build
sudo systemctl start helpdesk
```

---

## 17. Login-Seite — Animation & Aufbau

### 17.1 Schichtenaufbau

Die Login-Seite besteht aus 6 übereinanderliegenden Layern:

```
Layer 1: Animierter Gradient (login-gradient)
Layer 2: Semi-transparenter Background-Overlay
Layer 3: Grid-Overlay (login-grid)
Layer 4: Partikel-Canvas (Netzwerk-Mesh)
Layer 5: Glow-Orbs (3 schwebende unscharfe Lichtkreise)
Layer 6: Floating Icons (themenspezifisch)
Layer 7: Login-Card (z-10, im Vordergrund)
```

### 17.2 Partikel-Canvas

Client-seitiger `<canvas>` mit `requestAnimationFrame`-Loop:

```typescript
function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    // ~55 Partikel, verbunden durch Linien wenn Abstand < 140px
    // Farbe: Violett (primary), Linien-Opacity proportional zur Distanz
    // Partikel bouncen an den Canvas-Rändern
  }, [])
  return <canvas ref={ref} className="absolute inset-0 pointer-events-none" />
}
```

**Themenanpassung pro Projekt:**
- HelpDesk: `rgba(139,92,246,...)` (Violett) — IT-Icons (Monitor, Headset, Shield, WiFi, Server, Ticket, CPU)
- Facility Mgmt: `rgba(94,234,212,...)` (Teal) — Gebäude-Skyline statt Icons

### 17.3 CSS-Animationen

```css
/* Gradient-Hintergrund — langsame Farbverschiebung */
.login-gradient {
  background-size: 400% 400%;
  animation: loginGradientShift 20s ease infinite;
}

/* Raster-Overlay — dezentes Gitter */
.login-grid {
  background-image:
    linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* Schwebende Orbs */
.login-orb { animation: loginOrbFloat 12s ease-in-out infinite; }

/* Card-Eingang — blur→scharf + translateY + scale */
.login-entrance {
  animation: loginEntranceAnim 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
}

/* Logo-Icon — Pop mit Rotation */
.login-logo {
  animation: loginLogoPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
}

/* Titel — Fade-In mit Verzögerung */
.login-title-fade {
  animation: loginTitleFade 0.5s ease-out 0.6s both;
}

/* Card-Hover — Gradient-Border + Lift */
.login-card-glow:hover::before { opacity: 1; } /* gradient border */
.login-card-glow:hover { transform: translateY(-2px); }

/* Fehler — Schüttel-Animation */
.login-shake { animation: loginShake 0.5s ease-in-out; }
```

### 17.4 Themenspezifische Varianten

| Projekt | Primärfarbe | Floating-Elemente | Besonderheiten |
|---------|-------------|-------------------|----------------|
| HelpDesk | Violett/Indigo | IT-Support-SVG-Icons (7 Stück) | Netzwerk-Mesh-Canvas |
| Facility Mgmt | Teal/Emerald | Gebäude-Skyline (11 Gebäude) | Fenster-Twinkle, Antennen-Blink, Blueprint-Grid |

**Facility-Skyline-Extras:**
```css
/* Gebäude fahren von unten hoch mit Bounce */
.skyline-building {
  transform-origin: bottom center;
  animation: buildingRise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Fenster flackern zufällig auf (warmes Gelb) */
.window-light { animation: windowGlow 4s ease-in-out infinite; }

/* Rotes Antennen-Blinken */
.animate-blink { animation: blink 3s ease infinite; }
```

### 17.5 Login-Card Features

```tsx
// Gradient-Icon mit Hover-Overlay
<div className="login-logo ... bg-gradient-to-br from-primary to-indigo-600 shadow-xl shadow-primary/30">
  <Headphones className="h-7 w-7 text-white" />
  <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
</div>

// Input-Felder mit Icons
<div className="relative">
  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
  <Input className="pl-9" ... />
</div>

// Card mit Glasmorphism
<Card className="login-card-glow backdrop-blur-md bg-card/90 dark:bg-card/80">

// Microsoft-Login (optional, per Feature-Flag)
{msLoginEnabled && (<Button variant="outline">Microsoft</Button>)}
```

---

## 18. Stellvertretungs-Feature (Assistenz)

### 18.1 Konzept

Nutzer mit der Rolle `assistenz` können:
1. Tickets **im Namen von Abteilungskollegen** erstellen
2. Diese Tickets als **Stellvertreter einsehen** und ggf. **eskalieren**
3. Sowohl der Ersteller als auch die Assistenz können die **Stellvertretung entfernen** (Datenschutz)
4. Stellvertretungs-Tickets sind **farblich hervorgehoben** (violetter Rand + Badge)

### 18.2 Datenmodell

```sql
-- Tickets-Tabelle (erweitert)
ALTER TABLE tickets ADD COLUMN delegate_user_id INT UNSIGNED DEFAULT NULL;
-- delegate_user_id = Die Assistenz, die das Ticket stellvertretend erstellt hat
-- requester_id = Der eigentliche Ticket-Ersteller (im Namen von)
```

### 18.3 API-Endpunkte

```
GET  /api/auth/me           → {userId, name, email, role} (für Rollenprüfung)
GET  /api/colleagues         → [{id, name, email}] (gleiche Abteilung, ohne sich selbst)
POST /api/tickets            → {on_behalf_of: "userId"} (optional, setzt requester_id + delegate_user_id)
DELETE /api/tickets/:id/delegate → Entfernt delegate_user_id (durch Ersteller oder Assistenz)
```

**Wichtig:** `/api/colleagues` liegt auf Top-Level, NICHT unter `/api/users/colleagues` (Next.js `[id]`-Routing-Konflikt).

### 18.4 Frontend-Logik

```typescript
// Ticket-Erstellung: "Im Namen von"-Dropdown
useEffect(() => {
  fetch("/api/auth/me").then(r => r.json()).then(me => {
    if (me?.role?.includes("assistenz")) {
      setIsAssistenz(true)
      fetch("/api/colleagues").then(r => r.json()).then(setColleagues)
    }
  })
}, [])

// Dropdown erscheint immer für assistenz-Rolle
// Falls keine Kollegen: Hinweistext statt leerem Dropdown
{isAssistenz && (
  colleagues.length > 0
    ? <Select>...Kollegenliste...</Select>
    : <p>Keine Kollegen in deiner Abteilung gefunden.</p>
)}
```

### 18.5 Ticket-Liste — Hervorhebung

```tsx
<TableRow className={ticket.is_delegate
  ? "bg-violet-500/5 hover:bg-violet-500/10 border-l-2 border-l-violet-500"
  : ""
}>
  {ticket.is_delegate && (
    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-600 dark:text-violet-400">
      <Users className="h-2.5 w-2.5" /> Stellvertretung
    </span>
  )}
</TableRow>
```

---

## 19. Impersonation (Handeln als)

### 19.1 Konzept

Admins können sich als andere Nutzer einloggen, ohne deren Passwort zu kennen. Der Original-Token wird in einem separaten Cookie gespeichert, damit der Admin mit einem Klick zurückkehren kann.

### 19.2 Cookies

```
token           → Aktiver JWT (des impersonierten Nutzers)
original_token  → JWT des Admins (nur während Impersonation)
```

### 19.3 API-Endpunkte

```
POST /api/users/:id/impersonate → Setzt token auf Ziel-User, original_token auf Admin
POST /api/auth/unimpersonate    → Stellt original_token als token wieder her
```

### 19.4 UI-Indikator

```tsx
// Dashboard-Layout prüft original_token Cookie
const originalSession = originalToken ? await verifyToken(originalToken) : null

// Topbar zeigt Amber-Banner bei aktiver Impersonation
{impersonating && (
  <div className="bg-amber-500/10 text-amber-600 px-3 py-1 text-sm">
    Du handelst als {user.name} · <button onClick={unimpersonate}>Beenden</button>
  </div>
)}
```

---

## 20. Bekannte Fallstricke

| Problem | Lösung |
|---------|--------|
| MySQL 8.4 + `LIMIT ? OFFSET ?` in Prepared Statements | `LIMIT ${limit} OFFSET ${offset}` direkt interpolieren (nur parseInt-Werte!) |
| Next.js 16: Statische Route wird von `[id]`-Route überschattet | Route auf eigene Top-Level-Ebene verschieben |
| CSV-Import aus Windows/Intune: Tab-getrennt + UTF-16 LE | BOM erkennen (`FF FE`), Delimiter auto-detecten |
| MariaDB vs MySQL auf gleichem Host | Verschiedene Ports (z.B. 3306/3307) |
| `pool.execute` vs `pool.query` | `execute` = Prepared Statements (sicher), `query` = Raw (kein Prepared) |
| Collation-Mismatch bei String-Vergleichen | JS-seitigen Vergleich nutzen statt SQL-JOIN |

---

## 21. Zusammenfassung der Designprinzipien

1. **Deutsch-First UI** — Alle sichtbaren Texte in Deutsch, technische Bezeichner in Englisch
2. **Dark Mode Standard** — Immer Light + Dark via CSS-Variablen unterstützen
3. **CVA + Radix** — UI-Varianten über `class-variance-authority`, Primitives über `@radix-ui`
4. **Prepared Statements** — Alle DB-Queries über `pool.execute` mit `?`-Parametern (außer LIMIT/OFFSET)
5. **JWT in HttpOnly Cookie** — Kein localStorage-Token, kein Bearer-Header
6. **Plugin-Architektur** — Neue Features als Plugin in `packages/`, nicht im Core
7. **Komma-separierte Rollen** — Flexibles RBAC ohne Join-Tabelle
8. **Abteilungshierarchie** — Rollen-Vererbung über `parent_id`
9. **setInterval-Pollers** — Hintergrundjobs über `instrumentation.ts`, kein externer Cron
10. **`animate-fade-in`** — Jede Seite mit sanfter Einblendung
11. **Login-Animation** — Mehrschichtig (Gradient → Grid → Partikel → Orbs → Icons → Card), themenspezifisch anpassbar
12. **Stellvertretung** — `delegate_user_id` + `/api/colleagues` (Top-Level, nicht unter `/api/users/`)
13. **Impersonation** — Dual-Cookie-Ansatz (`token` + `original_token`), Amber-Banner als Indikator
