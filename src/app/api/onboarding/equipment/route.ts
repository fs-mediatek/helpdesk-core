import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS onboarding_equipment_presets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    match_department VARCHAR(100) DEFAULT NULL,
    match_job_title VARCHAR(200) DEFAULT NULL,
    product_ids TEXT NOT NULL,
    is_default TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 100,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})
}

// GET presets, optionally filtered by department+job_title for suggestions
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()

  const department = new URL(req.url).searchParams.get("department") || ""
  const jobTitle = new URL(req.url).searchParams.get("job_title") || ""
  const all = new URL(req.url).searchParams.get("all") === "1"

  const presets = await query(
    "SELECT * FROM onboarding_equipment_presets WHERE active = 1 ORDER BY sort_order ASC, name ASC"
  ) as any[]

  if (all) return NextResponse.json(presets)

  // Find best matching preset: specific match > default
  let best: any = null
  let bestScore = -1

  for (const p of presets) {
    let score = 0
    let matches = true
    if (p.match_department) {
      if (department && department.toLowerCase() === p.match_department.toLowerCase()) score += 2
      else matches = false
    }
    if (p.match_job_title) {
      if (jobTitle && jobTitle.toLowerCase() === p.match_job_title.toLowerCase()) score += 1
      else matches = false
    }
    if (matches && score > bestScore) { best = p; bestScore = score }
    if (matches && score === 0 && p.is_default && !best) { best = p; bestScore = 0 }
  }

  // Load product details for the matched preset
  if (best && best.product_ids) {
    const ids = JSON.parse(best.product_ids) as number[]
    if (ids.length > 0) {
      const products = await query(
        `SELECT id, name, emoji, image_url, category_id FROM order_products WHERE id IN (${ids.map(() => "?").join(",")}) AND (active = 1 OR active IS NULL)`,
        ids
      )
      return NextResponse.json({ preset: best, products })
    }
  }

  return NextResponse.json({ preset: best, products: [] })
}

// POST — create or update preset
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()
  const { name, match_department, match_job_title, product_ids, is_default } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const [result] = await pool.execute(
    "INSERT INTO onboarding_equipment_presets (name, match_department, match_job_title, product_ids, is_default) VALUES (?,?,?,?,?)",
    [name.trim(), match_department || null, match_job_title || null, JSON.stringify(product_ids || []), is_default ? 1 : 0]
  ) as any
  return NextResponse.json({ id: result.insertId }, { status: 201 })
}

// PUT — update preset
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id, name, match_department, match_job_title, product_ids, is_default } = await req.json()
  await query(
    "UPDATE onboarding_equipment_presets SET name=?, match_department=?, match_job_title=?, product_ids=?, is_default=? WHERE id=?",
    [name?.trim(), match_department || null, match_job_title || null, JSON.stringify(product_ids || []), is_default ? 1 : 0, id]
  )
  return NextResponse.json({ success: true })
}

// DELETE
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await req.json()
  await query("UPDATE onboarding_equipment_presets SET active = 0 WHERE id = ?", [id])
  return NextResponse.json({ success: true })
}
