"use client"
import Link from "next/link"
import { useEffect, useState } from "react"

type SessionUser = {
  id: string
  email: string
  name?: string | null
} | null

export default function AuthStatus() {
  const [user, setUser] = useState<SessionUser>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth'
  }

  if (loading) {
    return <span className="text-gray-600">読み込み中...</span>
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">こんにちは、{user.name || user.email}</span>
        <button
          onClick={handleLogout}
          className="h-9 px-3 rounded-full border bg-white text-gray-700 hover:bg-gray-100"
        >
          ログアウト
        </button>
      </div>
    )
  }

  return (
    <Link
      href="/auth"
      className="ml-4 h-9 px-3 rounded-full border bg-white text-gray-700 hover:bg-gray-100"
    >
      サインイン
    </Link>
  )
}
