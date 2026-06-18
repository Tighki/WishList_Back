import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { CreateItemInput, WishlistDto, WishlistItemDto } from '../types/index.js'

const dataDir = path.resolve(process.cwd(), 'data')
const storePath = process.env.DATABASE_PATH ?? path.join(dataDir, 'wishlist.json')

interface StoreFile {
  wishlists: WishlistDto[]
  items: WishlistItemDto[]
}

function ensureStore(): StoreFile {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  if (!fs.existsSync(storePath)) {
    const empty: StoreFile = { wishlists: [], items: [] }
    fs.writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf-8')
    return empty
  }

  const raw = fs.readFileSync(storePath, 'utf-8')
  const parsed = JSON.parse(raw) as Partial<StoreFile>
  return {
    wishlists: parsed.wishlists ?? [],
    items: (parsed.items ?? []).map(normalizeItem),
  }
}

function writeStore(store: StoreFile): void {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8')
}

function normalizeItem(item: WishlistItemDto): WishlistItemDto {
  return {
    ...item,
    quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    description: item.description ?? '',
    imageUrl: item.imageUrl ?? '',
    url: item.url ?? '',
  }
}

function createSlug(store: StoreFile): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = crypto.randomBytes(6).toString('base64url')
    if (!store.wishlists.some((wishlist) => wishlist.slug === slug)) {
      return slug
    }
  }
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export const wishlistRepository = {
  createWishlist(title: string): { wishlist: WishlistDto; editToken: string } {
    const store = ensureStore()
    const editToken = crypto.randomUUID()
    const wishlist: WishlistDto = {
      id: crypto.randomUUID(),
      slug: createSlug(store),
      title: title.trim() || 'Мой вишлист',
      editToken,
      createdAt: new Date().toISOString(),
    }
    store.wishlists.push(wishlist)
    writeStore(store)
    return { wishlist, editToken }
  },

  findBySlug(slug: string): WishlistDto | null {
    const store = ensureStore()
    return store.wishlists.find((wishlist) => wishlist.slug === slug) ?? null
  },

  verifyEditToken(slug: string, token: string): WishlistDto | null {
    const wishlist = this.findBySlug(slug)
    if (!wishlist || wishlist.editToken !== token) return null
    return wishlist
  },

  findItems(wishlistId: string): WishlistItemDto[] {
    const store = ensureStore()
    return store.items
      .filter((item) => item.wishlistId === wishlistId)
      .map(normalizeItem)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  createItem(wishlistId: string, input: CreateItemInput): WishlistItemDto {
    const store = ensureStore()
    const created: WishlistItemDto = normalizeItem({
      id: crypto.randomUUID(),
      wishlistId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      price: input.price,
      quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
      imageUrl: input.imageUrl?.trim() ?? '',
      url: input.url?.trim() ?? '',
      purchased: false,
      createdAt: new Date().toISOString(),
    })
    store.items.unshift(created)
    writeStore(store)
    return created
  },

  deleteItem(wishlistId: string, itemId: string): boolean {
    const store = ensureStore()
    const before = store.items.length
    store.items = store.items.filter(
      (item) => !(item.wishlistId === wishlistId && item.id === itemId),
    )
    if (store.items.length === before) return false
    writeStore(store)
    return true
  },

  updateItem(
    wishlistId: string,
    itemId: string,
    patch: { purchased?: boolean; quantity?: number },
  ): WishlistItemDto | null {
    const store = ensureStore()
    const item = store.items.find(
      (entry) => entry.wishlistId === wishlistId && entry.id === itemId,
    )
    if (!item) return null

    if (patch.purchased !== undefined) {
      item.purchased = patch.purchased
    }
    if (patch.quantity !== undefined) {
      item.quantity = patch.quantity
    }

    writeStore(store)
    return normalizeItem(item)
  },
}
