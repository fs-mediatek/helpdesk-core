import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"
import { getEffectiveRoles } from "@/lib/effective-roles"

async function ensureTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS departments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT UNSIGNED DEFAULT NULL,
    sort_order INT NOT NULL DEFAULT 100,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => {})
  await pool.execute("ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id INT UNSIGNED DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE departments ADD COLUMN parent_id INT UNSIGNED DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE departments ADD COLUMN IF NOT EXISTS default_roles VARCHAR(500) DEFAULT NULL").catch(() => {})
  await pool.execute("ALTER TABLE departments ADD COLUMN default_roles VARCHAR(500) DEFAULT NULL").catch(() => {})
}

// Build a tree structure from flat rows
function buildTree(rows: any[]): any[] {
  const map: Record<number, any> = {}
  const roots: any[] = []
  for (const r of rows) {
    map[r.id] = { ...r, children: [] }
  }
  for (const r of rows) {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id])
    } else {
      roots.push(map[r.id])
    }
  }
  return roots
}

// Build flat list with display_name "Parent > Child" for dropdowns
function flattenWithPath(tree: any[], prefix = ""): any[] {
  const result: any[] = []
  for (const node of tree) {
    const displayName = prefix ? `${prefix} > ${node.name}` : node.name
    result.push({ id: node.id, name: node.name, display_name: displayName, parent_id: node.parent_id, default_roles: node.default_roles || null, depth: prefix ? prefix.split(" > ").length : 0 })
    if (node.children?.length > 0) {
      result.push(...flattenWithPath(node.children, displayName))
    }
  }
  return result
}

// Collect a node and all its descendants from a tree
function collectSubtree(nodes: any[], targetName: string): any[] {
  for (const node of nodes) {
    if (node.name === targetName) return [node]
    if (node.children?.length) {
      const found = collectSubtree(node.children, targetName)
      if (found.length) return found
    }
  }
  return []
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensureTable()
  const format = new URL(req.url).searchParams.get("format")
  const rows = await query("SELECT id, name, parent_id, sort_order, active, default_roles FROM departments WHERE active = 1 ORDER BY sort_order ASC, name ASC")
  let tree = buildTree(rows as any[])

  // Führungskraft: only own department + sub-departments
  const effectiveRole = await getEffectiveRoles(session.userId)
  const roles = effectiveRole.split(",").map((r: string) => r.trim())
  const isAdmin = roles.includes("admin")
  const isFk = roles.includes("fuehrungskraft") && !isAdmin

  if (isFk) {
    const [user] = await query("SELECT department FROM users WHERE id = ?", [session.userId]) as any[]
    if (user?.department) {
      const subtree = collectSubtree(tree, user.department)
      if (subtree.length > 0) tree = subtree
    }
  }

  if (format === "tree") {
    return NextResponse.json(tree)
  }
  return NextResponse.json(flattenWithPath(tree))
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  await ensureTable()
  const { name, parent_id } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })
  const maxOrder = await query("SELECT MAX(sort_order) as m FROM departments") as any[]
  const [result] = await pool.execute(
    "INSERT INTO departments (name, parent_id, sort_order) VALUES (?,?,?)",
    [name.trim(), parent_id || null, (maxOrder[0]?.m || 0) + 1]
  ) as any
  return NextResponse.json({ id: result.insertId, name: name.trim() }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = await req.json()
  const { id, name, old_name } = body
  if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 })

  const sets: string[] = ["name = ?"]
  const vals: any[] = [name.trim()]
  if ("parent_id" in body) { sets.push("parent_id = ?"); vals.push(body.parent_id ?? null) }
  if ("default_roles" in body) { sets.push("default_roles = ?"); vals.push(body.default_roles ?? null) }
  vals.push(id)
  await query(`UPDATE departments SET ${sets.join(", ")} WHERE id = ?`, vals)

  // Propagate rename to all users
  if (old_name && old_name !== name.trim()) {
    await query("UPDATE users SET department = ? WHERE department = ?", [name.trim(), old_name])
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session?.role.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await req.json()
  // Also deactivate children
  await query("UPDATE departments SET active = 0 WHERE id = ? OR parent_id = ?", [id, id])
  return NextResponse.json({ success: true })
}
