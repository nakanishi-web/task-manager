import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUserId } from '@/lib/session'

type ImportTask = {
  text?: string
  done?: boolean
  deadline?: string
  project?: string
  tags?: string[]
}

export async function POST(request: Request) {
  const userId = getSessionUserId(request.headers.get('cookie'))
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { tasks?: ImportTask[] }
  const items = Array.isArray(body.tasks) ? body.tasks : []

  if (items.length === 0) {
    return NextResponse.json({ ok: true, imported: 0 })
  }

  const data = items
    .map((task) => ({
      text: (task.text || '').trim(),
      done: typeof task.done === 'boolean' ? task.done : false,
      deadline: task.deadline || '未設定',
      project: (task.project || '').trim() || '未分類',
      tags: Array.isArray(task.tags)
        ? task.tags.map((tag) => tag.trim()).filter(Boolean).join(',')
        : '',
      userId,
    }))
    .filter((task) => task.text.length > 0)

  if (data.length > 0) {
    await prisma.task.createMany({ data })
  }

  return NextResponse.json({ ok: true, imported: data.length })
}
