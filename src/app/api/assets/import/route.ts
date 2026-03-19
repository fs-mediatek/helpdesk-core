import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { query, pool } from "@/lib/db"

// ─── Samsung / Xiaomi / Lenovo model resolver ───
const MODEL_MAP: Record<string, string> = {
  // Samsung Galaxy A series
  "SM-A145R": "Galaxy A14", "SM-A155F": "Galaxy A15", "SM-A156B": "Galaxy A15 5G",
  "SM-A165F": "Galaxy A16", "SM-A166B": "Galaxy A16 5G", "SM-A176B": "Galaxy A17",
  "SM-A226B": "Galaxy A22 5G", "SM-A346B": "Galaxy A34",
  "SM-A505FN": "Galaxy A50", "SM-A515F": "Galaxy A51",
  "SM-A525F": "Galaxy A52", "SM-A526B": "Galaxy A52 5G",
  "SM-A536B": "Galaxy A53 5G", "SM-A546B": "Galaxy A54 5G", "SM-A556B": "Galaxy A55 5G",
  // Samsung Galaxy S series
  "SM-G556B": "Galaxy XCover7",
  "SM-S711B": "Galaxy S23 FE",
  "SM-S901B": "Galaxy S22", "SM-S906B": "Galaxy S22+", "SM-S908B": "Galaxy S22 Ultra",
  "SM-S911B": "Galaxy S23", "SM-S916B": "Galaxy S23+", "SM-S918B": "Galaxy S23 Ultra",
  "SM-S921B": "Galaxy S24", "SM-S926B": "Galaxy S24+", "SM-S928B": "Galaxy S24 Ultra",
  "SM-S931B": "Galaxy S25", "SM-S936B": "Galaxy S25+", "SM-S938B": "Galaxy S25 Ultra",
  // Xiaomi
  "22041219NY": "Redmi Note 11S", "2201116SG": "Redmi Note 11",
  "22011119UY": "Redmi 10", "M2010J19SY": "Poco X3 NFC",
  "23129RN51X": "Redmi Note 13",
  // Lenovo tablets
  "TB311FU": "Tab M11", "TB330FU": "Tab M10 Plus (3rd Gen)",
}

function resolveModelName(manufacturer: string | null, model: string | null): string {
  if (!model) return manufacturer || "Unbekannt"
  const friendly = MODEL_MAP[model]
  if (friendly) {
    const brand = manufacturer?.toLowerCase() === "samsung" ? "Samsung" :
                  manufacturer?.toLowerCase() === "xiaomi" ? "Xiaomi" :
                  manufacturer?.toLowerCase() === "lenovo" ? "Lenovo" :
                  manufacturer || ""
    return `${brand} ${friendly}`.trim()
  }
  return `${manufacturer || ""} ${model}`.trim()
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s/\-()]/g, "")
  // Convert international to national: +49 → 0, 0049 → 0
  if (p.startsWith("+49")) p = "0" + p.slice(3)
  if (p.startsWith("0049")) p = "0" + p.slice(4)
  return p
}

