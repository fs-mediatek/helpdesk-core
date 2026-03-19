import { NextRequest, NextResponse } from "next/server"
import { query, pool } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    // Check if already set up
    const users = await query("SELECT COUNT(*) as c FROM users") as any[]
    if ((users[0]?.c || 0) > 0) {
      return NextResponse.json({ error: "System ist bereits eingerichtet" }, { status: 400 })
    }

    const { company_name, admin_name, admin_email, admin_password } = await req.json()
    if (!admin_name?.trim() || !admin_email?.trim() || !admin_password) {
      return NextResponse.json({ error: "Alle Felder erforderlich" }, { status: 400 })
    }

    // Create admin user
    const hash = await bcrypt.hash(admin_password, 10)
    await pool.execute(
      "INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,'admin',1)",
      [admin_name.trim(), admin_email.trim(), hash]
    )

    // Save company name
    if (company_name?.trim()) {
      await pool.execute(
        "INSERT INTO settings (key_name, value) VALUES ('company_name', ?) ON DUPLICATE KEY UPDATE value = ?",
        [company_name.trim(), company_name.trim()]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[Setup Error]", err)
    return NextResponse.json({ error: err?.message || "Setup fehlgeschlagen" }, { status: 500 })
  }
}
