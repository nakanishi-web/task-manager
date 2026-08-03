import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.append('Set-Cookie', `session=; HttpOnly; Path=/; Max-Age=0`)
  return res
}
