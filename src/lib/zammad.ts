import { query, queryOne, pool } from "@/lib/db"

// ─── Settings ───

export interface ZammadSettings {
  zammad_url: string
  zammad_token: string
  zammad_enabled: string             // "true" | "false"
  zammad_interval: string            // minutes, default "15"
  zammad_import_states: string       // comma-separated state IDs to import, e.g. "1,2,3,8,9"
  zammad_sync_close: string          // "true" | "false" — sync close status back
  zammad_blacklist_subjects: string  // newline-separated subject patterns to ignore
  zammad_blacklist_senders: string   // newline-separated sender patterns to ignore
}

let cachedSettings: ZammadSettings | null = null
let cacheTime = 0

export async function getZammadSettings(): Promise<ZammadSettings> {
  if (cachedSettings && Date.now() - cacheTime < 30_000) return cachedSettings
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'zammad_%'") as any[]
  const s: any = {}
  rows.forEach(r => { s[r.key_name] = r.value })
  cachedSettings = s as ZammadSettings
  cacheTime = Date.now()
  return cachedSettings
}

export function invalidateZammadCache() {
  cachedSettings = null
}

// ─── API helpers ───

async function zammadFetch(path: string, options: RequestInit = {}) {
  const s = await getZammadSettings()
  if (!s.zammad_url || !s.zammad_token) throw new Error("Zammad nicht konfiguriert")

  let baseUrl = s.zammad_url.replace(/\/+$/, "")
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`
  }
  const url = `${baseUrl}/api/v1${path}`

  // Use Node.js https agent to skip certificate verification if needed
  const fetchOptions: any = {
    ...options,
    headers: {
      "Authorization": `Token token=${s.zammad_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  }

  // Node.js 18+ supports this to skip TLS verification
  if (typeof process !== "undefined") {
    fetchOptions.agent = new (await import("https")).Agent({ rejectUnauthorized: false })
  }

  let res: Response
  try {
    res = await fetch(url, fetchOptions)
  } catch (err: any) {
    // Retry via curl if fetch fails (e.g. undici doesn't support agent for TLS skip)
    try {
      const mod = await import("child_process")
      const method = (options.method || "GET").toUpperCase()
      const body = options.body ? String(options.body) : null
      const curlArgs = [
        "curl", "-sk",
        "-X", method,
        "-H", `Authorization: Token token=${s.zammad_token}`,
        "-H", "Content-Type: application/json",
        ...(body ? ["-d", body] : []),
        url,
      ]
      const result = mod.execSync(curlArgs.join(" "), { encoding: "utf-8", timeout: 30000 })
      return JSON.parse(result)
    } catch (curlErr: any) {
      throw new Error(`Zammad-Verbindung fehlgeschlagen: ${err.message}`)
    }
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Zammad API ${res.status}: ${err}`)
  }

  return res.json()
}

// ─── State mappings ───

const ZAMMAD_STATE_TO_HELPDESK: Record<number, string> = {
  1: "open",           // new
  2: "open",           // open
  3: "pending",        // pending reminder
  4: "closed",         // closed
  5: "closed",         // merged
  7: "pending",        // pending close
  8: "pending",        // externer DL
  9: "pending",        // warten auf Rückmeldung
}

const HELPDESK_STATE_TO_ZAMMAD: Record<string, number> = {
  "open": 2,
  "pending": 3,
  "in_progress": 2,
  "resolved": 4,
  "closed": 4,
}

// ─── Import new tickets from Zammad ───

function toMysqlDate(isoStr: string): string {
  if (!isoStr) return new Date().toISOString().slice(0, 19).replace("T", " ")
  return new Date(isoStr).toISOString().slice(0, 19).replace("T", " ")
}

export async function syncFromZammad(): Promise<{ imported: number; updated: number; errors: string[] }> {
  const s = await getZammadSettings()
  const activeStates = (s.zammad_import_states || "1,2,3,8,9").split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n))

  const errors: string[] = []
  let imported = 0
  let updated = 0
  let filtered = 0

  // Parse blacklists
  const subjectBlacklist = (s.zammad_blacklist_subjects || "").split("\n").map(l => l.trim().toLowerCase()).filter(Boolean)
  const senderBlacklist = (s.zammad_blacklist_senders || "").split("\n").map(l => l.trim().toLowerCase()).filter(Boolean)

  function isBlacklisted(title: string, senderEmail?: string): boolean {
    const titleLower = (title || "").toLowerCase()
    if (subjectBlacklist.some(pattern => titleLower.includes(pattern))) return true
    if (senderEmail && senderBlacklist.some(pattern => senderEmail.toLowerCase().includes(pattern))) return true
    return false
  }

  // Fetch all tickets page by page
  for (let page = 1; page <= 100; page++) {
    let tickets: any[]
    try {
      tickets = await zammadFetch(`/tickets?per_page=100&page=${page}`)
    } catch (err: any) {
      errors.push(`Seite ${page}: ${err.message}`)
      break
    }

    if (!tickets || tickets.length === 0) break

    for (const t of tickets) {
      if (!activeStates.includes(t.state_id)) continue

      const ticketNumber = "ZAM-" + t.number
      const status = ZAMMAD_STATE_TO_HELPDESK[t.state_id] || "open"
      const priority = t.priority_id === 3 ? "high" : t.priority_id === 1 ? "low" : "medium"

      try {
        // Check if already exists
        const existing = await queryOne<any>("SELECT id, status, zammad_id, updated_at FROM tickets WHERE ticket_number = ?", [ticketNumber])

        if (existing) {
          // Backfill zammad_id if missing
          if (!existing.zammad_id) {
            await query("UPDATE tickets SET zammad_id = ? WHERE id = ?", [t.id, existing.id])
          }
          // Only update local status from Zammad if the local ticket was NOT manually changed
          // Rule: If locally closed/resolved, never reopen from Zammad
          const localIsClosed = existing.status === "closed" || existing.status === "resolved"
          if (!localIsClosed && existing.status !== status) {
            await query("UPDATE tickets SET status = ? WHERE id = ?", [status, existing.id])
            updated++
          }

          // Sync new articles/comments from Zammad → HelpDesk
          try {
            await syncArticlesFromZammad(existing.id, t.id)
          } catch (err: any) {
            errors.push(`Artikel-Sync #${t.number}: ${err.message}`)
          }

          continue
        }

        // Get customer info
        let requesterId = 1
        let customerEmail = ""
        if (t.customer_id) {
          try {
            const customer = await zammadFetch(`/users/${t.customer_id}`)
            customerEmail = (customer.email || "").toLowerCase()
            if (customerEmail) {
              const existingUser = await queryOne<any>("SELECT id FROM users WHERE email = ?", [customerEmail])
              if (existingUser) {
                requesterId = existingUser.id
              } else {
                const name = `${customer.firstname || ""} ${customer.lastname || ""}`.trim() || customer.login || "Unbekannt"
                const bcrypt = await import("bcryptjs")
                const hash = await bcrypt.hash(crypto.randomUUID(), 10)
                const result = await query(
                  "INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, 'user', 1)",
                  [name, customerEmail, hash]
                ) as any
                requesterId = result.insertId
              }
            }
          } catch {}
        }

        // Check blacklist (title + sender)
        if (isBlacklisted(t.title, customerEmail)) {
          filtered++
          continue
        }

        // Get first article as description
        let description = t.title
        try {
          const articles = await zammadFetch(`/ticket_articles/by_ticket/${t.id}`)
          if (articles?.length > 0) {
            description = articles[0].body || t.title
          }
        } catch {}

        // Insert ticket (with zammad_id for back-sync)
        await query(
          "INSERT INTO tickets (ticket_number, title, description, priority, category, requester_id, status, zammad_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [ticketNumber, t.title, description, priority, "Zammad", requesterId, status, t.id, toMysqlDate(t.created_at)]
        )
        imported++
      } catch (err: any) {
        errors.push(`#${t.number}: ${err.message}`)
      }
    }
  }

  return { imported, updated, filtered, errors }
}

