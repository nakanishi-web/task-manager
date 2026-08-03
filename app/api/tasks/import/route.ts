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

type NormalizedTask = {
  text: string
  done: boolean
  deadline: string
  project: string
  tags: string
  userId: string
}

const toSignature = (task: Pick<NormalizedTask, 'text' | 'done' | 'deadline' | 'project' | 'tags'>) =>
  [task.text, task.done ? '1' : '0', task.deadline, task.project, task.tags].join('||')

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

  const normalized = items
    .map((task): NormalizedTask => ({
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

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: items.length })
  }

  const existing = await prisma.task.findMany({
    where: { userId },
    select: { text: true, done: true, deadline: true, project: true, tags: true },
  })

  const existingSignatures = new Set(existing.map((task) => toSignature(task)))
  const payloadSignatures = new Set<string>()

  const data = normalized.filter((task) => {
    const signature = toSignature(task)
    if (existingSignatures.has(signature)) return false
    if (payloadSignatures.has(signature)) return false
    payloadSignatures.add(signature)
    return true
  })

  if (data.length > 0) {
    await prisma.task.createMany({ data })
  }

  return NextResponse.json({
    ok: true,
    imported: data.length,
    skipped: normalized.length - data.length,
  })
}
