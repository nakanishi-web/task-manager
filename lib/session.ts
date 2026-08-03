import jwt from 'jsonwebtoken'

export function getSessionUserId(cookieHeader: string | null): string | null {
  const cookie = cookieHeader || ''
  const match = cookie.match(/session=([^;]+)/)
  if (!match) return null

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET || 'dev') as { userId: string }
    return payload.userId || null
  } catch {
    return null
  }
}
