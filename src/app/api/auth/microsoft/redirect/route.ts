import { NextRequest, NextResponse } from "next/server"
import { getMicrosoftSettings, getLoginUrl } from "@/lib/microsoft"

export async function GET(req: NextRequest) {
  try {
    const settings = await getMicrosoftSettings()
    if (settings.ms_login_enabled !== "true" || !settings.ms_client_id) {
      return NextResponse.json({ error: "Microsoft-Login ist nicht aktiviert" }, { status: 400 })
    }

    const baseUrl = req.nextUrl.origin
    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`

    // Random state to prevent CSRF
    const state = crypto.randomUUID()

    const loginUrl = getLoginUrl(redirectUri, state)

    const response = NextResponse.redirect(loginUrl)
    response.cookies.set("ms_oauth_state", state, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
