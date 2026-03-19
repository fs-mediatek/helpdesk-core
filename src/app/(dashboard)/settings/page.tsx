import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { query } from "@/lib/db"
import { SettingsClient } from "@/components/settings/settings-client"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.role.includes("admin")) redirect("/dashboard")
  const rows = await query("SELECT key_name, value FROM settings")
  const settings: Record<string, string> = {}
  ;(rows as any[]).forEach(r => { settings[r.key_name] = r.value })
  return <SettingsClient initialSettings={settings} />
}
