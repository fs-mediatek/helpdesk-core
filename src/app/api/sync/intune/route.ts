import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function POST(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  if (!roles.includes("admin"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { syncIntuneDevices } = await import("@/lib/intune-sync")
    const result = await syncIntuneDevices()
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error("[Intune Sync API]", err)
    return NextResponse.json({ success: false, error: err.message || "Unbekannter Fehler" }, { status: 500 })
  }
}

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { query } = await import("@/lib/db")
    const rows = await query(
      "SELECT key_name, value FROM settings WHERE key_name IN ('intune_last_sync', 'intune_last_result', 'intune_sync_enabled')"
    ) as any[]
    const data: Record<string, string> = {}
    rows.forEach((r: any) => { data[r.key_name] = r.value })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
