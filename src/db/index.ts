import fs from 'node:fs'
import path from 'node:path'
import type { WishlistItemDto } from '../types/index.js'

const dataDir = path.resolve(process.cwd(), 'data')
const storePath = process.env.DATABASE_PATH ?? path.join(dataDir, 'wishlist.json')

interface StoreFile {
  items: WishlistItemDto[]
}

function ensureStore(): StoreFile {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (!fs.existsSync(storePath)) {
    const empty: StoreFile = { items: [] }
    fs.writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf-8')
    return empty
  }

  const raw = fs.readFileSync(storePath, 'utf-8')
  const store = JSON.parse(raw) as StoreFile
  store.items = store.items.map(normalizeItem)
  return store
}

function normalizeItem(item: WishlistItemDto): WishlistItemDto {
  return {
    ...item,
    quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
  }
}

function writeStore(store: StoreFile): void {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8')
}

export const wishlistRepository = {
  findAll(): WishlistItemDto[] {
    const store = ensureStore()
    return [...store.items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  },

  findByUrl(url: string): WishlistItemDto | null {
    const store = ensureStore()
    return store.items.find((item) => item.url === url) ?? null
  },

  create(item: Omit<WishlistItemDto, 'createdAt'>): WishlistItemDto {
    const store = ensureStore()
    const created: WishlistItemDto = {
      ...item,
      createdAt: new Date().toISOString(),
    }
    store.items.unshift(created)
    writeStore(store)
    return created
  },

  delete(id: string): boolean {
    const store = ensureStore()
    const nextLength = store.items.length
    store.items = store.items.filter((item) => item.id !== id)
    if (store.items.length === nextLength) return false
    writeStore(store)
    return true
  },

  update(id: string, patch: { purchased?: boolean; quantity?: number }): WishlistItemDto | null {
    const store = ensureStore()
    const item = store.items.find((entry) => entry.id === id)
    if (!item) return null

    if (patch.purchased !== undefined) {
      item.purchased = patch.purchased
    }
    if (patch.quantity !== undefined) {
      item.quantity = patch.quantity
    }

    writeStore(store)
    return item
  },
}
