'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function RequestResetPage() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const res = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email') }),
    })

    setLoading(false)

    if (res.ok) {
      setSubmitted(true)
      return
    }

    setError('Something went wrong. Please try again.')
  }

  if (submitted) {
    return (
      <main>
        <h1>Check your email</h1>
        <p>If this email is registered, a reset link has been sent.</p>
        <Link href="/login">Back to log in</Link>
      </main>
    )
  }

  return (
    <main>
      <h1>Reset password</h1>
      <p>Enter your email address and we will send you a reset link.</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <Link href="/login">Back to log in</Link>
    </main>
  )
}