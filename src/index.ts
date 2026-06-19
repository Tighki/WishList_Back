import { createApp } from './app.js'
import { initDatabase } from './db/migrate.js'

const port = Number(process.env.PORT ?? 3001)

try {
  await initDatabase()
  const app = createApp()

  app.listen(port, () => {
    console.log(`WishList API: http://localhost:${port}`)
  })
} catch (error) {
  console.error('Failed to start WishList API:', error)
  process.exit(1)
}
