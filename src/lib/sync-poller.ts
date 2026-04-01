// Background poller for Entra ID + Intune sync — started from instrumentation.ts

let pollerInterval: ReturnType<typeof setInterval> | null = null
let automationInterval: ReturnType<typeof setInterval> | null = null
const CHECK_INTERVAL = 60_000 // check every 60 seconds
const AUTOMATION_INTERVAL = 300_000 // SLA + satisfaction every 5 minutes

export function startSyncPoller() {
  if (pollerInterval) return // already running

  setTimeout(async () => {
    await checkAndSync()

    pollerInterval = setInterval(async () => {
      await checkAndSync()
    }, CHECK_INTERVAL)

    // Automation checks every 5 minutes (SLA escalation + satisfaction surveys)
    await runAutomationChecks()
    automationInterval = setInterval(async () => {
      await runAutomationChecks()
    }, AUTOMATION_INTERVAL)
  }, 15_000) // wait 15s after startup

  console.log("[Sync Poller] Gestartet (prüft alle 60s, Automatisierung alle 5min)")
}

async function checkAndSync() {
  try {
    const { query } = await import("@/lib/db")
    const rows = await query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('entra_sync_enabled', 'intune_sync_enabled', 'sync_interval_hours', 'entra_last_sync', 'intune_last_sync')"
    ) as any[]

    const settings: Record<string, string> = {}
    rows.forEach((r: any) => { settings[r.key_name] = r.value })

    const intervalHours = parseFloat(settings.sync_interval_hours || "6") || 6
    const intervalMs = intervalHours * 60 * 60 * 1000
    const now = Date.now()

    // Entra ID sync
    if (settings.entra_sync_enabled === "true") {
      const lastSync = settings.entra_last_sync ? new Date(settings.entra_last_sync).getTime() : 0
      if (now - lastSync >= intervalMs) {
        console.log("[Sync Poller] Starte Entra ID Sync...")
        try {
          const { syncEntraUsers } = await import("@/lib/entra-sync")
          await syncEntraUsers()
        } catch (err: any) {
          console.error("[Sync Poller] Entra Sync Fehler:", err.message)
        }
      }
    }

    // Intune sync
    if (settings.intune_sync_enabled === "true") {
      const lastSync = settings.intune_last_sync ? new Date(settings.intune_last_sync).getTime() : 0
      if (now - lastSync >= intervalMs) {
        console.log("[Sync Poller] Starte Intune Sync...")
        try {
          const { syncIntuneDevices } = await import("@/lib/intune-sync")
          await syncIntuneDevices()
        } catch (err: any) {
          console.error("[Sync Poller] Intune Sync Fehler:", err.message)
        }
      }
    }
  } catch (err: any) {
    console.error("[Sync Poller] Fehler:", err.message)
  }
}

async function runAutomationChecks() {
  // SLA escalation check
  try {
    const { checkSlaEscalations } = await import("@/lib/sla-escalation")
    await checkSlaEscalations()
  } catch {}

  // Satisfaction survey check
  try {
    const { sendPendingSurveys } = await import("@/lib/satisfaction-survey")
    await sendPendingSurveys()
  } catch {}
}
