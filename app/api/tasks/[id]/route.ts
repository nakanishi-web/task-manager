import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'

type UpdateTaskBody = {
  text?: string
  done?: boolean
  deadline?: string
  project?: string
  tags?: string[]
}

const mapTask = (task: {
  id: string
  title: string
  status: TaskStatus
  dueDate: Date | null
  project: string
  tagsJson: string
  sortOrder: number
}) => ({
  id: task.id,
  text: task.title,
  done: task.status === TaskStatus.DONE,
  deadline: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : '未設定',
  project: task.project,
  tags: (() => {
    try {
      const parsed = JSON.parse(task.tagsJson) as unknown
      return Array.isArray(parsed)
        ? parsed.filter((tag): tag is string => typeof tag === 'string')
        : []
    } catch {
      return []
    }
  })(),
  sortOrder: task.sortOrder,
})

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionEmail = getSessionEmail(request)
  if (!sessionEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = await getOrCreateUserId(sessionEmail)

  const { id } = await context.params
  const body = (await request.json()) as UpdateTaskBody

  const existing = await prisma.task.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: body.text?.trim() || existing.title,
      status: typeof body.done === 'boolean'
        ? (body.done ? TaskStatus.DONE : TaskStatus.ACTIVE)
        : existing.status,
      dueDate: typeof body.deadline === 'string'
        ? (body.deadline && body.deadline !== '未設定'
            ? new Date(`${body.deadline}T00:00:00.000Z`)
            : null)
        : existing.dueDate,
      project: body.project?.trim() || existing.project,
      tagsJson: Array.isArray(body.tags)
        ? JSON.stringify(body.tags.map((tag) => tag.trim()).filter(Boolean))
        : existing.tagsJson,
    },
  })

  return NextResponse.json({ task: mapTask(task) })
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessionEmail = getSessionEmail(request)
  if (!sessionEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = await getOrCreateUserId(sessionEmail)

  const { id } = await context.params
  const existing = await prisma.task.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
