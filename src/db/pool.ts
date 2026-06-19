import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  return url.replace(/^mariadb:/i, 'mysql:')
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      uri: getDatabaseUrl(),
      connectionLimit: 10,
      waitForConnections: true,
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
