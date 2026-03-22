import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query } from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { sender, subject, ticket_id } = await req.json()

  if (!sender && !subject) {
    return NextResponse.json({ error: "Absender oder Betreff erforderlich" }, { status: 400 })
  }

  // Append to existing blacklist settings
  if (sender) {
    const rows = await query("SELECT value FROM settings WHERE key_name = 'zammad_blacklist_senders'") as any[]
    const current = rows[0]?.value || ""
    const lines = current.split("\n").map((l: string) => l.trim()).filter(Boolean)
    if (!lines.some((l: string) => l.toLowerCase() === sender.toLowerCase())) {
      lines.push(sender)
      await query(
        "INSERT INTO settings (key_name, value) VALUES ('zammad_blacklist_senders', ?) ON DUPLICATE KEY UPDATE value = ?",
        [lines.join("\n"), lines.join("\n")]
      )
    }
  }

  if (subject) {
    const rows = await query("SELECT value FROM settings WHERE key_name = 'zammad_blacklist_subjects'") as any[]
    const current = rows[0]?.value || ""
    const lines = current.split("\n").map((l: string) => l.trim()).filter(Boolean)
    if (!lines.some((l: string) => l.toLowerCase() === subject.toLowerCase())) {
      lines.push(subject)
      await query(
        "INSERT INTO settings (key_name, value) VALUES ('zammad_blacklist_subjects', ?) ON DUPLICATE KEY UPDATE value = ?",
        [lines.join("\n"), lines.join("\n")]
      )
    }
  }

  // Close the ticket if provided
  if (ticket_id) {
    await query("UPDATE tickets SET status = 'closed' WHERE id = ?", [ticket_id])
  }

  return NextResponse.json({ success: true })
}
