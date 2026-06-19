import { Router } from 'express'
import { z } from 'zod'
import { wishlistRepository } from '../db/index.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { requireWishlistEditor } from '../middleware/require-wishlist-editor.js'
import type { WishlistPublicDto } from '../types/index.js'

const createWishlistSchema = z.object({
  title: z.string().trim().max(120).optional(),
})

const patchWishlistSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(120),
})

const createItemSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(200),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0, 'Цена не может быть отрицательной'),
  imageUrl: z.union([z.string().url(), z.literal('')]).optional(),
  url: z.union([z.string().url(), z.literal('')]).optional(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
})

const patchItemSchema = z
  .object({
    purchased: z.boolean().optional(),
    quantity: z.coerce.number().int().min(1).max(999).optional(),
  })
  .refine((data) => data.purchased !== undefined || data.quantity !== undefined, {
    message: 'Укажите quantity или purchased',
  })

function toPublicWishlist(wishlist: {
  id: string
  slug: string
  title: string
  createdAt: string
}): WishlistPublicDto {
  return {
    id: wishlist.id,
    slug: wishlist.slug,
    title: wishlist.title,
    createdAt: wishlist.createdAt,
  }
}

function canEditWishlist(
  wishlist: { ownerId: string | null; editToken: string },
  userId: string | undefined,
  editTokenHeader: string | undefined,
): boolean {
  if (userId && wishlist.ownerId === userId) return true
  return Boolean(editTokenHeader && wishlist.editToken === editTokenHeader)
}

export const wishlistsRouter = Router()

wishlistsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const wishlists = await wishlistRepository.findSummariesByOwner(req.userId!)
    res.json({ wishlists })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { title } = createWishlistSchema.parse(req.body ?? {})
    const { wishlist, editToken } = await wishlistRepository.createWishlist(
      title ?? 'Мой вишлист',
      req.userId ?? null,
    )
    res.status(201).json({
      wishlist: toPublicWishlist(wishlist),
      editToken,
    })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : ''
    const wishlist = await wishlistRepository.findBySlug(slug)
    if (!wishlist) {
      res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
      return
    }

    const editTokenHeader = req.header('x-edit-token')?.trim()
    const items = await wishlistRepository.findItems(wishlist.id)
    res.json({
      wishlist: toPublicWishlist(wishlist),
      items,
      canEdit: canEditWishlist(wishlist, req.userId, editTokenHeader),
    })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.patch('/:slug', optionalAuth, requireWishlistEditor, async (req, res, next) => {
  try {
    const { title } = patchWishlistSchema.parse(req.body)
    const wishlist = await wishlistRepository.updateWishlist(req.wishlist!.id, { title })
    if (!wishlist) {
      res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
      return
    }
    res.json({ wishlist: toPublicWishlist(wishlist) })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.delete('/:slug', optionalAuth, requireWishlistEditor, async (req, res, next) => {
  try {
    const deleted = await wishlistRepository.deleteWishlist(req.wishlist!.id)
    if (!deleted) {
      res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
      return
    }
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.post('/:slug/items', optionalAuth, requireWishlistEditor, async (req, res, next) => {
  try {
    const input = createItemSchema.parse(req.body)
    const item = await wishlistRepository.createItem(req.wishlist!.id, input)
    res.status(201).json({ item })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.patch(
  '/:slug/items/:id',
  optionalAuth,
  requireWishlistEditor,
  async (req, res, next) => {
    try {
      const patch = patchItemSchema.parse(req.body)
      const itemId = typeof req.params.id === 'string' ? req.params.id : ''
      const item = await wishlistRepository.updateItem(req.wishlist!.id, itemId, patch)
      if (!item) {
        res.status(404).json({ error: 'Товар не найден', code: 'NOT_FOUND' })
        return
      }
      res.json({ item })
    } catch (error) {
      next(error)
    }
  },
)

wishlistsRouter.delete(
  '/:slug/items/:id',
  optionalAuth,
  requireWishlistEditor,
  async (req, res, next) => {
    try {
      const itemId = typeof req.params.id === 'string' ? req.params.id : ''
      const deleted = await wishlistRepository.deleteItem(req.wishlist!.id, itemId)
      if (!deleted) {
        res.status(404).json({ error: 'Товар не найден', code: 'NOT_FOUND' })
        return
      }
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)
