export interface ParsedOzonProduct {
  url: string
  title: string
  description: string
  price: number
  imageUrl: string
  ozonId?: string
}

export interface WishlistItemDto {
  id: string
  url: string
  title: string
  description: string
  price: number
  quantity: number
  imageUrl: string
  purchased: boolean
  createdAt: string
}
