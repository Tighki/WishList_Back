import crypto from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import type { WishlistMemberDto } from '../types/index.js'
import { getPool } from './pool.js'

interface MemberRow extends RowDataPacket {
  id: string
  wishlist_id: string
  user_id: string
  invited_by: string | null
  created_at: Date
  user_name: string
  user_email: string
}

function mapMember(row: MemberRow): WishlistMemberDto {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.user_name,
    email: row.user_email,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  }
}

export const memberRepository = {
  async isMember(wishlistId: string, userId: string): Promise<boolean> {
    const pool = getPool()
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM wishlist_members WHERE wishlist_id = ? AND user_id = ? LIMIT 1',
      [wishlistId, userId],
    )
    return rows.length > 0
  },

  async addMember(
    wishlistId: string,
    userId: string,
    invitedBy: string,
  ): Promise<WishlistMemberDto> {
    const pool = getPool()
    const id = crypto.randomUUID()
    const createdAt = new Date()

    await pool.execute(
      `INSERT INTO wishlist_members (id, wishlist_id, user_id, invited_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, wishlistId, userId, invitedBy, createdAt],
    )

    const [rows] = await pool.execute<MemberRow[]>(
      `SELECT m.id, m.wishlist_id, m.user_id, m.invited_by, m.created_at,
              u.name AS user_name, u.email AS user_email
       FROM wishlist_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = ?
       LIMIT 1`,
      [id],
    )

    return mapMember(rows[0])
  },

  async findMembers(wishlistId: string): Promise<WishlistMemberDto[]> {
    const pool = getPool()
    const [rows] = await pool.execute<MemberRow[]>(
      `SELECT m.id, m.wishlist_id, m.user_id, m.invited_by, m.created_at,
              u.name AS user_name, u.email AS user_email
       FROM wishlist_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.wishlist_id = ?
       ORDER BY m.created_at ASC`,
      [wishlistId],
    )
    return rows.map(mapMember)
  },

  async removeMember(wishlistId: string, userId: string): Promise<boolean> {
    const pool = getPool()
    const [result] = await pool.execute(
      'DELETE FROM wishlist_members WHERE wishlist_id = ? AND user_id = ?',
      [wishlistId, userId],
    )
    return 'affectedRows' in result && result.affectedRows > 0
  },
}
