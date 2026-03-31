import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { query } = await import("@/lib/db")
    const msRows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'ms_%'") as any[]
    const ms: Record<string, string> = {}
    msRows.forEach((r: any) => { ms[r.key_name] = r.value })
    const msConfigured = ms.ms_login_enabled === "true" && !!ms.ms_client_id && !!ms.ms_tenant_id
    const methodRows = await query("SELECT value FROM settings WHERE key_name = 'login_method'") as any[]
    const loginMethod = methodRows[0]?.value || "both"
    return NextResponse.json({
      enabled: msConfigured,
      login_method: loginMethod,
      show_password: loginMethod === "both" || loginMethod === "password" || !msConfigured,
      show_microsoft: msConfigured && (loginMethod === "both" || loginMethod === "microsoft"),
    })
  } catch (err: any) {
    return NextResponse.json({ enabled: false, login_method: "password", show_password: true, show_microsoft: false })
  }
}
