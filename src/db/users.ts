import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { RowDataPacket } from 'mysql2/promise'
import type { UserDto } from '../types/index.js'
import { getPool } from './pool.js'

interface UserRow extends RowDataPacket {
  id: string
  email: string
  password_hash: string
  name: string
  created_at: Date
}

function mapUser(row: UserRow): UserDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  }
}

export const userRepository = {
  async createUser(input: {
    email: string
    password: string
    name?: string
  }): Promise<UserDto> {
    const pool = getPool()
    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(input.password, 10)
    const name = input.name?.trim() || input.email.split('@')[0]
    const createdAt = new Date()

    await pool.execute(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.email.toLowerCase(), passwordHash, name, createdAt],
    )

    return {
      id,
      email: input.email.toLowerCase(),
      name,
      createdAt: createdAt.toISOString(),
    }
  },

  async findByEmail(email: string): Promise<(UserDto & { passwordHash: string }) | null> {
    const pool = getPool()
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, email, password_hash, name, created_at FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()],
    )
    if (!rows[0]) return null
    return {
      ...mapUser(rows[0]),
      passwordHash: rows[0].password_hash,
    }
  },

  async findById(id: string): Promise<UserDto | null> {
    const pool = getPool()
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, email, name, created_at FROM users WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? mapUser(rows[0]) : null
  },

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash)
  },
}
