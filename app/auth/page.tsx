"use client"
import { useState } from 'react'

export default function AuthPage() {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  type AuthRequestBody = {
    email: string
    password: string
    name?: string
  }

  const submit = async () => {
    const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body: AuthRequestBody = { email, password }
    if (mode === 'register') body.name = name

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (res.ok) {
      setMessage('OK')
      window.location.href = '/'
    } else {
      setMessage(json.error || 'error')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">{mode === 'login' ? 'サインイン' : '新規登録'}</h2>
        {mode === 'register' && (
          <label className="block mb-2">
            名前
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
          </label>
        )}
        <label className="block mb-2">
          メール
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <label className="block mb-4">
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <div className="flex gap-2">
          <button onClick={submit} className="bg-blue-600 text-white px-4 py-2 rounded">送信</button>
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="px-4 py-2 rounded border">{mode === 'login' ? '新規登録' : 'サインインへ'}</button>
        </div>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>
    </main>
  )
}
