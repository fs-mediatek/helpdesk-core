import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForToken, getMicrosoftUserProfile } from "@/lib/microsoft"
import { signToken } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")
    const state = req.nextUrl.searchParams.get("state")
    const error = req.nextUrl.searchParams.get("error")
    const errorDesc = req.nextUrl.searchParams.get("error_description")

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDesc || error)}`, req.nextUrl.origin))
    }

    if (!code) {
      return NextResponse.redirect(new URL("/login?error=Kein+Autorisierungscode+erhalten", req.nextUrl.origin))
    }

    // Verify state
    const savedState = req.cookies.get("ms_oauth_state")?.value
    if (!savedState || savedState !== state) {
      return NextResponse.redirect(new URL("/login?error=Ungültiger+OAuth-State", req.nextUrl.origin))
    }

    const baseUrl = req.nextUrl.origin
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
      return NextResponse.redirect(new URL("/login?error=Keine+E-Mail+vom+Microsoft-Konto+erhalten", req.nextUrl.origin))
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
      return NextResponse.redirect(new URL("/login?error=Konto+ist+deaktiviert", req.nextUrl.origin))
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

    const response = NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin))
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    })
    response.cookies.delete("ms_oauth_state")

    return response
  } catch (err: any) {
    console.error("[Microsoft Callback Error]", err)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || "Microsoft-Anmeldung fehlgeschlagen")}`, req.nextUrl.origin)
    )
  }
}
