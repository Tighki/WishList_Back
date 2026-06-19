import jwt from 'jsonwebtoken'

const JWT_EXPIRES_IN = '30d'

export interface JwtPayload {
  sub: string
  email: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set')
  }
  return 'dev-jwt-secret-change-me'
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret())
    if (typeof decoded === 'string' || !decoded || typeof decoded.sub !== 'string') {
      return null
    }
    return {
      sub: decoded.sub,
      email: typeof decoded.email === 'string' ? decoded.email : '',
    }
  } catch {
    return null
  }
}
