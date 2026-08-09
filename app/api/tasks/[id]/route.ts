import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUserId } from '@/lib/session'

type UpdateTaskBody = {
  text?: string
  done?: boolean
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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(request.headers.get('cookie'))
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const body = (await request.json()) as UpdateTaskBody

  const existing = await prisma.task.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      text: body.text?.trim() || existing.text,
      done: typeof body.done === 'boolean' ? body.done : existing.done,
      deadline: body.deadline || existing.deadline,
      project: body.project?.trim() || existing.project,
      tags: Array.isArray(body.tags)
        ? body.tags.map((tag) => tag.trim()).filter(Boolean).join(',')
        : existing.tags,
    },
  })

  return NextResponse.json({ task: mapTask(task) })
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(request.headers.get('cookie'))
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const existing = await prisma.task.findFirst({ where: { id, userId } })
  if (!existing) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
