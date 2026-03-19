import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"

const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (publicPaths.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url))
  const session = await getSessionFromRequest(req)
  if (!session && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
