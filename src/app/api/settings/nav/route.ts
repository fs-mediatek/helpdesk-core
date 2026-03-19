import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

// Public for authenticated users — returns nav visibility config
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const rows = await query("SELECT value FROM settings WHERE key_name = 'nav_visibility'") as any[]
    if (rows[0]?.value) {
      return NextResponse.json(JSON.parse(rows[0].value))
    }
  } catch {}
  return NextResponse.json({})
}
