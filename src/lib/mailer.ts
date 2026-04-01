import nodemailer from "nodemailer"
import { query } from "@/lib/db"

interface MailSettings {
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_pass: string
  smtp_from: string
  smtp_secure: string
  smtp_reject_unauthorized: string
}

let cachedSettings: MailSettings | null = null
let cacheTime = 0

async function getMailSettings(): Promise<MailSettings> {
  if (cachedSettings && Date.now() - cacheTime < 60_000) return cachedSettings
  const rows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'smtp_%'") as any[]
  const s: any = {}
  rows.forEach(r => { s[r.key_name] = r.value })
  cachedSettings = s as MailSettings
  cacheTime = Date.now()
  return cachedSettings
}

export function invalidateMailCache() {
  cachedSettings = null
}

export async function createTransport() {
  const s = await getMailSettings()
  if (!s.smtp_host) throw new Error("SMTP Host nicht konfiguriert")

  const port = parseInt(s.smtp_port || "25")
  const secure = s.smtp_secure === "ssl" // true for port 465
  const useTls = s.smtp_secure === "starttls"

  const options: any = {
    host: s.smtp_host,
    port,
    secure,
    tls: {
      rejectUnauthorized: s.smtp_reject_unauthorized !== "false",
    },
  }

  // STARTTLS: not "secure" but upgrade via STARTTLS
  if (useTls) {
    options.secure = false
    options.requireTLS = true
  }

  // No encryption: no TLS at all (internal gateway)
  if (s.smtp_secure === "none" || !s.smtp_secure) {
    options.secure = false
    options.ignoreTLS = true
    options.tls = { rejectUnauthorized: false }
  }

  // Auth only if credentials provided
  if (s.smtp_user && s.smtp_pass) {
    options.auth = {
      user: s.smtp_user,
      pass: s.smtp_pass,
    }
  }

  return { transport: nodemailer.createTransport(options), from: s.smtp_from || `helpdesk@localhost` }
}

export async function sendMail(to: string, subject: string, html: string, options?: { cc?: string; bcc?: string }) {
  const { transport, from } = await createTransport()
  return transport.sendMail({ from, to, subject, html, cc: options?.cc, bcc: options?.bcc })
}
