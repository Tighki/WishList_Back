import { Router } from 'express'
import { z } from 'zod'
import { userRepository } from '../db/users.js'
import { signAccessToken } from '../lib/jwt.js'
import { requireAuth } from '../middleware/auth.js'

const registerSchema = z.object({
  email: z.string().trim().email('Некорректный email'),
  password: z.string().min(6, 'Пароль не менее 6 символов').max(128),
  name: z.string().trim().max(80).optional(),
})

const loginSchema = z.object({
  email: z.string().trim().email('Некорректный email'),
  password: z.string().min(1, 'Укажите пароль'),
})

export const authRouter = Router()

authRouter.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body ?? {})
    const existing = await userRepository.findByEmail(input.email)
    if (existing) {
      res.status(409).json({ error: 'Email уже занят', code: 'EMAIL_TAKEN' })
      return
    }

    const user = await userRepository.createUser(input)
    const accessToken = signAccessToken({ sub: user.id, email: user.email })

    res.status(201).json({ user, accessToken })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body ?? {})
    const user = await userRepository.findByEmail(input.email)
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль', code: 'INVALID_CREDENTIALS' })
      return
    }

    const valid = await userRepository.verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Неверный email или пароль', code: 'INVALID_CREDENTIALS' })
      return
    }

    const { passwordHash: _, ...publicUser } = user
    const accessToken = signAccessToken({ sub: publicUser.id, email: publicUser.email })
    res.json({ user: publicUser, accessToken })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