async function ensureExtraColumns() {
  const cols: [string, string][] = [
    ["manufacturer", "VARCHAR(100) DEFAULT NULL"],
    ["purchase_price", "DECIMAL(10,2) DEFAULT NULL"],
    ["commissioned_at", "DATE DEFAULT NULL"],
    ["primary_user_email", "VARCHAR(255) DEFAULT NULL"],
    ["os_version", "VARCHAR(100) DEFAULT NULL"],
    ["intune_device_id", "VARCHAR(100) DEFAULT NULL"],
    ["phone_number", "VARCHAR(30) DEFAULT NULL"],
    ["imei", "VARCHAR(20) DEFAULT NULL"],
    ["friendly_name", "VARCHAR(255) DEFAULT NULL"],
  ]
  for (const [col, def] of cols) {
    await pool.execute(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
    await pool.execute(`ALTER TABLE assets ADD COLUMN ${col} ${def}`).catch(() => {})
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
    if (!roles.some(r => ["admin", "agent"].includes(r)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureExtraColumns()

    const body = await req.json()
    const rows = body?.rows as Record<string, string>[]
    const importPlatform = body?.platform as string || "windows"
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "Keine Zeilen übergeben" }, { status: 400 })

    const isAndroid = importPlatform === "android"

    let imported = 0, updated = 0
    const userMatches: { deviceName: string; userName: string; email: string }[] = []
    const phoneMatches: { deviceName: string; phone: string; contractUser: string }[] = []

    for (const row of rows) {
      const intuneId = row["Device ID"]?.trim() || null
      const serialNumber = row["Serial number"]?.trim() || null
      const rawDeviceName = row["Device name"]?.trim() || null
      const model = row["Model"]?.trim() || null
      const manufacturer = row["Manufacturer"]?.trim() || null
      const osVersion = row["OS version"]?.trim() || null
      const primaryEmail = row["Primary user email address"]?.trim() || null
      const primaryDisplayName = row["Primary user display name"]?.trim() || null
      const enrollmentDateRaw = row["Enrollment date"]?.trim() || null
      const phoneRaw = row["Phone number"]?.trim() || null
      const imei = row["IMEI"]?.trim() || null

      if (!rawDeviceName && !serialNumber) continue

      // ─── Build device name ───
      let deviceName: string
      if (isAndroid) {
        // Android: "Samsung Galaxy A14 — Funk, Tanja"
        const friendlyModel = resolveModelName(manufacturer, model)
        if (primaryDisplayName) {
          const parts = primaryDisplayName.split(" ")
          const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
          const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : ""
          deviceName = `${friendlyModel} — ${lastName}${firstName ? ", " + firstName : ""}`
        } else {
          deviceName = friendlyModel
        }
      } else {
        deviceName = rawDeviceName || serialNumber || "Unbekannt"
      }

      // Parse enrollment date
      let commissionedAt: string | null = null
      if (enrollmentDateRaw && !enrollmentDateRaw.startsWith("0001-01-01")) {
        const datePart = enrollmentDateRaw.split(" ")[0]
        if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          commissionedAt = datePart
        }
      }

      // Normalize phone number
      const phone = phoneRaw ? normalizePhone(phoneRaw) : null

      // Check for existing asset
      let existingId: number | null = null
      if (intuneId) {
        const found = await query("SELECT id FROM assets WHERE intune_device_id = ?", [intuneId]) as any[]
        if (found[0]) existingId = found[0].id
      }
      if (!existingId && serialNumber) {
        const found = await query("SELECT id FROM assets WHERE serial_number = ? AND serial_number != ''", [serialNumber]) as any[]
        if (found[0]) existingId = found[0].id
      }

      // Match user by email
      let matchedUserId: number | null = null
      if (primaryEmail) {
        const users = await query("SELECT id, name FROM users WHERE email = ? AND active = 1", [primaryEmail]) as any[]
        if (users[0]) {
          matchedUserId = users[0].id
          userMatches.push({ deviceName, userName: users[0].name, email: primaryEmail })
        }
      }

      // Match phone number to mobile contract
      if (isAndroid && phone) {
        try {
          const contracts = await query(
            "SELECT phone_number, active_user FROM mobile_contracts WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone_number,' ',''),'/',''),'-',''),'+49','0') = ? AND status = 'Aktiv'",
            [phone]
          ) as any[]
          if (contracts[0]) {
            phoneMatches.push({ deviceName, phone: contracts[0].phone_number, contractUser: contracts[0].active_user || "" })
          }
        } catch { /* mobile_contracts table might not exist */ }
      }

      const platform = isAndroid ? "android" : "windows"
      const deviceType = isAndroid ? "phone" : "laptop"
      const friendlyModel = isAndroid ? resolveModelName(manufacturer, model) : null

      if (existingId) {
        const updateFields = [
          "name=?", "model=?", "manufacturer=?", "os_version=?",
          "serial_number=?", "intune_device_id=?", "primary_user_email=?",
          `platform='${platform}'`
        ]
        const updateParams: any[] = [deviceName, model, manufacturer, osVersion, serialNumber, intuneId, primaryEmail]

        if (friendlyModel) {
          updateFields.push("friendly_name=?")
          updateParams.push(friendlyModel)
        }
        if (phone) {
          updateFields.push("phone_number=?")
          updateParams.push(phone)
        }
        if (imei) {
          updateFields.push("imei=?")
          updateParams.push(imei)
        }
        if (commissionedAt) {
          updateFields.push("commissioned_at=IFNULL(commissioned_at,?)")
          updateParams.push(commissionedAt)
        }
        if (matchedUserId) {
          updateFields.push("assigned_to_user_id=IFNULL(assigned_to_user_id,?)")
          updateParams.push(matchedUserId)
        }

        updateParams.push(existingId)
        await query(`UPDATE assets SET ${updateFields.join(", ")} WHERE id=?`, updateParams)
        updated++
      } else {
        const tag = serialNumber || `${platform.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        await pool.execute(
          `INSERT INTO assets (asset_tag, name, type, model, manufacturer, os_version, serial_number, intune_device_id,
           primary_user_email, commissioned_at, platform, status, assigned_to_user_id, friendly_name, phone_number, imei)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [tag, deviceName, deviceType, model, manufacturer, osVersion, serialNumber, intuneId,
           primaryEmail, commissionedAt, platform, "available", matchedUserId,
           friendlyModel, phone, imei]
        )
        imported++
      }
    }

    return NextResponse.json({ imported, updated, userMatches, phoneMatches, total: rows.length })
  } catch (err: any) {
    console.error("[CSV Import Error]", err)
    return NextResponse.json({ error: err?.message || "Import fehlgeschlagen" }, { status: 500 })
  }
}
