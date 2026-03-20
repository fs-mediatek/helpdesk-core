/**
 * Called once at server startup (from instrumentation.ts).
 * Runs migrations and onLoad() for every plugin.
 */
import { plugins } from '@/plugins/registry'
import { pool } from '@/lib/db'

let initialized = false

async function runMigrations() {
  for (const plugin of plugins) {
    if (!plugin.migrations?.length) continue
    for (const sql of plugin.migrations) {
      try {
        await pool.execute(sql)
      } catch {
        // Silently ignore — duplicate columns, existing tables, etc.
      }
    }
    console.log(`[Plugin] ${plugin.manifest.id} migrations done`)
  }
}

export function initPlugins() {
  if (initialized) return
  initialized = true

  // Run migrations async, then start onLoad hooks
  runMigrations().then(() => {
    for (const plugin of plugins) {
      if (typeof plugin.onLoad === 'function') {
        try {
          plugin.onLoad()
          console.log(`[Plugin] ${plugin.manifest.id} onLoad() started`)
        } catch (err) {
          console.error(`[Plugin] ${plugin.manifest.id} onLoad() failed:`, err)
        }
      }
    }
  }).catch(err => console.error('[Plugin] Migration runner failed:', err))
}
