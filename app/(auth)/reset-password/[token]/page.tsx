'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ConfirmResetPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: params.token,
        newPassword: form.get('newPassword'),
      }),
    })

    setLoading(false)

    if (res.ok) {
      router.push('/login?passwordReset=1')
      return
    }

    const data = await res.json()
    setError(data.error ?? 'Something went wrong. Please try again.')
  }

  return (
    <main>
      <h1>Set new password</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="newPassword">New password</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </main>
  )
}