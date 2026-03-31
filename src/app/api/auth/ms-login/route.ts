import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const { query } = await import("@/lib/db")
    const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'ms_%'") as any[]
    const s: Record<string, string> = {}
    rows.forEach((r: any) => { s[r.key_name] = r.value })

    if (s.ms_login_enabled !== "true" || !s.ms_client_id) {
      return NextResponse.json({ error: "Microsoft-Login ist nicht aktiviert" }, { status: 400 })
    }

    const baseUrl = req.nextUrl.origin
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`
    const state = crypto.randomUUID()

    const params = new URLSearchParams({
      client_id: s.ms_client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "openid profile email User.Read",
      response_mode: "query",
      state,
    })

    const loginUrl = `https://login.microsoftonline.com/${s.ms_tenant_id}/oauth2/v2.0/authorize?${params}`

    const response = NextResponse.redirect(loginUrl)
    response.cookies.set("ms_oauth_state", state, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