// ─── Sync articles from Zammad into HelpDesk comments ───

async function syncArticlesFromZammad(helpdeskTicketId: number, zammadTicketId: number): Promise<number> {
  let articles: any[]
  try {
    articles = await zammadFetch(`/ticket_articles/by_ticket/${zammadTicketId}`)
  } catch {
    return 0
  }

  if (!articles || articles.length === 0) return 0

  // Get existing comments to avoid duplicates — check for zammad_article_id marker
  const existingComments = await query<any>(
    "SELECT content FROM ticket_comments WHERE ticket_id = ?",
    [helpdeskTicketId]
  )
  const existingMarkers = new Set(
    existingComments
      .map((c: any) => {
        const match = (c.content || "").match(/data-zammad-article-id="(\d+)"/)
        return match ? parseInt(match[1]) : null
      })
      .filter(Boolean)
  )

  // Skip the first article (already used as ticket description on import)
  let synced = 0
  for (let i = 1; i < articles.length; i++) {
    const article = articles[i]

    // Skip if already imported
    if (existingMarkers.has(article.id)) continue

    // Skip internal articles unless they are from agents (system notifications etc.)
    // Import both customer and agent articles
    const senderType = article.sender || "Customer"
    const isInternal = !!article.internal

    // Skip empty articles
    const body = article.body || ""
    if (!body.trim()) continue

    // Determine who wrote it
    let authorName = "Zammad"
    if (article.created_by_id) {
      try {
        const user = await zammadFetch(`/users/${article.created_by_id}`)
        authorName = `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.login || "Zammad"
      } catch {}
    }

    const senderLabel = senderType === "Customer" ? "Kunde" : senderType === "Agent" ? "Agent" : senderType
    const prefix = `<p><strong>${senderLabel}: ${authorName}</strong></p>`
    // Hidden marker to prevent re-import
    const marker = `<span data-zammad-article-id="${article.id}" style="display:none"></span>`
    const content = `${marker}${prefix}${body}`

    const createdAt = article.created_at ? toMysqlDate(article.created_at) : null

    await query(
      "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system, created_at) VALUES (?, ?, ?, ?, 0, ?)",
      [helpdeskTicketId, null, content, isInternal ? 1 : 0, createdAt || new Date().toISOString().slice(0, 19).replace("T", " ")]
    )
    synced++
  }

  if (synced > 0) {
    console.log(`[Zammad Sync] ${synced} Artikel für Ticket #${helpdeskTicketId} importiert`)
  }

  return synced
}

// ─── Sync status back to Zammad ───

export async function syncStatusToZammad(ticketNumber: string, newStatus: string): Promise<boolean> {
  const s = await getZammadSettings()
  if (s.zammad_sync_close !== "true" || !s.zammad_url || !s.zammad_token) return false

  // Only sync ZAM- tickets
  if (!ticketNumber.startsWith("ZAM-")) return false

  const zammadStateId = HELPDESK_STATE_TO_ZAMMAD[newStatus]
  if (!zammadStateId) return false

  try {
    // Get zammad_id from our database
    const ticket = await queryOne<any>("SELECT zammad_id FROM tickets WHERE ticket_number = ?", [ticketNumber])
    if (!ticket?.zammad_id) {
      console.error(`[Zammad Sync] Keine zammad_id für ${ticketNumber}`)
      return false
    }

    // Update state directly via Zammad ticket ID
    await zammadFetch(`/tickets/${ticket.zammad_id}`, {
      method: "PUT",
      body: JSON.stringify({ state_id: zammadStateId }),
    })

    console.log(`[Zammad Sync] ${ticketNumber} (zammad_id=${ticket.zammad_id}) → state_id=${zammadStateId}`)
    return true
  } catch (err: any) {
    console.error(`[Zammad Sync] Status-Rücksync fehlgeschlagen für ${ticketNumber}:`, err.message)
    return false
  }
}

// ─── Sync comment/article to Zammad ───

export async function syncCommentToZammad(ticketNumber: string, body: string, isInternal: boolean, authorName: string): Promise<boolean> {
  const s = await getZammadSettings()
  if (!s.zammad_url || !s.zammad_token) return false
  if (!ticketNumber.startsWith("ZAM-")) return false

  try {
    const ticket = await queryOne<any>("SELECT zammad_id FROM tickets WHERE ticket_number = ?", [ticketNumber])
    if (!ticket?.zammad_id) return false

    await zammadFetch(`/ticket_articles`, {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticket.zammad_id,
        body: body,
        content_type: "text/html",
        type: "note",
        internal: isInternal,
        sender: "Agent",
        subject: `Kommentar von ${authorName}`,
      }),
    })

    console.log(`[Zammad Sync] Kommentar für ${ticketNumber} (zammad_id=${ticket.zammad_id}) übertragen`)
    return true
  } catch (err: any) {
    console.error(`[Zammad Sync] Kommentar-Sync fehlgeschlagen für ${ticketNumber}:`, err.message)
    return false
  }
}

