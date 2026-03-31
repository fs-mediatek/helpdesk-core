import { query } from "@/lib/db"

interface ImapSettings {
  imap_enabled: string
  imap_host: string
  imap_port: string
  imap_user: string
  imap_pass: string
  imap_secure: string
  imap_mailbox: string
  imap_reject_unauthorized: string
  imap_auth_type: string  // "password" | "xoauth2"
}

let cachedSettings: ImapSettings | null = null
let cacheTime = 0

export async function getImapSettings(): Promise<ImapSettings> {
  if (cachedSettings && Date.now() - cacheTime < 60_000) return cachedSettings
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'imap_%'") as any[]
  const s: any = {}
  rows.forEach(r => { s[r.key_name] = r.value })
  cachedSettings = s as ImapSettings
  cacheTime = Date.now()
  return cachedSettings
}

export function invalidateImapCache() {
  cachedSettings = null
}

// ─── XOAUTH2 Token for IMAP ───

let imapOAuthToken: string | null = null
let imapOAuthExpiry = 0

async function getImapOAuthToken(): Promise<string> {
  if (imapOAuthToken && Date.now() < imapOAuthExpiry) return imapOAuthToken

  // Use the same MS365 credentials from settings
  const msRows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'ms_%'") as any[]
  const ms: Record<string, string> = {}
  msRows.forEach((r: any) => { ms[r.key_name] = r.value })

  if (!ms.ms_tenant_id || !ms.ms_client_id || !ms.ms_client_secret) {
    throw new Error("XOAUTH2 benötigt Microsoft 365 Konfiguration (Tenant-ID, Client-ID, Client-Secret)")
  }

  // Request token with IMAP scope (outlook.office365.com)
  const res = await fetch(`https://login.microsoftonline.com/${ms.ms_tenant_id}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ms.ms_client_id,
      client_secret: ms.ms_client_secret,
      scope: "https://outlook.office365.com/.default",
      grant_type: "client_credentials",
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OAuth2-Token für IMAP fehlgeschlagen: ${err.error_description || err.error || res.statusText}`)
  }

  const data = await res.json()
  imapOAuthToken = data.access_token
  imapOAuthExpiry = Date.now() + (data.expires_in - 60) * 1000
  return imapOAuthToken!
}

// ─── Build ImapFlow config ───

async function buildImapConfig(s: ImapSettings) {
  const { ImapFlow } = await import("imapflow")

  const config: any = {
    host: s.imap_host,
    port: parseInt(s.imap_port || "993"),
    secure: s.imap_secure !== "false",
    tls: {
      rejectUnauthorized: s.imap_reject_unauthorized !== "false",
    },
    logger: false,
  }

  if (s.imap_auth_type === "xoauth2") {
    const accessToken = await getImapOAuthToken()
    config.auth = {
      user: s.imap_user,
      accessToken,
    }
  } else {
    config.auth = {
      user: s.imap_user,
      pass: s.imap_pass,
    }
  }

  return { ImapFlow, config }
}

// ─── Fetch unread mails ───

interface ParsedMail {
  id: string
  from: { name: string; address: string }
  subject: string
  html: string
  text: string
  date: Date
}

export async function fetchUnreadImapMails(maxCount = 10): Promise<ParsedMail[]> {
  const s = await getImapSettings()
  if (!s.imap_host) throw new Error("IMAP Host nicht konfiguriert")

  const { ImapFlow, config } = await buildImapConfig(s)
  const client = new ImapFlow(config)

  const mails: ParsedMail[] = []

  try {
    await client.connect()
    const mailbox = s.imap_mailbox || "INBOX"
    const lock = await client.getMailboxLock(mailbox)

    try {
      const messages = client.fetch({ seen: false }, {
        uid: true,
        envelope: true,
        source: true,
      }, { changedSince: BigInt(0) })

      let count = 0
      for await (const msg of messages) {
        if (count >= maxCount) break

        const envelope = msg.envelope
        const fromAddr = envelope.from?.[0]
        const source = msg.source?.toString() || ""

        // Extract HTML body from raw source
        let html = ""
        let text = ""

        // Simple MIME parsing for HTML content
        const htmlMatch = source.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i)
        const textMatch = source.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i)

        if (htmlMatch) {
          html = htmlMatch[1]
          // Handle quoted-printable
          if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(source)) {
            html = html.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          }
          // Handle base64
          if (/Content-Transfer-Encoding:\s*base64/i.test(source.substring(0, source.indexOf(html)))) {
            try { html = Buffer.from(html.replace(/\s/g, ""), "base64").toString("utf-8") } catch {}
          }
        }
        if (textMatch) {
          text = textMatch[1]
          if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(source)) {
            text = text.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          }
        }

        if (!html && text) {
          html = `<p>${text.replace(/\n/g, "<br/>")}</p>`
        }

        mails.push({
          id: String(msg.uid),
          from: {
            name: fromAddr?.name || fromAddr?.address?.split("@")[0] || "",
            address: fromAddr?.address || "",
          },
          subject: envelope.subject || "(Kein Betreff)",
          html,
          text,
          date: envelope.date || new Date(),
        })
        count++
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err: any) {
    try { await client.logout() } catch {}
    throw err
  }

  return mails
}

// ─── Mark mail as read ───

export async function markImapMailAsRead(uid: string): Promise<void> {
  const s = await getImapSettings()
  const { ImapFlow, config } = await buildImapConfig(s)
  const client = new ImapFlow(config)

  try {
    await client.connect()
    const mailbox = s.imap_mailbox || "INBOX"
    const lock = await client.getMailboxLock(mailbox)
    try {
      await client.messageFlagsAdd({ uid: parseInt(uid) }, ["\\Seen"], { uid: true })
    } finally {
      lock.release()
    }
    await client.logout()
  } catch {
    try { await client.logout() } catch {}
  }
}
