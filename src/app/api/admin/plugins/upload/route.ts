import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { registerPlugin, PACKAGES_DIR } from '@/lib/plugins/registry-manager'
import { execSync } from 'child_process'
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes('admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('plugin') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
  if (!file.name.endsWith('.zip')) {
    return NextResponse.json({ error: 'Nur .zip-Dateien erlaubt' }, { status: 400 })
  }

  // Write zip to temp file
  const buffer = Buffer.from(await file.arrayBuffer())
  const tmpPath = path.join(process.cwd(), 'uploads', `plugin-upload-${Date.now()}.zip`)
  fs.mkdirSync(path.dirname(tmpPath), { recursive: true })
  fs.writeFileSync(tmpPath, buffer)

  try {
    const zip = new AdmZip(tmpPath)
    const entries = zip.getEntries()

    // Find package.json — support both flat zip and single-subdir zip
    let prefix = ''
    const rootPkgEntry = entries.find(e => e.entryName === 'package.json')
    if (!rootPkgEntry) {
      // Try single top-level directory
      const dirs = [...new Set(entries.map(e => e.entryName.split('/')[0]))]
      if (dirs.length === 1) {
        prefix = dirs[0] + '/'
      }
    }

    const pkgEntry = zip.getEntry(prefix + 'package.json')
    if (!pkgEntry) {
      return NextResponse.json({ error: 'Kein package.json im ZIP gefunden' }, { status: 422 })
    }

    const pkgJson = JSON.parse(pkgEntry.getData().toString('utf8'))
    if (!pkgJson['helpdesk-plugin']) {
      return NextResponse.json(
        { error: 'Kein gültiges HelpDesk-Plugin (fehlendes "helpdesk-plugin": true im package.json)' },
        { status: 422 }
      )
    }

    const pluginName: string = pkgJson.name
    if (!pluginName) {
      return NextResponse.json({ error: 'package.json hat keinen "name"-Eintrag' }, { status: 422 })
    }

    // Extract to packages/<id>
    const safeDirName = pluginName.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9-_]/g, '-')
    const destDir = path.join(PACKAGES_DIR, safeDirName)
    fs.mkdirSync(destDir, { recursive: true })

    for (const entry of entries) {
      if (entry.isDirectory) continue
      const relPath = prefix ? entry.entryName.slice(prefix.length) : entry.entryName
      if (!relPath) continue
      const outPath = path.join(destDir, relPath)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, entry.getData())
    }

    // npm install the extracted package
    execSync(`npm install ./packages/${safeDirName}`, {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    // Register in registry.ts
    registerPlugin(pluginName, pluginName)

    return NextResponse.json({
      success: true,
      plugin: {
        name: pluginName,
        version: pkgJson.version,
        description: pkgJson.description,
      },
    })
  } catch (err: any) {
    console.error('[Plugin Upload]', err)
    return NextResponse.json({ error: err.message || 'Installation fehlgeschlagen' }, { status: 500 })
  } finally {
    fs.unlink(tmpPath, () => {})
  }
}
