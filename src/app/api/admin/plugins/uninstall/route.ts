import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { unregisterPlugin, PACKAGES_DIR } from '@/lib/plugins/registry-manager'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes('admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { packageName } = await req.json()
  if (!packageName) return NextResponse.json({ error: 'packageName fehlt' }, { status: 400 })

  // Unregister from registry.ts
  const removed = unregisterPlugin(packageName)
  if (!removed) {
    return NextResponse.json({ error: 'Plugin nicht gefunden' }, { status: 404 })
  }

  // npm uninstall
  try {
    execSync(`npm uninstall ${packageName}`, { cwd: process.cwd(), stdio: 'pipe' })
  } catch { /* ignore */ }

  // Remove extracted package directory if it lives in /packages
  const safeDirName = packageName.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9-_]/g, '-')
  const destDir = path.join(PACKAGES_DIR, safeDirName)
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true })
  }

  return NextResponse.json({ success: true })
}
