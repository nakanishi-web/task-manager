import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'

type ImportTask = {
  text?: string
  done?: boolean
  deadline?: string
  project?: string
  tags?: string[]
}

type NormalizedTask = {
  title: string
  status: TaskStatus
  dueDate: Date | null
  project: string
  tagsJson: string
  sortOrder: number
  userId: string
}

const toSignature = (task: Pick<NormalizedTask, 'title' | 'status' | 'dueDate' | 'project' | 'tagsJson'>) =>
  [
    task.title,
    task.status,
    task.dueDate ? task.dueDate.toISOString().slice(0, 10) : '未設定',
    task.project,
    task.tagsJson,
  ].join('||')

const SESSION_COOKIE = 'taskflow_session'

const getSessionEmail = (request: Request) => {
  const cookie = request.headers.get('cookie') || ''
  const hasSessionCookie = cookie.split(';').some((item) => item.trim().startsWith(`${SESSION_COOKIE}=`))
  if (!hasSessionCookie) return null

  const email = request.headers.get('x-session-email')?.trim().toLowerCase()
  if (!email) return null
  return email
}

const getOrCreateUserId = async (email: string) => {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing.id

  try {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: 'local-auth-placeholder',
      },
    })
    return created.id
  } catch {
    const created = await prisma.user.findUnique({ where: { email } })
    if (!created) throw new Error('failed to create user')
    return created.id
  }
}

export async function POST(request: Request) {
  const sessionEmail = getSessionEmail(request)
  if (!sessionEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = await getOrCreateUserId(sessionEmail)

  const body = (await request.json()) as { tasks?: ImportTask[] }
  const items = Array.isArray(body.tasks) ? body.tasks : []

  if (items.length === 0) {
    return NextResponse.json({ ok: true, imported: 0 })
  }

  const normalized = items
    .map((task): NormalizedTask => ({
      title: (task.text || '').trim(),
      status: typeof task.done === 'boolean' && task.done ? TaskStatus.DONE : TaskStatus.ACTIVE,
      dueDate:
        typeof task.deadline === 'string' && task.deadline && task.deadline !== '未設定'
          ? new Date(`${task.deadline}T00:00:00.000Z`)
          : null,
      project: (task.project || '').trim() || '未分類',
      tagsJson: JSON.stringify(
        Array.isArray(task.tags) ? task.tags.map((tag) => tag.trim()).filter(Boolean) : []
      ),
      sortOrder: 0,
      userId,
    }))
    .filter((task) => task.title.length > 0)

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, skipped: items.length })
  }

  const existing = await prisma.task.findMany({
    where: { userId },
    select: { title: true, status: true, dueDate: true, project: true, tagsJson: true },
  })

  const existingSignatures = new Set(existing.map((task) => toSignature(task)))
  const payloadSignatures = new Set<string>()

  const deduplicated = normalized.filter((task) => {
    const signature = toSignature(task)
    if (existingSignatures.has(signature)) return false
    if (payloadSignatures.has(signature)) return false
    payloadSignatures.add(signature)
    return true
  })

  const maxSortOrder = await prisma.task.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  })

  let sortCursor = (maxSortOrder._max.sortOrder ?? -1) + 1
  const data = deduplicated.map((task) => {
    const withSort = { ...task, sortOrder: sortCursor }
    sortCursor += 1
    return withSort
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
