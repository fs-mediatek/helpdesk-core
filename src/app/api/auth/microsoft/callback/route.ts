import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForToken, getMicrosoftUserProfile } from "@/lib/microsoft"
import { signToken } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import bcrypt from "bcryptjs"

async function getBaseUrl(fallback: string): Promise<string> {
  try {
    const rows = await query("SELECT value FROM settings WHERE key_name = 'app_url'") as any[]
    return (process.env.APP_URL || rows[0]?.value || fallback).replace(/\/+$/, '')
  } catch {
    return (process.env.APP_URL || fallback).replace(/\/+$/, '')
  }
}

export async function GET(req: NextRequest) {
  const baseUrl = await getBaseUrl(req.nextUrl.origin)

  try {
    const code = req.nextUrl.searchParams.get("code")
    const state = req.nextUrl.searchParams.get("state")
    const error = req.nextUrl.searchParams.get("error")
    const errorDesc = req.nextUrl.searchParams.get("error_description")

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDesc || error)}`, baseUrl))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/login?error=Kein+Autorisierungscode+erhalten", baseUrl))
    }

    // Verify state
    const savedState = req.cookies.get("ms_oauth_state")?.value
    if (!savedState || savedState !== state) {
      return NextResponse.redirect(new URL("/login?error=Ungültiger+OAuth-State", baseUrl))
    }

    const redirectUri = `${baseUrl}/api/auth/microsoft/callback`

    // Exchange code for tokens
    const tokenData = await exchangeCodeForToken(code, redirectUri)

    // Get user profile from Microsoft
    const profile = await getMicrosoftUserProfile(tokenData.access_token)

    const email = (profile.mail || profile.userPrincipalName || "").toLowerCase()
    const name = profile.displayName || email.split("@")[0]
    const department = profile.department || null
    const phone = profile.businessPhones?.[0] || profile.mobilePhone || null

    if (!email) {
      return NextResponse.redirect(new URL("/login?error=Keine+E-Mail+vom+Microsoft-Konto+erhalten", baseUrl))
    }

    // Find or create user
    let user = await queryOne<any>("SELECT * FROM users WHERE email = ?", [email])

    if (!user) {
      // Auto-create user on first Microsoft login
      const randomPass = crypto.randomUUID()
      const hash = await bcrypt.hash(randomPass, 10)

      await query(
        "INSERT INTO users (name, email, password_hash, role, department, phone, active) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [name, email, hash, "user", department, phone]
      )

      user = await queryOne<any>("SELECT * FROM users WHERE email = ?", [email])
    } else if (!user.active) {
      return NextResponse.redirect(new URL("/login?error=Konto+ist+deaktiviert", baseUrl))
    } else {
      // Update name/department/phone from Microsoft profile if changed
      await query(
        "UPDATE users SET name = ?, department = COALESCE(?, department), phone = COALESCE(?, phone) WHERE id = ?",
        [name, department, phone, user.id]
      )
    }

    // Create JWT
    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const response = NextResponse.redirect(new URL("/dashboard", baseUrl))
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: baseUrl.startsWith("https"),
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    })
    response.cookies.delete("ms_oauth_state")

    return response
  } catch (err: any) {
    console.error("[Microsoft Callback Error]", err)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || "Microsoft-Anmeldung fehlgeschlagen")}`, baseUrl)
    )
  }
}
