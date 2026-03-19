import type { NextRequest, NextResponse } from 'next/server'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  icon: string          // lucide-react icon name e.g. "Package"
  navItems: Array<{
    label: string
    href: string        // will be /p/<pluginId>/<href>
    icon: string        // lucide-react icon name
  }>
}

export type PluginAPIContext = {
  params: Record<string, string>
  searchParams: URLSearchParams
  session: { userId: number; email: string; name: string; role: string }
  db: {
    query: <T = any>(sql: string, params?: any[]) => Promise<T[]>
    queryOne: <T = any>(sql: string, params?: any[]) => Promise<T | null>
    insert: (sql: string, params?: any[]) => Promise<number> // returns insertId
  }
}

export type PluginAPIHandler = (
  req: NextRequest,
  ctx: PluginAPIContext
) => Promise<NextResponse>

export interface HelpdeskPlugin {
  manifest: PluginManifest
  /**
   * API routes. Key format: "METHOD /path/:param"
   * e.g. "GET /items", "POST /items", "GET /items/:id", "PUT /items/:id"
   * These will be mounted at /api/plugins/<pluginId>/<path>
   */
  api?: Record<string, PluginAPIHandler>
  /**
   * The React component that renders the plugin UI.
   * Receives the URL slug segments after /p/<pluginId>/
   * Must be a Client Component or handle SSR properly.
   */
  Component?: React.ComponentType<{ slug: string[] }>
  /**
   * Optional SQL migrations to run on first activation.
   * Array of SQL strings.
   */
  migrations?: string[]
  /**
   * Optional background service started when the server loads.
   * Use for polling loops, scheduled tasks, etc.
   */
  onLoad?: () => void
}
