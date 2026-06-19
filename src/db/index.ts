import crypto from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import type { CreateItemInput, WishlistDto, WishlistItemDto } from '../types/index.js'
import { getPool } from './pool.js'

interface WishlistRow extends RowDataPacket {
  id: string
  slug: string
  title: string
  edit_token: string
  created_at: Date
}

interface WishlistItemRow extends RowDataPacket {
  id: string
  wishlist_id: string
  title: string
  description: string
  price: string | number
  quantity: number
  image_url: string
  url: string
  purchased: number
  created_at: Date
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapWishlist(row: WishlistRow): WishlistDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    editToken: row.edit_token,
    createdAt: toIsoString(row.created_at),
  }
}

function mapItem(row: WishlistItemRow): WishlistItemDto {
  return {
    id: row.id,
    wishlistId: row.wishlist_id,
    title: row.title,
    description: row.description ?? '',
    price: Number(row.price),
    quantity: row.quantity > 0 ? row.quantity : 1,
    imageUrl: row.image_url ?? '',
    url: row.url ?? '',
    purchased: Boolean(row.purchased),
    createdAt: toIsoString(row.created_at),
  }
}

async function createSlug(): Promise<string> {
  const pool = getPool()
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = crypto.randomBytes(6).toString('base64url')
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM wishlists WHERE slug = ? LIMIT 1',
      [slug],
    )
    if (rows.length === 0) return slug
  }
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export const wishlistRepository = {
  async createWishlist(title: string): Promise<{ wishlist: WishlistDto; editToken: string }> {
    const pool = getPool()
    const editToken = crypto.randomUUID()
    const wishlist: WishlistDto = {
      id: crypto.randomUUID(),
      slug: await createSlug(),
      title: title.trim() || 'Мой вишлист',
      editToken,
      createdAt: new Date().toISOString(),
    }

    await pool.execute(
      `INSERT INTO wishlists (id, slug, title, edit_token, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [wishlist.id, wishlist.slug, wishlist.title, editToken, new Date(wishlist.createdAt)],
    )

    return { wishlist, editToken }
  },

  async findBySlug(slug: string): Promise<WishlistDto | null> {
    const pool = getPool()
    const [rows] = await pool.execute<WishlistRow[]>(
      'SELECT id, slug, title, edit_token, created_at FROM wishlists WHERE slug = ? LIMIT 1',
      [slug],
    )
    return rows[0] ? mapWishlist(rows[0]) : null
  },

  async verifyEditToken(slug: string, token: string): Promise<WishlistDto | null> {
    const wishlist = await this.findBySlug(slug)
    if (!wishlist || wishlist.editToken !== token) return null
    return wishlist
  },

  async findItems(wishlistId: string): Promise<WishlistItemDto[]> {
    const pool = getPool()
    const [rows] = await pool.execute<WishlistItemRow[]>(
      `SELECT id, wishlist_id, title, description, price, quantity, image_url, url, purchased, created_at
       FROM wishlist_items
       WHERE wishlist_id = ?
       ORDER BY created_at DESC`,
      [wishlistId],
    )
    return rows.map(mapItem)
  },

  async createItem(wishlistId: string, input: CreateItemInput): Promise<WishlistItemDto> {
    const pool = getPool()
    const createdAt = new Date().toISOString()
    const item: WishlistItemDto = {
      id: crypto.randomUUID(),
      wishlistId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      price: input.price,
      quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
      imageUrl: input.imageUrl?.trim() ?? '',
      url: input.url?.trim() ?? '',
      purchased: false,
      createdAt,
    }

    await pool.execute(
      `INSERT INTO wishlist_items
        (id, wishlist_id, title, description, price, quantity, image_url, url, purchased, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.wishlistId,
        item.title,
        item.description,
        item.price,
        item.quantity,
        item.imageUrl,
        item.url,
        item.purchased ? 1 : 0,
        new Date(createdAt),
      ],
    )

    return item
  },

  async deleteItem(wishlistId: string, itemId: string): Promise<boolean> {
    const pool = getPool()
    const [result] = await pool.execute(
      'DELETE FROM wishlist_items WHERE wishlist_id = ? AND id = ?',
      [wishlistId, itemId],
    )
    return 'affectedRows' in result && result.affectedRows > 0
  },

  async updateItem(
    wishlistId: string,
    itemId: string,
    patch: { purchased?: boolean; quantity?: number },
  ): Promise<WishlistItemDto | null> {
    const pool = getPool()
    const updates: string[] = []
    const values: Array<string | number | boolean> = []

    if (patch.purchased !== undefined) {
      updates.push('purchased = ?')
      values.push(patch.purchased ? 1 : 0)
    }
    if (patch.quantity !== undefined) {
      updates.push('quantity = ?')
      values.push(patch.quantity)
    }

    if (updates.length === 0) {
      const [rows] = await pool.execute<WishlistItemRow[]>(
        `SELECT id, wishlist_id, title, description, price, quantity, image_url, url, purchased, created_at
         FROM wishlist_items
         WHERE wishlist_id = ? AND id = ?
         LIMIT 1`,
        [wishlistId, itemId],
      )
      return rows[0] ? mapItem(rows[0]) : null
    }

    values.push(wishlistId, itemId)
    const [result] = await pool.execute(
      `UPDATE wishlist_items SET ${updates.join(', ')} WHERE wishlist_id = ? AND id = ?`,
      values,
    )

    if (!('affectedRows' in result) || result.affectedRows === 0) {
      return null
    }

    const [rows] = await pool.execute<WishlistItemRow[]>(
      `SELECT id, wishlist_id, title, description, price, quantity, image_url, url, purchased, created_at
       FROM wishlist_items
       WHERE wishlist_id = ? AND id = ?
       LIMIT 1`,
      [wishlistId, itemId],
    )
    return rows[0] ? mapItem(rows[0]) : null
  },
}
