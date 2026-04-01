// Next.js instrumentation hook — runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initPlugins } = await import('./src/lib/plugins/init')
    initPlugins()

    // Start mail poller for Microsoft 365 inbox → ticket creation
    const { startMailPoller } = await import('./src/lib/mail-poller')
    startMailPoller()

    // Start Zammad sync poller
    const { startZammadPoller } = await import('./src/lib/zammad-poller')
    startZammadPoller()

    // Start Entra ID + Intune sync poller
    const { startSyncPoller } = await import('./src/lib/sync-poller')
    startSyncPoller()
  }
}