// ─── Shared blacklist check (used by Zammad sync + Mail poller) ───

export async function isMailBlacklisted(subject: string, senderEmail?: string): Promise<boolean> {
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name IN ('zammad_blacklist_subjects', 'zammad_blacklist_senders')") as any[]
  const settings: Record<string, string> = {}
  rows.forEach(r => { settings[r.key_name] = r.value })

  const subjectPatterns = (settings.zammad_blacklist_subjects || "").split("\n").map(l => l.trim().toLowerCase()).filter(Boolean)
  const senderPatterns = (settings.zammad_blacklist_senders || "").split("\n").map(l => l.trim().toLowerCase()).filter(Boolean)

  const subjectLower = (subject || "").toLowerCase()
  if (subjectPatterns.some(p => subjectLower.includes(p))) return true
  if (senderEmail && senderPatterns.some(p => senderEmail.toLowerCase().includes(p))) return true
  return false
}

// ─── Connection test ───

export async function testConnection(): Promise<{ ok: boolean; version?: string; ticketCount?: number; error?: string }> {
  try {
    const s = await getZammadSettings()
    if (!s.zammad_url || !s.zammad_token) return { ok: false, error: "URL oder Token nicht konfiguriert" }

    // Test with a simple tickets request
    const tickets = await zammadFetch("/tickets?per_page=1&page=1")
    return { ok: true, ticketCount: Array.isArray(tickets) ? tickets.length : 0 }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
