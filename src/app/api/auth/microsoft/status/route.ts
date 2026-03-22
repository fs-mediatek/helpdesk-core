import { NextResponse } from "next/server"
import { getMicrosoftSettings } from "@/lib/microsoft"

export async function GET() {
  try {
    const s = await getMicrosoftSettings()
    const enabled = s.ms_login_enabled === "true" && !!s.ms_client_id && !!s.ms_tenant_id
    return NextResponse.json({ enabled })
  } catch {
    return NextResponse.json({ enabled: false })
  }
}
