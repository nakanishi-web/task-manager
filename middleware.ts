import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/auth', '/api/auth', '/favicon.ico']

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function verifyJwt(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token format')

  const [header, payload, signature] = parts
  const secret = process.env.JWT_SECRET || 'dev'
  const keyData = new TextEncoder().encode(secret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const data = new TextEncoder().encode(`${header}.${payload}`)
  const signatureData = base64UrlDecode(signature)
  const valid = await crypto.subtle.verify('HMAC', cryptoKey, signatureData, data)
  if (!valid) throw new Error('Invalid token signature')

  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decoded)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  if (!token) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    return NextResponse.redirect(redirectUrl)
  }

  try {
    await verifyJwt(token)
    return NextResponse.next()
  } catch {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth'
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: ['/((?!_next|_static|favicon.ico|api/auth|auth).*)'],
}
