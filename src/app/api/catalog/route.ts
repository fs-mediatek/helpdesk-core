import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

const DEFAULT_PRODUCTS = [
  { name: "Notebook", emoji: "💻", description: "Laptop für Büro & Homeoffice", sort_order: 1, requires_description: 0 },
  { name: "Monitor", emoji: "🖥️", description: "Externer Bildschirm", sort_order: 2, requires_description: 0 },
  { name: "Dockingstation", emoji: "🔌", description: "USB-C / Thunderbolt Dock", sort_order: 3, requires_description: 0 },
  { name: "Maus", emoji: "🖱️", description: "Kabellose oder kabelgebundene Maus", sort_order: 4, requires_description: 0 },
  { name: "Tastatur", emoji: "⌨️", description: "Externe Tastatur", sort_order: 5, requires_description: 0 },
  { name: "Headset", emoji: "🎧", description: "Headset für Videokonferenzen", sort_order: 6, requires_description: 0 },
  { name: "Webcam", emoji: "📷", description: "HD-Webcam für Meetings", sort_order: 7, requires_description: 0 },
  { name: "Smartphone", emoji: "📱", description: "Diensthandy", sort_order: 8, requires_description: 0 },
  { name: "Drucker", emoji: "🖨️", description: "Tintenstrahldrucker oder Laserdrucker", sort_order: 9, requires_description: 0 },
  { name: "Sonstiges", emoji: "📦", description: "Sonstiger IT-Bedarf — bitte genau beschreiben", sort_order: 10, requires_description: 1 },
]

async function ensureCols() {
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN emoji VARCHAR(20) DEFAULT '📦'") } catch {}
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN sort_order INT DEFAULT 0") } catch {}
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN requires_description TINYINT(1) NOT NULL DEFAULT 0") } catch {}
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN category_id INT UNSIGNED DEFAULT NULL") } catch {}
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN inventory_item_id INT UNSIGNED DEFAULT NULL") } catch {}
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN supplier_id INT UNSIGNED DEFAULT NULL") } catch {}
  try { await pool.execute("ALTER TABLE catalog ADD COLUMN price_estimate DECIMAL(10,2) DEFAULT NULL") } catch {}

  const existing = await query("SELECT COUNT(*) as cnt FROM catalog") as any[]
  if ((existing[0]?.cnt ?? 0) === 0) {
    for (const p of DEFAULT_PRODUCTS) {
      await pool.execute(
        "INSERT INTO catalog (name, description, emoji, sort_order, requires_description) VALUES (?,?,?,?,?)",
        [p.name, p.description, p.emoji, p.sort_order, p.requires_description]
      )
    }
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureCols()
  const products = await query(
    `SELECT p.*, c.name as category_name, c.color as category_color,
            s.name as supplier_name
     FROM catalog p
     LEFT JOIN order_categories c ON p.category_id = c.id
     LEFT JOIN suppliers s ON p.supplier_id = s.id
     WHERE p.active = 1 ORDER BY p.sort_order, p.name`
  )
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureCols()
  const { name, description, category_id, inventory_item_id, supplier_id, emoji, price_estimate, sort_order, requires_description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const [result] = await pool.execute(
    "INSERT INTO catalog (name, description, category_id, inventory_item_id, supplier_id, emoji, price_estimate, sort_order, requires_description) VALUES (?,?,?,?,?,?,?,?,?)",
    [name.trim(), description || null, category_id || null, inventory_item_id || null, supplier_id || null, emoji || "📦", price_estimate || null, sort_order ?? 0, requires_description ? 1 : 0]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}
