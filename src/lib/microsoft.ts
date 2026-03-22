import { query, queryOne } from "@/lib/db"

// ─── Settings helpers ───

export interface MicrosoftSettings {
  ms_tenant_id: string
  ms_client_id: string
  ms_client_secret: string
  ms_mailbox: string        // e.g. servicedesk@firma.de
  ms_mail_enabled: string   // "true" | "false"
  ms_login_enabled: string  // "true" | "false"
}

let cachedSettings: MicrosoftSettings | null = null
let cacheTime = 0

export async function getMicrosoftSettings(): Promise<MicrosoftSettings> {
  if (cachedSettings && Date.now() - cacheTime < 60_000) return cachedSettings
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'ms_%'") as any[]
  const s: any = {}
  rows.forEach(r => { s[r.key_name] = r.value })
  cachedSettings = s as MicrosoftSettings
  cacheTime = Date.now()
  return cachedSettings
}

export function invalidateMicrosoftCache() {
  cachedSettings = null
}

// ─── OAuth2 Token (Client Credentials) ───

interface TokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

let appToken: string | null = null
let appTokenExpiry = 0

export async function getAppAccessToken(): Promise<string> {
  if (appToken && Date.now() < appTokenExpiry) return appToken

  const s = await getMicrosoftSettings()
  if (!s.ms_tenant_id || !s.ms_client_id || !s.ms_client_secret) {
    throw new Error("Microsoft 365 ist nicht konfiguriert (Tenant-ID, Client-ID oder Client-Secret fehlt)")
  }

  const res = await fetch(`https://login.microsoftonline.com/${s.ms_tenant_id}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.ms_client_id,
      client_secret: s.ms_client_secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Microsoft Token-Fehler: ${err.error_description || err.error || res.statusText}`)
  }

  const data: TokenResponse = await res.json()
  appToken = data.access_token
  appTokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return appToken
}

// ─── OAuth2 Login (Authorization Code Flow) ───

export function getLoginUrl(redirectUri: string, state: string): string {
  // This is called at request time, settings must be passed or fetched synchronously
  // We use a sync wrapper that throws if not cached
  const s = cachedSettings
  if (!s?.ms_client_id || !s?.ms_tenant_id) {
    throw new Error("Microsoft Login nicht konfiguriert")
  }

  const params = new URLSearchParams({
    client_id: s.ms_client_id,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "openid profile email User.Read",
    response_mode: "query",
    state,
  })

  return `https://login.microsoftonline.com/${s.ms_tenant_id}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const s = await getMicrosoftSettings()

  const res = await fetch(`https://login.microsoftonline.com/${s.ms_tenant_id}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.ms_client_id,
      client_secret: s.ms_client_secret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: "openid profile email User.Read",
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Token-Austausch fehlgeschlagen: ${err.error_description || err.error || res.statusText}`)
  }

  return res.json()
}

export async function getMicrosoftUserProfile(accessToken: string) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error("Microsoft-Profil konnte nicht geladen werden")
  return res.json()
}

// ─── Graph API: Mail ───

interface GraphMessage {
  id: string
  subject: string
  bodyPreview: string
  body: { contentType: string; content: string }
  from: { emailAddress: { name: string; address: string } }
  receivedDateTime: string
  isRead: boolean
  conversationId: string
}

export async function fetchUnreadMails(mailbox: string, top = 20): Promise<GraphMessage[]> {
  const token = await getAppAccessToken()

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?$filter=isRead eq false&$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead,conversationId`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Mail-Abruf fehlgeschlagen: ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return data.value || []
}

export async function markMailAsRead(mailbox: string, messageId: string): Promise<void> {
  const token = await getAppAccessToken()

  await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    }
  )
}

export async function sendMailViaGraph(mailbox: string, to: string, subject: string, htmlBody: string): Promise<void> {
  const token = await getAppAccessToken()

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    }
  )

  if (!res.ok && res.status !== 202) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Mail-Versand fehlgeschlagen: ${err.error?.message || res.statusText}`)
  }
}
