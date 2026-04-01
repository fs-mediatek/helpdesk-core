import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { getSession } = await import("@/lib/auth")
  const { query } = await import("@/lib/db")

  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = req.nextUrl.searchParams.get("path")
  if (!path || !path.startsWith("/api/v1/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  // Get Zammad settings
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'zammad_%'") as any[]
  const s: Record<string, string> = {}
  rows.forEach((r: any) => { s[r.key_name] = r.value })

  if (!s.zammad_url || !s.zammad_token) {
    return NextResponse.json({ error: "Zammad nicht konfiguriert" }, { status: 500 })
  }

  const baseUrl = s.zammad_url.replace(/\/+$/, "")
  const url = `${baseUrl}${path}`

  try {
    // Use curl to bypass TLS issues (same pattern as zammadFetch)
    const { execSync } = await import("child_process")
    const result = execSync(
      `curl -sk -H "Authorization: Token token=${s.zammad_token}" "${url}"`,
      { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    )

    // Detect content type from the response
    const headerResult = execSync(
      `curl -sk -I -H "Authorization: Token token=${s.zammad_token}" "${url}"`,
      { encoding: "utf-8", timeout: 10000 }
    )
    const contentTypeMatch = headerResult.match(/content-type:\s*([^\r\n]+)/i)
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream"

    return new NextResponse(result, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: "Proxy-Fehler: " + err.message }, { status: 502 })
  }
}
