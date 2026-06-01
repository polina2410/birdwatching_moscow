'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
        name: form.get('name'),
      }),
    })

    setLoading(false)

    if (res.ok) {
      router.push('/login?registered=1')
      return
    }

    const data = await res.json()
    if (res.status === 409) {
      setError('This email is already registered.')
    } else if (data.issues) {
      setFieldErrors(data.issues)
    } else {
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <main>
      <h1>Create an account</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required autoComplete="name" />
          {fieldErrors.name && <span role="alert">{fieldErrors.name.join(', ')}</span>}
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          {fieldErrors.email && <span role="alert">{fieldErrors.email.join(', ')}</span>}
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} />
          {fieldErrors.password && <span role="alert">{fieldErrors.password.join(', ')}</span>}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <Link href="/login">Already have an account? Log in</Link>
    </main>
  )
}