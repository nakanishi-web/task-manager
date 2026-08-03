import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || ''
    const match = cookie.match(/session=([^;]+)/)
    if (!match) return NextResponse.json({ user: null })

    const token = match[1]
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev') as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ user: null })

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch {
    return NextResponse.json({ user: null })
  }
}
