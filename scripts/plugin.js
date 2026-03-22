#!/usr/bin/env node
/**
 * HelpDesk Plugin CLI
 *
 * Usage:
 *   npm run plugin install <package-name>
 *   npm run plugin install ./local/path/to/plugin
 *   npm run plugin remove <package-name>
 *   npm run plugin list
 *
 * Note: Uses the same registry-manager logic as the web UI.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const REGISTRY_PATH = path.join(ROOT, 'src', 'plugins', 'registry.ts')

// --- Inline the registry-manager logic (mirrors src/lib/plugins/registry-manager.ts) ---

function readRegistry() {
  return fs.readFileSync(REGISTRY_PATH, 'utf8')
}

function writeRegistry(content) {
  fs.writeFileSync(REGISTRY_PATH, content, 'utf8')
}

function getInstalledPlugins(content) {
  const matches = content.match(/import \w+ from '[^']+' \/\/ plugin:[^\n]+/g) || []
  return matches
    .map(line => {
      const m = line.match(/import (\w+) from '([^']+)' \/\/ plugin:(.+)/)
      return m ? { varName: m[1], packageName: m[3].trim(), importPath: m[2] } : null
    })
    .filter(Boolean)
}

function packageToVarName(pkg) {
  return (
    pkg
      .replace(/^@[^/]+\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_(.)/g, (_, c) => c.toUpperCase()) + 'Plugin'
  )
}

function regenerateRegistry(plugins) {
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

// --- Commands ---

const [,, command, packageArg] = process.argv

function install(pkg) {
  if (!pkg) { console.error('Usage: npm run plugin install <package>'); process.exit(1) }

  console.log(`\n📦 Installing ${pkg}...`)
  execSync(`npm install ${pkg}`, { stdio: 'inherit', cwd: ROOT })

  let resolvedName = pkg
  let importPath = pkg
  if (pkg.startsWith('.') || pkg.startsWith('/')) {
    const abs = path.resolve(pkg)
    const pkgJson = JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8'))
    resolvedName = pkgJson.name
    importPath = resolvedName
  }

  const content = readRegistry()
  const current = getInstalledPlugins(content)
  if (current.find(p => p.packageName === resolvedName)) {
    console.log(`✓ ${resolvedName} is already registered.`)
    return
  }
  const varName = packageToVarName(resolvedName)
  current.push({ varName, packageName: resolvedName, importPath })
  writeRegistry(regenerateRegistry(current))

  console.log(`\n✅ "${resolvedName}" installed.`)
  console.log(`🔄 Restart the server to activate it.\n`)
}

function remove(pkg) {
  if (!pkg) { console.error('Usage: npm run plugin remove <package>'); process.exit(1) }

  const content = readRegistry()
  const current = getInstalledPlugins(content)
  const filtered = current.filter(p => p.packageName !== pkg)
  if (filtered.length === current.length) { console.error(`Plugin "${pkg}" not found.`); process.exit(1) }

  writeRegistry(regenerateRegistry(filtered))
  try { execSync(`npm uninstall ${pkg}`, { stdio: 'inherit', cwd: ROOT }) } catch {}

  console.log(`\n✅ "${pkg}" removed.`)
  console.log(`🔄 Restart the server to deactivate it.\n`)
}

function list() {
  const plugins = getInstalledPlugins(readRegistry())
  if (!plugins.length) { console.log('\nNo plugins installed.\n'); return }
  console.log('\nInstalled plugins:')
  plugins.forEach(p => console.log(`  • ${p.packageName}`))
  console.log()
}

switch (command) {
  case 'install': install(packageArg); break
  case 'remove': case 'uninstall': remove(packageArg); break
  case 'list': list(); break
  default:
    console.log(`
HelpDesk Plugin CLI

  npm run plugin install <package>    Install a plugin
  npm run plugin remove <package>     Remove a plugin
  npm run plugin list                 List installed plugins
`)
}
