// Entra ID (Azure AD) User Sync — syncs users from Microsoft Graph API
import { getAppAccessToken } from "@/lib/microsoft"
import { query, pool } from "@/lib/db"
import crypto from "crypto"

interface EntraUser {
  id: string
  displayName: string | null
  mail: string | null
  userPrincipalName: string
  department: string | null
  jobTitle: string | null
  mobilePhone: string | null
  businessPhones: string[]
  officeLocation: string | null
  accountEnabled: boolean
}

const ALLOWED_DOMAINS = ["@ueag-jena.de", "@injena.de"]

function isAllowedDomain(email: string): boolean {
  const lower = email.toLowerCase()
  return ALLOWED_DOMAINS.some(d => lower.endsWith(d))
}

async function ensureUserColumns() {
  const cols: [string, string][] = [
    ["jobtitle", "VARCHAR(150) DEFAULT NULL"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE users ADD COLUMN ${col} ${def}`).catch(() => {})
  }
}

async function fetchAllEntraUsers(token: string): Promise<EntraUser[]> {
  const allUsers: EntraUser[] = []
  let url: string | null = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,department,jobTitle,mobilePhone,businessPhones,officeLocation,accountEnabled&$top=999"

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Entra-Benutzerabruf fehlgeschlagen: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()
    if (data.value) allUsers.push(...data.value)
    url = data["@odata.nextLink"] || null
  }

  return allUsers
}

export async function syncEntraUsers(): Promise<{ created: number; updated: number; deactivated: number; skipped: number }> {
  const token = await getAppAccessToken()
  await ensureUserColumns()

  const entraUsers = await fetchAllEntraUsers(token)
  let created = 0, updated = 0, deactivated = 0, skipped = 0

  for (const eu of entraUsers) {
    const email = (eu.mail || eu.userPrincipalName || "").toLowerCase().trim()
    if (!email || !isAllowedDomain(email)) {
      skipped++
      continue
    }

    const phone = eu.mobilePhone || (eu.businessPhones?.length ? eu.businessPhones[0] : null)
    const name = eu.displayName || email.split("@")[0]

    // Check if user already exists
    const existing = await query("SELECT id, active FROM users WHERE email = ?", [email]) as any[]

    if (existing.length > 0) {
      const user = existing[0]

      if (!eu.accountEnabled) {
        // Deactivate user
        if (user.active !== 0) {
          await pool.execute("UPDATE users SET active = 0 WHERE id = ?", [user.id])
          deactivated++
        } else {
          skipped++
        }
      } else {
        // Update user info, re-enable if needed
        await pool.execute(
          "UPDATE users SET name = ?, department = ?, phone = ?, jobtitle = ?, active = 1 WHERE id = ?",
          [name, eu.department || null, phone || null, eu.jobTitle || null, user.id]
        )
        updated++
      }
    } else {
      if (!eu.accountEnabled) {
        skipped++
        continue
      }

      // Create new user with random password hash (can't login with password)
      const randomHash = crypto.randomBytes(32).toString("hex")
      await pool.execute(
        "INSERT INTO users (name, email, password_hash, role, department, phone, jobtitle, active) VALUES (?, ?, ?, 'user', ?, ?, ?, 1)",
        [name, email, randomHash, eu.department || null, phone || null, eu.jobTitle || null]
      )
      created++
    }
  }

  // Store sync result in settings
  const now = new Date().toISOString()
  const result = JSON.stringify({ created, updated, deactivated, skipped, timestamp: now })

  await pool.execute(
    "INSERT INTO settings (key_name, value) VALUES ('entra_last_sync', ?) ON DUPLICATE KEY UPDATE value = ?",
    [now, now]
  )
  await pool.execute(
    "INSERT INTO settings (key_name, value) VALUES ('entra_last_result', ?) ON DUPLICATE KEY UPDATE value = ?",
    [result, result]
  )

  console.log(`[Entra Sync] Fertig: ${created} erstellt, ${updated} aktualisiert, ${deactivated} deaktiviert, ${skipped} übersprungen`)
  return { created, updated, deactivated, skipped }
}
