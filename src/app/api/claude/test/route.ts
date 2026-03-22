import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST() {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rows = await query("SELECT key_name, value FROM settings WHERE key_name IN ('claude_api_key', 'claude_model')") as any[]
  const s: Record<string, string> = {}
  rows.forEach((r: any) => { s[r.key_name] = r.value })

  if (!s.claude_api_key) return NextResponse.json({ ok: false, error: "API-Key nicht konfiguriert" })

  try {
    const model = s.claude_model || "claude-sonnet-4-20250514"
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": s.claude_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 50,
        messages: [{ role: "user", content: "Antworte nur mit: OK" }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ ok: false, error: err.error?.message || `HTTP ${res.status}` })
    }

    return NextResponse.json({ ok: true, model })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
