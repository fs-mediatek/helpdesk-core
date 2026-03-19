import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sendMail, invalidateMailCache } from "@/lib/mailer"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json().catch(() => ({}))
    const to = body?.to?.trim() || session.email
    if (!to || !to.includes("@"))
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 })

    invalidateMailCache()
    await sendMail(
      to,
      "HelpDesk — Test-Mail",
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#4F46E5">HelpDesk — Mailversand funktioniert!</h2>
        <p>Diese E-Mail bestätigt, dass der SMTP-Versand korrekt konfiguriert ist.</p>
        <p style="color:#888;font-size:13px">Empfänger: ${to}</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Gesendet am ${new Date().toLocaleString("de-DE")}</p>
      </div>`
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[Test Mail Error]", err)
    return NextResponse.json({ error: err?.message || "Mailversand fehlgeschlagen" }, { status: 500 })
  }
}
