import type { NextFunction, Request, Response } from 'express'
import { wishlistRepository } from '../db/index.js'
import { canEditWishlist } from '../lib/wishlist-access.js'
import type { WishlistDto } from '../types/index.js'

declare global {
  namespace Express {
    interface Request {
      wishlist?: WishlistDto
    }
  }
}

export async function requireWishlistEditor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : ''
    const editToken = req.header('x-edit-token')?.trim()

    if (!slug) {
      res.status(403).json({ error: 'Нет доступа к редактированию', code: 'FORBIDDEN' })
      return
    }

    const wishlist = await wishlistRepository.findBySlug(slug)
    if (!wishlist) {
      res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
      return
    }

    const allowed = await canEditWishlist(wishlist, req.userId, editToken)
    if (!allowed) {
      res.status(403).json({ error: 'Нет доступа к редактированию', code: 'FORBIDDEN' })
      return
    }

    req.wishlist = wishlist
    next()
  } catch (error) {
    next(error)
  }
}
