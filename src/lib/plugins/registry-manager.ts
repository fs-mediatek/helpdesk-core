/**
 * Shared registry manipulation logic.
 * Used by both the CLI (scripts/plugin.js) and the web API routes.
 * Server-only — never import this in client components.
 */

import fs from 'fs'
import path from 'path'

export const REGISTRY_PATH = path.join(process.cwd(), 'src', 'plugins', 'registry.ts')
export const PACKAGES_DIR = path.join(process.cwd(), 'packages')

export interface RegistryEntry {
  varName: string
  packageName: string
  importPath: string
}

export function readRegistry(): string {
  return fs.readFileSync(REGISTRY_PATH, 'utf8')
}

export function writeRegistry(content: string): void {
  fs.writeFileSync(REGISTRY_PATH, content, 'utf8')
}

export function getInstalledPlugins(content: string): RegistryEntry[] {
  const matches = content.match(/import \w+ from '[^']+' \/\/ plugin:[^\n]+/g) || []
  return matches
    .map(line => {
      const m = line.match(/import (\w+) from '([^']+)' \/\/ plugin:(.+)/)
      return m ? { varName: m[1], packageName: m[3].trim(), importPath: m[2] } : null
    })
    .filter((x): x is RegistryEntry => x !== null)
}

export function packageToVarName(pkg: string): string {
  return (
    pkg
      .replace(/^@[^/]+\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_(.)/g, (_, c: string) => c.toUpperCase()) + 'Plugin'
  )
}

export function regenerateRegistry(plugins: RegistryEntry[]): string {
  const imports = plugins
    .map(p => `import ${p.varName} from '${p.importPath}' // plugin:${p.packageName}`)
    .join('\n')

  const list = plugins.map(p => `  ${p.varName},`).join('\n')

  return `// ============================================================
// AUTO-GENERATED — do not edit manually
// Use: npm run plugin install <package-name>
//      npm run plugin remove <package-name>
//      npm run plugin list
// ============================================================
import type { HelpdeskPlugin } from '@/lib/plugins/types'

// BEGIN_PLUGIN_IMPORTS
${imports}
// END_PLUGIN_IMPORTS

export const plugins: HelpdeskPlugin[] = [
// BEGIN_PLUGIN_LIST
${list}
// END_PLUGIN_LIST
]
`
}

export function registerPlugin(packageName: string, importPath: string): void {
  const content = readRegistry()
  const current = getInstalledPlugins(content)
  if (current.find(p => p.packageName === packageName)) return
  const varName = packageToVarName(packageName)
  current.push({ varName, packageName, importPath })
  writeRegistry(regenerateRegistry(current))
}

export function unregisterPlugin(packageName: string): boolean {
  const content = readRegistry()
  const current = getInstalledPlugins(content)
  const filtered = current.filter(p => p.packageName !== packageName)
  if (filtered.length === current.length) return false
  writeRegistry(regenerateRegistry(filtered))
  return true
}
