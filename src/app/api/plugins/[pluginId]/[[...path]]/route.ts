import { NextRequest, NextResponse } from 'next/server'
import { plugins } from '@/plugins/registry'
import { matchPluginRoute } from '@/lib/plugins/router'
import { getSessionFromRequest } from '@/lib/auth'
import { query, queryOne, pool } from '@/lib/db'

async function insert(sql: string, params?: any[]): Promise<number> {
  const [result] = await pool.execute(sql, params)
  return (result as any).insertId
}

const db = { query, queryOne, insert }

type RouteContext = { params: Promise<{ pluginId: string; path?: string[] }> }

async function handle(req: NextRequest, { params }: RouteContext) {
  const { pluginId, path } = await params
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plugin = plugins.find(p => p.manifest.id === pluginId)
  if (!plugin) return NextResponse.json({ error: 'Plugin not found' }, { status: 404 })
  if (!plugin.api) return NextResponse.json({ error: 'No API' }, { status: 404 })

  // path is undefined when URL is /api/plugins/<id> (no trailing segments)
  const pathStr = '/' + (path ?? []).join('/')
  const match = matchPluginRoute(plugin.api, req.method, pathStr)
  if (!match) return NextResponse.json({ error: 'Route not found' }, { status: 404 })

  const ctx = {
    params: match.params,
    searchParams: new URL(req.url).searchParams,
    session,
    db,
  }

  try {
    return await match.handler(req, ctx)
  } catch (err: any) {
    console.error(`[Plugin ${pluginId}] API error:`, err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
export const PATCH = handle
