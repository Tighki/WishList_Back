import type { NextFunction, Request, Response } from 'express'
import { wishlistRepository } from '../db/index.js'
import { isWishlistOwner } from '../lib/wishlist-access.js'

export async function requireWishlistOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : ''

    if (!slug || !req.userId) {
      res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' })
      return
    }

    const wishlist = await wishlistRepository.findBySlug(slug)
    if (!wishlist) {
      res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
      return
    }

    if (!isWishlistOwner(wishlist, req.userId)) {
      res.status(403).json({ error: 'Только владелец может выполнить это действие', code: 'FORBIDDEN' })
      return
    }

    req.wishlist = wishlist
    next()
  } catch (error) {
    next(error)
  }
}
