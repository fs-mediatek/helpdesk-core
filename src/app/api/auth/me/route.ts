import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getEffectiveRoles } from "@/lib/effective-roles"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 })

  // Merge personal roles with department roles
  try {
    const effectiveRole = await getEffectiveRoles(session.userId)
    return NextResponse.json({ ...session, role: effectiveRole })
  } catch {
    return NextResponse.json(session)
  }
}
