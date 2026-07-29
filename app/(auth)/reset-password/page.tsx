'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.resetRequest
const C = AUTH_LABELS.common

export default function RequestResetPage() {
  const { error, setError, loading, run } = useAuthForm()
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    await run(async () => {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email') }),
      })

      if (res.ok) {
        setSuccess(true)
        return
      }

      setError(AUTH_ERRORS.generic)
    })
  }

  if (success) {
    return (
      <main>
        <h1>{L.successTitle}</h1>
        <p>{L.successText}</p>
        <Link href="/login">{C.backToLogin}</Link>
      </main>
    )
  }

  return (
    <main>
      <h1>{L.title}</h1>
      <p>{L.description}</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">{C.emailField}</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? L.submitting : L.submit}
        </button>
      </form>
      <Link href="/login">{C.backToLogin}</Link>
    </main>
  )
}
