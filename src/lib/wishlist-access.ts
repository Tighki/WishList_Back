import { memberRepository } from '../db/members.js'
import type { WishlistDto } from '../types/index.js'

export function isWishlistOwner(wishlist: WishlistDto, userId?: string): boolean {
  return Boolean(userId && wishlist.ownerId === userId)
}

export async function canEditWishlist(
  wishlist: WishlistDto,
  userId?: string,
  editTokenHeader?: string,
): Promise<boolean> {
  if (isWishlistOwner(wishlist, userId)) return true
  if (editTokenHeader && wishlist.editToken === editTokenHeader) return true
  if (!userId) return false
  try {
    return memberRepository.isMember(wishlist.id, userId)
  } catch {
    return false
  }
}
