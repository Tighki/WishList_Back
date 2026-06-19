import { Router } from 'express'
import { z } from 'zod'
import { memberRepository } from '../db/members.js'
import { userRepository } from '../db/users.js'
import { wishlistRepository } from '../db/index.js'
import { isWishlistOwner } from '../lib/wishlist-access.js'
import { requireAuth } from '../middleware/auth.js'
import { requireWishlistEditor } from '../middleware/require-wishlist-editor.js'
import { requireWishlistOwner } from '../middleware/require-wishlist-owner.js'

const inviteMemberSchema = z.object({
  email: z.string().trim().email('Некорректный email'),
})

export const wishlistMembersRouter = Router({ mergeParams: true })

wishlistMembersRouter.get('/', requireAuth, requireWishlistEditor, async (req, res, next) => {
  try {
    const members = await memberRepository.findMembers(req.wishlist!.id)
    res.json({ members })
  } catch (error) {
    next(error)
  }
})

wishlistMembersRouter.post('/', requireAuth, requireWishlistOwner, async (req, res, next) => {
  try {
    const { email } = inviteMemberSchema.parse(req.body ?? {})
    const wishlist = req.wishlist!
    const invitee = await userRepository.findByEmail(email)

    if (!invitee) {
      res.status(404).json({
        error: 'Пользователь не найден. Попросите его зарегистрироваться',
        code: 'USER_NOT_FOUND',
      })
      return
    }

    if (invitee.id === req.userId) {
      res.status(400).json({ error: 'Нельзя пригласить себя', code: 'INVALID_INVITE' })
      return
    }

    if (wishlist.ownerId === invitee.id) {
      res.status(400).json({ error: 'Этот пользователь уже владелец вишлиста', code: 'INVALID_INVITE' })
      return
    }

    const alreadyMember = await memberRepository.isMember(wishlist.id, invitee.id)
    if (alreadyMember) {
      res.status(409).json({ error: 'Пользователь уже приглашён', code: 'ALREADY_MEMBER' })
      return
    }

    const member = await memberRepository.addMember(wishlist.id, invitee.id, req.userId!)
    res.status(201).json({ member })
  } catch (error) {
    next(error)
  }
})

wishlistMembersRouter.delete('/:userId', requireAuth, async (req, res, next) => {
  try {
    const slug = typeof req.params.slug === 'string' ? req.params.slug : ''
    const targetUserId = typeof req.params.userId === 'string' ? req.params.userId : ''

    if (!slug || !targetUserId || !req.userId) {
      res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' })
      return
    }

    const wishlist = await wishlistRepository.findBySlug(slug)
    if (!wishlist) {
      res.status(404).json({ error: 'Вишлист не найден', code: 'NOT_FOUND' })
      return
    }

    const isOwner = isWishlistOwner(wishlist, req.userId)
    const isSelf = req.userId === targetUserId

    if (!isOwner && !isSelf) {
      res.status(403).json({ error: 'Нет доступа', code: 'FORBIDDEN' })
      return
    }

    const removed = await memberRepository.removeMember(wishlist.id, targetUserId)
    if (!removed) {
      res.status(404).json({ error: 'Участник не найден', code: 'NOT_FOUND' })
      return
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})
