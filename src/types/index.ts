export interface UserDto {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface WishlistDto {
  id: string
  slug: string
  title: string
  editToken: string
  ownerId: string | null
  createdAt: string
}

export interface WishlistPublicDto {
  id: string
  slug: string
  title: string
  createdAt: string
}

export interface WishlistItemDto {
  id: string
  wishlistId: string
  title: string
  description: string
  price: number
  quantity: number
  imageUrl: string
  url: string
  purchased: boolean
  createdAt: string
}

export type CreateItemInput = {
  title: string
  description?: string
  price: number
  imageUrl?: string
  url?: string
  quantity?: number
}
