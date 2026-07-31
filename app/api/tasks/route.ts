import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUserId } from '@/lib/session'

type CreateTaskBody = {
  text?: string
  deadline?: string
  project?: string
  tags?: string[]
}

const mapTask = (task: {
  id: string
  text: string
  done: boolean
  deadline: string
  project: string
  tags: string
}) => ({
  id: task.id,
  text: task.text,
  done: task.done,
  deadline: task.deadline,
  project: task.project,
  tags: task.tags ? task.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
})

export async function GET(request: Request) {
  const userId = getSessionUserId(request.headers.get('cookie'))
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ tasks: tasks.map(mapTask) })
}

export async function POST(request: Request) {
  const userId = getSessionUserId(request.headers.get('cookie'))
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as CreateTaskBody
  const text = body.text?.trim() || ''
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      text,
      deadline: body.deadline || '未設定',
      project: body.project?.trim() || '未分類',
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean).join(',') : '',
      userId,
    },
  })

  return NextResponse.json({ task: mapTask(task) }, { status: 201 })
}
