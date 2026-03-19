import { NextResponse } from "next/server"
import { pool, query } from "@/lib/db"

export async function GET() {
  let dbOk = false
  let hasUsers = false
  try {
    await pool.execute("SELECT 1")
    dbOk = true
    // Create users table if not exists
    await pool.execute(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(200) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(200) DEFAULT 'user',
      department VARCHAR(100) DEFAULT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
    await pool.execute(`CREATE TABLE IF NOT EXISTS settings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(100) NOT NULL UNIQUE,
      value TEXT
    )`)
    await pool.execute(`CREATE TABLE IF NOT EXISTS tickets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ticket_number VARCHAR(30) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status ENUM('open','pending','in_progress','resolved','closed') DEFAULT 'open',
      priority ENUM('low','medium','high','critical') DEFAULT 'medium',
      category VARCHAR(100) DEFAULT NULL,
      requester_id INT UNSIGNED,
      assignee_id INT UNSIGNED DEFAULT NULL,
      sla_due_at TIMESTAMP NULL DEFAULT NULL,
      resolved_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`)
    await pool.execute(`CREATE TABLE IF NOT EXISTS ticket_counters (
      year INT PRIMARY KEY,
      last_number INT DEFAULT 0
    )`)
    await pool.execute(`CREATE TABLE IF NOT EXISTS ticket_comments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      is_internal TINYINT(1) DEFAULT 0,
      is_system TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
    const users = await query("SELECT COUNT(*) as c FROM users") as any[]
    hasUsers = (users[0]?.c || 0) > 0
  } catch {}
  return NextResponse.json({ db_ok: dbOk, has_users: hasUsers })
}
