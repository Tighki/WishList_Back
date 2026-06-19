import type { NextFunction, Request, Response } from 'express'
import { wishlistRepository } from '../db/index.js'
import type { WishlistDto } from '../types/index.js'

declare global {
  namespace Express {
    interface Request {
      wishlist?: WishlistDto
    }
  }
}

export async function requireEditToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : ''
    const token = req.header('x-edit-token')?.trim()

    if (!slug || !token) {
      res.status(403).json({ error: 'Нет доступа к редактированию', code: 'FORBIDDEN' })
      return
    }

    const wishlist = await wishlistRepository.verifyEditToken(slug, token)
    if (!wishlist) {
      res.status(403).json({ error: 'Нет доступа к редактированию', code: 'FORBIDDEN' })
      return
    }

    req.wishlist = wishlist
    next()
  } catch (error) {
    next(error)
  }
}
