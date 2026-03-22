import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

const DEFAULT_PROMPT = `Du bist ein erfahrener IT-Support-Analyst. Analysiere das folgende Support-Ticket und erstelle eine strukturierte Analyse auf Deutsch.

Antworte IMMER in diesem exakten JSON-Format:
{
  "summary": "Kurze Zusammenfassung in 1-2 Sätzen",
  "category": "Hardware | Software | Netzwerk | Zugriff | E-Mail | Telefonie | Sonstiges",
  "priority": "low | medium | high | critical",
  "priority_reason": "Begründung für die Priorität",
  "analysis": "Detaillierte Analyse als Fließtext (Markdown erlaubt)",
  "checklist": [
    "Erster konkreter Schritt den der Agent tun sollte",
    "Zweiter Schritt",
    "Dritter Schritt"
  ]
}

Die Checkliste soll 3-7 konkrete, umsetzbare Schritte enthalten.
Wenn KB-Artikel als Kontext mitgegeben werden, beziehe dich darauf.
Antworte NUR mit dem JSON-Objekt, kein Text davor oder danach.`

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdmin = session.role.includes("admin") || session.role.includes("agent")
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { ticket_id } = await req.json()
  if (!ticket_id) return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })

  // Get settings
  const settingsRows = await query("SELECT key_name, value FROM settings WHERE key_name LIKE 'claude_%'") as any[]
  const s: Record<string, string> = {}
  settingsRows.forEach((r: any) => { s[r.key_name] = r.value })

  if (s.claude_enabled !== "true") return NextResponse.json({ error: "Claude-Analyse ist nicht aktiviert" }, { status: 400 })
  if (!s.claude_api_key) return NextResponse.json({ error: "API-Key nicht konfiguriert" }, { status: 400 })

  // Get ticket with comments
  const ticket = await query(`
    SELECT t.*, u.name as requester_name, u.email as requester_email
    FROM tickets t LEFT JOIN users u ON t.requester_id = u.id
    WHERE t.id = ?
  `, [ticket_id]) as any[]

  if (!ticket.length) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  const t = ticket[0]

  const comments = await query(`
    SELECT c.content, c.is_internal, c.is_system, c.created_at, u.name as author_name
    FROM ticket_comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = ? ORDER BY c.created_at ASC
  `, [ticket_id]) as any[]

  // Get relevant KB articles for context
  let kbContext = ""
  try {
    const titleWords = t.title.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3).slice(0, 5)
    if (titleWords.length > 0) {
      const conditions = titleWords.map(() => "(title LIKE ? OR tags LIKE ?)").join(" OR ")
      const params = titleWords.flatMap((w: string) => [`%${w}%`, `%${w}%`])
      const kbArticles = await query(
        `SELECT title, content_html, tags FROM kb_articles WHERE status = 'published' AND (${conditions}) LIMIT 3`,
        params
      ) as any[]
      if (kbArticles.length > 0) {
        kbContext = "\n\n--- KB-ARTIKEL ALS KONTEXT ---\n" +
          kbArticles.map((a: any) => `### ${a.title}\n${a.content_html?.replace(/<[^>]*>/g, "").slice(0, 500) || ""}`).join("\n\n")
      }
    }
  } catch {}

  // Strip HTML from description and comments
  const stripHtml = (html: string) => (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()

  // Build the ticket context
  const ticketContext = `
TICKET #${t.ticket_number}
Titel: ${t.title}
Status: ${t.status}
Priorität: ${t.priority}
Kategorie: ${t.category || "Keine"}
Ersteller: ${t.requester_name || "Unbekannt"} (${t.requester_email || ""})
Erstellt: ${t.created_at}

BESCHREIBUNG:
${stripHtml(t.description)}

${comments.length > 0 ? "BISHERIGE KOMMENTARE:\n" + comments.map((c: any) =>
  `[${c.created_at}] ${c.author_name || "System"}${c.is_internal ? " (intern)" : ""}: ${stripHtml(c.content)}`
).join("\n") : "Keine Kommentare vorhanden."}
${kbContext}`

  try {
    const model = s.claude_model || "claude-sonnet-4-20250514"
    const systemPrompt = s.claude_system_prompt || DEFAULT_PROMPT

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": s.claude_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: ticketContext }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `Claude API: ${err.error?.message || res.statusText}` }, { status: 500 })
    }

    const data = await res.json()
    const rawText = data.content?.[0]?.text || "{}"

    // Parse JSON response from Claude
    let parsed: any
    try {
      // Extract JSON from response (in case there's text around it)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    } catch {
      // Fallback: treat as plain text analysis
      parsed = { summary: rawText, checklist: [], analysis: rawText, category: "", priority: "", priority_reason: "" }
    }

    const { summary, category, priority: suggestedPriority, priority_reason, analysis, checklist } = parsed

    // Build formatted HTML comment
    const htmlParts: string[] = []
    if (summary) htmlParts.push(`<p><strong>Zusammenfassung:</strong> ${summary}</p>`)
    if (category) htmlParts.push(`<p><strong>Kategorie:</strong> ${category}</p>`)
    if (suggestedPriority) htmlParts.push(`<p><strong>Priorität:</strong> ${suggestedPriority}${priority_reason ? ` — ${priority_reason}` : ""}</p>`)
    if (analysis) {
      const formattedAnalysis = analysis
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br>")
      htmlParts.push(`<p><strong>Analyse:</strong><br>${formattedAnalysis}</p>`)
    }

    const htmlComment = htmlParts.join("")

    // Find or get Claude user ID
    let claudeUserId = session.userId
    try {
      const claudeUser = await query("SELECT id FROM users WHERE role LIKE '%claude%' LIMIT 1") as any[]
      if (claudeUser.length > 0) claudeUserId = claudeUser[0].id
    } catch {}

    // Post analysis as internal comment
    if (htmlComment) {
      await pool.execute(
        "INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal, is_system) VALUES (?, ?, ?, 1, 0)",
        [ticket_id, claudeUserId, htmlComment]
      )
    }

    // Save checklist items
    if (Array.isArray(checklist) && checklist.length > 0) {
      await pool.execute(`CREATE TABLE IF NOT EXISTS ticket_checklist (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT UNSIGNED NOT NULL,
        content VARCHAR(500) NOT NULL,
        is_done TINYINT(1) DEFAULT 0,
        done_by VARCHAR(100) DEFAULT NULL,
        done_at TIMESTAMP NULL DEFAULT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket (ticket_id)
      )`).catch(() => {})

      for (let i = 0; i < checklist.length; i++) {
        if (checklist[i]?.trim()) {
          await pool.execute(
            "INSERT INTO ticket_checklist (ticket_id, content, sort_order) VALUES (?, ?, ?)",
            [ticket_id, checklist[i].trim(), i + 1]
          )
        }
      }
    }

    return NextResponse.json({ success: true, summary, category, suggestedPriority, checklistCount: checklist?.length || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
