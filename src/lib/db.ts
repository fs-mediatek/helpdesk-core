import mysql from 'mysql2/promise'

const poolConfig: any = {
  database: process.env.DB_NAME || 'helpdesk',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}

// Use Unix socket if available (bypasses auth issues on Linux)
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost'
  poolConfig.port = parseInt(process.env.DB_PORT || '3306')
}

const pool = mysql.createPool(poolConfig)

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params)
  return rows as T[]
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export { pool }
export default pool
