import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { userRepository } from '../db/users.js'
import type { UserDto } from '../types/index.js'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      user?: UserDto
    }
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.header('authorization')?.trim()
  if (!header?.toLowerCase().startsWith('bearer ')) return null
  return header.slice(7).trim() || null
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getBearerToken(req)
    if (!token) {
      next()
      return
    }

    const payload = verifyAccessToken(token)
    if (!payload) {
      next()
      return
    }

    const user = await userRepository.findById(payload.sub)
    if (!user) {
      next()
      return
    }

    req.userId = user.id
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getBearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'Требуется авторизация', code: 'UNAUTHORIZED' })
      return
    }

    const payload = verifyAccessToken(token)
    if (!payload) {
      res.status(401).json({ error: 'Сессия истекла', code: 'UNAUTHORIZED' })
      return
    }

    const user = await userRepository.findById(payload.sub)
    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден', code: 'UNAUTHORIZED' })
      return
    }

    req.userId = user.id
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}
