import { query } from "@/lib/db"

/**
 * Generates a formatted number based on a pattern from settings.
 *
 * Pattern variables:
 *   {PREFIX}  — the prefix text (e.g. "IT", "INC", "ORD")
 *   {YEAR}    — 4-digit year (2026)
 *   {YY}      — 2-digit year (26)
 *   {NUM}     — sequential number (no padding)
 *   {NUM:4}   — sequential number, zero-padded to 4 digits
 *   {NUM:6}   — sequential number, zero-padded to 6 digits
 *
 * Default patterns:
 *   Tickets:  {PREFIX}-{YEAR}-{NUM:4}   → IT-2026-0037
 *   Orders:   {PREFIX}-{YEAR}-{NUM:4}   → ORD-2026-0012
 */

async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await query("SELECT value FROM settings WHERE key_name = ?", [key]) as any[]
    return rows[0]?.value || null
  } catch { return null }
}

function applyPattern(pattern: string, prefix: string, year: number, num: number): string {
  let result = pattern
  result = result.replace(/\{PREFIX\}/gi, prefix)
  result = result.replace(/\{YEAR\}/gi, String(year))
  result = result.replace(/\{YY\}/gi, String(year).slice(-2))
  result = result.replace(/\{NUM:(\d+)\}/gi, (_, digits) => String(num).padStart(parseInt(digits), "0"))
  result = result.replace(/\{NUM\}/gi, String(num))
  return result
}

export async function generateTicketNumber(year: number, sequentialNumber: number): Promise<string> {
  const pattern = await getSetting("ticket_number_pattern") || "{PREFIX}-{YEAR}-{NUM:4}"
  const prefix = await getSetting("ticket_number_prefix") || "IT"
  return applyPattern(pattern, prefix, year, sequentialNumber)
}

export async function generateOrderNumber(year: number, sequentialNumber: number): Promise<string> {
  const pattern = await getSetting("order_number_pattern") || "{PREFIX}-{YEAR}-{NUM:4}"
  const prefix = await getSetting("order_number_prefix") || "ORD"
  return applyPattern(pattern, prefix, year, sequentialNumber)
}
