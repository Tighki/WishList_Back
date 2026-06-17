import { Router } from 'express'
import { z } from 'zod'
import { wishlistRepository } from '../db/index.js'
import { parseOzonProduct } from '../services/ozon-parser.js'

const createItemSchema = z.object({
  url: z.string().url('Укажите корректную ссылку'),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
})

const urlBodySchema = z.object({
  url: z.string().url('Укажите корректную ссылку'),
})

const patchItemSchema = z
  .object({
    purchased: z.boolean().optional(),
    quantity: z.coerce.number().int().min(1).max(999).optional(),
  })
  .refine((data) => data.purchased !== undefined || data.quantity !== undefined, {
    message: 'Укажите quantity или purchased',
  })

export const itemsRouter = Router()

itemsRouter.get('/', (_req, res) => {
  res.json({ items: wishlistRepository.findAll() })
})

itemsRouter.post('/parse', async (req, res, next) => {
  try {
    const { url } = urlBodySchema.parse(req.body)
    const product = await parseOzonProduct(url)
    res.json({ product })
  } catch (error) {
    next(error)
  }
})

itemsRouter.post('/', async (req, res, next) => {
  try {
    const { url, quantity } = createItemSchema.parse(req.body)
    const product = await parseOzonProduct(url)

    const existing = wishlistRepository.findByUrl(product.url)
    if (existing) {
      res.status(409).json({
        error: 'Этот товар уже есть в вишлисте',
        code: 'DUPLICATE',
        item: existing,
      })
      return
    }

    const item = wishlistRepository.create({
      id: crypto.randomUUID(),
      url: product.url,
      title: product.title,
      description: product.description,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
      purchased: false,
    })

    res.status(201).json({ item })
  } catch (error) {
    next(error)
  }
})

itemsRouter.delete('/:id', (req, res) => {
  const deleted = wishlistRepository.delete(req.params.id)
  if (!deleted) {
    res.status(404).json({ error: 'Товар не найден', code: 'NOT_FOUND' })
    return
  }
  res.status(204).send()
})

itemsRouter.patch('/:id', (req, res, next) => {
  try {
    const patch = patchItemSchema.parse(req.body)
    const item = wishlistRepository.update(req.params.id, patch)
    if (!item) {
      res.status(404).json({ error: 'Товар не найден', code: 'NOT_FOUND' })
      return
    }
    res.json({ item })
  } catch (error) {
    next(error)
  }
})
