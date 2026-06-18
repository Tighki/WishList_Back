import { Router } from 'express'
import { z } from 'zod'
import { wishlistRepository } from '../db/index.js'
import { requireEditToken } from '../middleware/require-edit-token.js'
import type { WishlistPublicDto } from '../types/index.js'

const createWishlistSchema = z.object({
  title: z.string().trim().max(120).optional(),
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

export const wishlistsRouter = Router()

wishlistsRouter.post('/', (req, res, next) => {
  try {
    const { title } = createWishlistSchema.parse(req.body ?? {})
    const { wishlist, editToken } = wishlistRepository.createWishlist(title ?? 'Мой вишлист')
    res.status(201).json({
      wishlist: toPublicWishlist(wishlist),
      editToken,
    })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.get('/:slug', (req, res) => {
  const slug = typeof req.params.slug === 'string' ? req.params.slug : ''
  const wishlist = wishlistRepository.findBySlug(slug)
  if (!wishlist) {
    res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
    return
  }

  res.json({
    wishlist: toPublicWishlist(wishlist),
    items: wishlistRepository.findItems(wishlist.id),
  })
})

wishlistsRouter.post('/:slug/items', requireEditToken, (req, res, next) => {
  try {
    const input = createItemSchema.parse(req.body)
    const item = wishlistRepository.createItem(req.wishlist!.id, input)
    res.status(201).json({ item })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.patch('/:slug/items/:id', requireEditToken, (req, res, next) => {
  try {
    const patch = patchItemSchema.parse(req.body)
    const itemId = typeof req.params.id === 'string' ? req.params.id : ''
    const item = wishlistRepository.updateItem(req.wishlist!.id, itemId, patch)
    if (!item) {
      res.status(404).json({ error: 'Товар не найден', code: 'NOT_FOUND' })
      return
    }
    res.json({ item })
  } catch (error) {
    next(error)
  }
})

wishlistsRouter.delete('/:slug/items/:id', requireEditToken, (req, res) => {
  const itemId = typeof req.params.id === 'string' ? req.params.id : ''
  const deleted = wishlistRepository.deleteItem(req.wishlist!.id, itemId)
  if (!deleted) {
    res.status(404).json({ error: 'Товар не найден', code: 'NOT_FOUND' })
    return
  }
  res.status(204).send()
})
