import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { syncFromZammad, testConnection, getZammadSettings, invalidateZammadCache } from "@/lib/zammad"

// GET — status & settings
export async function GET() {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const s = await getZammadSettings()
  return NextResponse.json({
    enabled: s.zammad_enabled === "true",
    url: s.zammad_url || "",
    hasToken: !!s.zammad_token,
    interval: s.zammad_interval || "15",
    importStates: s.zammad_import_states || "1,2,3,8,9",
    syncClose: s.zammad_sync_close === "true",
  })
}

// POST — manual sync or test
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { action } = await req.json().catch(() => ({ action: "sync" }))

  // Always invalidate cache so freshly saved settings are used
  invalidateZammadCache()

  if (action === "test") {
    const result = await testConnection()
    return NextResponse.json(result)
  }

  if (action === "sync") {
    try {
      const result = await syncFromZammad()
      return NextResponse.json({ success: true, ...result })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 })
}
