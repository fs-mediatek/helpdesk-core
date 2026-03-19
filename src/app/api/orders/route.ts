import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { query, pool } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const roles: string[] = session.role ? session.role.split(",").map((r: string) => r.trim()) : []
  const isPrivileged = roles.some(r => ["admin", "agent", "disposition", "assistenz", "fuehrungskraft"].includes(r))

  let sql = "SELECT o.*, u.name as requester_name FROM orders o LEFT JOIN users u ON o.requested_by = u.id WHERE 1=1"
  const params: any[] = []

  // Regular users only see their own orders
  if (!isPrivileged) {
    sql += " AND o.requested_by = ?"
    params.push(session.userId)
  }

  if (status) { sql += " AND o.status = ?"; params.push(status) }
  sql += " ORDER BY o.created_at DESC"
  const orders = await query(sql, params)
  return NextResponse.json(orders)
}

const DEFAULT_STEPS = [
  "Anfrage eingegangen", "In Prüfung", "Genehmigt",
  "Bestellung aufgegeben", "Versandt", "Geliefert", "Abgeschlossen"
]

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await req.json()
    const { title, description, priority, estimated_delivery, category_id, items } = body

    // For cart orders, derive title from items if not provided
    const orderTitle = title?.trim() || (
      Array.isArray(items) && items.length > 0
        ? items.map((i: any) => i.name).join(", ")
        : "Bestellung"
    )

    // Determine the strictest workflow from cart product_ids
    let resolvedCategoryId: number | null = category_id || null
    if (Array.isArray(items) && items.length > 0) {
      const productIds = items.map((i: any) => i.product_id).filter(Boolean)
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => "?").join(",")
        const products = await query(
          `SELECT category_id FROM order_products WHERE id IN (${placeholders}) AND category_id IS NOT NULL`,
          productIds
        ) as any[]
        const categoryIds = [...new Set(products.map(p => p.category_id).filter(Boolean))] as number[]
        if (categoryIds.length > 0) {
          // Pick strictest: prefer category with Führungskraft approval step
          let strictest: number | null = null
          for (const catId of categoryIds) {
            const steps = await query(
              "SELECT action_type, assigned_roles FROM order_category_steps WHERE category_id = ?", [catId]
            ) as any[]
            const needsFK = steps.some((s: any) =>
              s.action_type === "approval" &&
              s.assigned_roles?.split(",").map((r: string) => r.trim()).includes("fuehrungskraft")
            )
            if (needsFK) { strictest = catId; break }
          }
          resolvedCategoryId = strictest ?? categoryIds[0]
        }
      }
    }

    const year = new Date().getFullYear()
    const [countRow] = await query<{ c: number }>("SELECT COUNT(*) as c FROM orders WHERE YEAR(created_at) = ?", [year])
    const { generateOrderNumber } = await import("@/lib/numbering")
    const orderNumber = await generateOrderNumber(year, (countRow as any).c + 1)

    const [result] = await pool.execute(
      "INSERT INTO orders (order_number, title, description, priority, estimated_delivery, requested_by, status, category_id) VALUES (?, ?, ?, ?, ?, ?, 'requested', ?)",
      [orderNumber, orderTitle, description || null, priority || "medium", estimated_delivery || null, session.userId, resolvedCategoryId]
    ) as any
    const orderId = result.insertId

    // Ensure product_id column exists in order_items
    await pool.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id INT UNSIGNED DEFAULT NULL").catch(() => {})
    await pool.execute("ALTER TABLE order_items ADD COLUMN product_id INT UNSIGNED DEFAULT NULL").catch(() => {})

    // Insert order items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await pool.execute(
          "INSERT INTO order_items (order_id, item_name, quantity, specs, unit_price, product_id) VALUES (?,?,?,?,?,?)",
          [orderId, item.name, item.quantity || 1, item.specs || null, item.unit_price || null, item.product_id || null]
        )
      }
    }

    // Load workflow steps from resolved category or use defaults
    let steps: string[] = DEFAULT_STEPS
    if (resolvedCategoryId) {
      const catSteps = await query(
        "SELECT step_name FROM order_category_steps WHERE category_id = ? ORDER BY step_order", [resolvedCategoryId]
      ) as any[]
      if (catSteps.length > 0) steps = catSteps.map((s: any) => s.step_name)
    }

    for (let i = 0; i < steps.length; i++) {
      const stepStatus = i === 0 ? "completed" : i === 1 ? "active" : "pending"
      await pool.execute(
        "INSERT INTO order_progress_steps (order_id, step_name, step_order, status, completed_at, completed_by) VALUES (?,?,?,?,?,?)",
        [orderId, steps[i], i + 1, stepStatus, i === 0 ? new Date() : null, i === 0 ? session.userId : null]
      )
    }

    // Apply SLA rule
    try {
      const [user] = await query("SELECT department FROM users WHERE id = ?", [session.userId]) as any[]
      const { applySlaToOrder } = await import("@/lib/sla")
      await applySlaToOrder(orderId, { category: orderTitle, department: user?.department })
    } catch {}

    return NextResponse.json({ id: orderId, order_number: orderNumber }, { status: 201 })
  } catch (err: any) {
    console.error("[Orders POST]", err)
    return NextResponse.json({ error: err.message || "Fehler beim Erstellen" }, { status: 500 })
  }
}
