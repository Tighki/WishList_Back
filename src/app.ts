import cors from 'cors'
import express from 'express'
import { errorHandler } from './middleware/error-handler.js'
import { itemsRouter } from './routes/items.js'

function getCorsOrigins(): string[] | true {
  const configured = process.env.CORS_ORIGIN?.trim()
  if (configured) {
    if (configured === '*') return true
    return configured.split(',').map((origin) => origin.trim()).filter(Boolean)
  }

  if (process.env.NODE_ENV !== 'production') {
    return true
  }

  return []
}

export function createApp() {
  const app = express()
  const corsOrigins = getCorsOrigins()

  if (corsOrigins === true) {
    app.use(cors())
  } else if (corsOrigins.length > 0) {
    app.use(cors({ origin: corsOrigins }))
  }

  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'wishlist-backend' })
  })

  app.use('/api/items', itemsRouter)
  app.use(errorHandler)

  return app
}
