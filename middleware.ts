import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/satisfaction",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/login-status",
  "/api/auth/ms-login",
  "/api/auth/microsoft",
  "/api/setup",
  "/api/satisfaction",
]

async function getSession(req: NextRequest) {
  const token = req.cookies.get("token")?.value
  if (!token) return null
  try {
    const { jwtVerify } = await import("jose")
    const secret = new TextEncoder().encode(process.env.APP_SECRET_KEY || "fallback-secret-key")
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Root → dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  const session = await getSession(req)

  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
