// Background Zammad sync — started from instrumentation.ts

let pollerInterval: ReturnType<typeof setInterval> | null = null
let currentIntervalMs = 0

export function startZammadPoller() {
  if (pollerInterval) return

  // Check every 60s if sync is enabled and run if interval has passed
  let lastRun = 0

  pollerInterval = setInterval(async () => {
    try {
      const { getZammadSettings, syncFromZammad } = await import("@/lib/zammad")
      const settings = await getZammadSettings()

      if (settings.zammad_enabled !== "true" || !settings.zammad_url || !settings.zammad_token) return

      const intervalMinutes = parseInt(settings.zammad_interval || "15") || 15
      const intervalMs = intervalMinutes * 60 * 1000
      const now = Date.now()

      if (now - lastRun < intervalMs) return

      lastRun = now
      const result = await syncFromZammad()

      if (result.imported > 0 || result.updated > 0) {
        console.log(`[Zammad Sync] ${result.imported} importiert, ${result.updated} aktualisiert`)
      }
      if (result.errors.length > 0) {
        console.error(`[Zammad Sync] ${result.errors.length} Fehler:`, result.errors.slice(0, 3).join("; "))
      }
    } catch (err: any) {
      if (!err.message?.includes("nicht konfiguriert")) {
        console.error("[Zammad Sync] Fehler:", err.message)
      }
    }
  }, 60_000) // Check every 60s

  console.log("[Zammad Sync] Poller gestartet")
}
