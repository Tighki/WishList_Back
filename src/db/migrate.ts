import { getPool } from './pool.js'

export async function initDatabase(): Promise<void> {
  const pool = getPool()

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
