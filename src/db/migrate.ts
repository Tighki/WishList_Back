import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from './pool.js'

async function columnExists(table: string, column: string): Promise<boolean> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  )
  return Number(rows[0]?.cnt ?? 0) > 0
}

export async function initDatabase(): Promise<void> {
  const pool = getPool()

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(80) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS wishlists (
      id CHAR(36) PRIMARY KEY,
      slug VARCHAR(32) NOT NULL,
      title VARCHAR(120) NOT NULL,
      edit_token CHAR(36) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_wishlists_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  if (!(await columnExists('wishlists', 'owner_id'))) {
    await pool.execute(`
      ALTER TABLE wishlists
        ADD COLUMN owner_id CHAR(36) NULL,
        ADD KEY idx_wishlists_owner_id (owner_id)
    `)
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id CHAR(36) PRIMARY KEY,
      wishlist_id CHAR(36) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      price DECIMAL(12, 2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      image_url TEXT NOT NULL,
      url TEXT NOT NULL,
      purchased TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      KEY idx_wishlist_items_wishlist_id (wishlist_id),
      CONSTRAINT fk_wishlist_items_wishlist
        FOREIGN KEY (wishlist_id) REFERENCES wishlists(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}
