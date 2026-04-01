// Intune Device Sync — syncs managed devices from Microsoft Graph API
import { getAppAccessToken } from "@/lib/microsoft"
import { query, pool } from "@/lib/db"

interface IntuneDevice {
  id: string
  deviceName: string | null
  serialNumber: string | null
  manufacturer: string | null
  model: string | null
  operatingSystem: string | null
  osVersion: string | null
  complianceState: string | null
  lastSyncDateTime: string | null
  userPrincipalName: string | null
  managedDeviceOwnerType: string | null
  enrolledDateTime: string | null
}

async function ensureAssetColumns() {
  const cols: [string, string][] = [
    ["compliance_status", "VARCHAR(50) DEFAULT NULL"],
    ["intune_device_id", "VARCHAR(100) DEFAULT NULL"],
    ["os_version", "VARCHAR(100) DEFAULT NULL"],
    ["primary_user_email", "VARCHAR(255) DEFAULT NULL"],
    ["manufacturer", "VARCHAR(100) DEFAULT NULL"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE assets ADD COLUMN ${col} ${def}`).catch(() => {})
  }
}

function determinePlatform(os: string | null): string {
  if (!os) return "other"
  const lower = os.toLowerCase()
  if (lower.includes("windows")) return "windows"
  if (lower.includes("ios") || lower.includes("ipados")) return "ios"
  if (lower.includes("android")) return "android"
  if (lower.includes("macos") || lower.includes("mac os")) return "macos"
  return "other"
}

async function fetchAllIntuneDevices(token: string): Promise<IntuneDevice[]> {
  const allDevices: IntuneDevice[] = []
  let url: string | null = "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$select=id,deviceName,serialNumber,manufacturer,model,operatingSystem,osVersion,complianceState,lastSyncDateTime,userPrincipalName,managedDeviceOwnerType,enrolledDateTime&$top=999"

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Intune-Geräteabruf fehlgeschlagen: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()
    if (data.value) allDevices.push(...data.value)
    url = data["@odata.nextLink"] || null
  }

  return allDevices
}

export async function syncIntuneDevices(): Promise<{ created: number; updated: number; skipped: number }> {
  const token = await getAppAccessToken()
  await ensureAssetColumns()

  const devices = await fetchAllIntuneDevices(token)
  let created = 0, updated = 0, skipped = 0

  for (const device of devices) {
    const serial = device.serialNumber?.trim() || null
    const deviceName = device.deviceName || "Unbekanntes Gerät"
    const platform = determinePlatform(device.operatingSystem)

    // Try to find user by UPN
    let assignedUserId: number | null = null
    if (device.userPrincipalName) {
      const userRows = await query("SELECT id FROM users WHERE email = ?", [device.userPrincipalName.toLowerCase()]) as any[]
      if (userRows.length > 0) assignedUserId = userRows[0].id
    }

    // Match existing asset: by serial_number first, then by intune_device_id
    let existing: any = null
    if (serial) {
      const rows = await query("SELECT id, status FROM assets WHERE serial_number = ? LIMIT 1", [serial]) as any[]
      if (rows.length > 0) existing = rows[0]
    }
    if (!existing && device.id) {
      const rows = await query("SELECT id, status FROM assets WHERE intune_device_id = ? LIMIT 1", [device.id]) as any[]
      if (rows.length > 0) existing = rows[0]
    }

    if (existing) {
      // Update existing asset
      const newStatus = assignedUserId ? "assigned" : existing.status
      await pool.execute(
        `UPDATE assets SET name = ?, model = ?, manufacturer = ?, os_version = ?,
         serial_number = ?, intune_device_id = ?, compliance_status = ?,
         primary_user_email = ?, assigned_to_user_id = ?, status = ?, platform = ?
         WHERE id = ?`,
        [
          deviceName, device.model || null, device.manufacturer || null,
          device.osVersion || null, serial, device.id,
          device.complianceState || null, device.userPrincipalName || null,
          assignedUserId, newStatus, platform, existing.id
        ]
      )
      updated++
    } else {
      // Create new asset
      const tag = serial || `INT-${device.id.substring(0, 8)}`
      const status = assignedUserId ? "assigned" : "available"
      await pool.execute(
        `INSERT INTO assets (name, asset_tag, type, platform, status, model, manufacturer,
         serial_number, os_version, intune_device_id, compliance_status,
         primary_user_email, assigned_to_user_id)
         VALUES (?, ?, 'device', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceName, tag, platform, status, device.model || null,
          device.manufacturer || null, serial, device.osVersion || null,
          device.id, device.complianceState || null,
          device.userPrincipalName || null, assignedUserId
        ]
      )
      created++
    }
  }

  // Store sync result in settings
  const now = new Date().toISOString()
  const result = JSON.stringify({ created, updated, skipped, timestamp: now })

  await pool.execute(
    "INSERT INTO settings (key_name, value) VALUES ('intune_last_sync', ?) ON DUPLICATE KEY UPDATE value = ?",
    [now, now]
  )
  await pool.execute(
    "INSERT INTO settings (key_name, value) VALUES ('intune_last_result', ?) ON DUPLICATE KEY UPDATE value = ?",
    [result, result]
  )

  console.log(`[Intune Sync] Fertig: ${created} erstellt, ${updated} aktualisiert, ${skipped} übersprungen`)
  return { created, updated, skipped }
}
