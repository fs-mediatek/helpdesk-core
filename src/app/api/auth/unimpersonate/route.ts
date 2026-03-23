import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/auth"

export async function POST() {
  const cookieStore = await cookies()
  const originalToken = cookieStore.get("original_token")?.value
  if (!originalToken) return NextResponse.json({ error: "Kein aktiver Wechsel" }, { status: 400 })

  const payload = await verifyToken(originalToken)
  if (!payload) return NextResponse.json({ error: "Ungültiger Token" }, { status: 400 })

  cookieStore.set("token", originalToken, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 })
  cookieStore.delete("original_token")
  return NextResponse.json({ success: true })
}
