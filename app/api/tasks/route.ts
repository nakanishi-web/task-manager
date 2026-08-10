import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'

type CreateTaskBody = {
  text?: string
  done?: boolean
  deadline?: string
  project?: string
  tags?: string[]
  sortOrder?: number
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

const getOrCreateUser = async (email: string) => {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing

  try {
    return await prisma.user.create({
      data: {
        email,
        // Temporary placeholder for local auth migration phase.
        passwordHash: 'local-auth-placeholder',
      },
    })
  } catch {
    const created = await prisma.user.findUnique({ where: { email } })
    if (!created) throw new Error('failed to create user')
    return created
  }
}

export async function GET(request: Request) {
  const sessionEmail = getSessionEmail(request)
  if (!sessionEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const user = await getOrCreateUser(sessionEmail)

  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ tasks: tasks.map(mapTask) })
}

export async function POST(request: Request) {
  const sessionEmail = getSessionEmail(request)
  if (!sessionEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const user = await getOrCreateUser(sessionEmail)

  const body = (await request.json()) as CreateTaskBody
  const text = body.text?.trim() || ''
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  const maxSortOrder = await prisma.task.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  })

  const nextSortOrder =
    typeof body.sortOrder === 'number'
      ? body.sortOrder
      : (maxSortOrder._max.sortOrder ?? -1) + 1

  const dueDate = body.deadline && body.deadline !== '未設定'
    ? new Date(`${body.deadline}T00:00:00.000Z`)
    : null

  const task = await prisma.task.create({
    data: {
      title: text,
      status: body.done ? TaskStatus.DONE : TaskStatus.ACTIVE,
      dueDate,
      project: body.project?.trim() || '未分類',
      tagsJson: JSON.stringify(
        Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean) : []
      ),
      sortOrder: nextSortOrder,
      userId: user.id,
    },
  })

  return NextResponse.json({ task: mapTask(task) }, { status: 201 })
}
