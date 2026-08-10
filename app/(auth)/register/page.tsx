'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLooksLikeEmail } from '@/hooks/useLooksLikeEmail'
import { HTTP_METHOD, JSON_HEADERS, REGISTERED_PARAM, HTTP_STATUS_CONFLICT } from '@/lib/constants'
import { useRouter } from 'next/navigation'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.register
const C = AUTH_LABELS.common

async function safeJsonParse<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

export default function RegisterPage() {
  const router = useRouter()
  const { error, setError, loading, run } = useAuthForm()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [emailInput, setEmailInput] = useState('')
  const showSubmit = useLooksLikeEmail(emailInput)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    const form = new FormData(e.currentTarget)

    await run(async () => {
      const res = await fetch('/api/auth/register', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          email: form.get('email'),
          name: form.get('name'),
        }),
      })

      if (res.ok) {
        router.push(`/login?${REGISTERED_PARAM}=1`)
        return
      }

      const data = await safeJsonParse<{ issues?: Record<string, string[]> }>(res)

      if (res.status === HTTP_STATUS_CONFLICT) {
        setError(AUTH_ERRORS.emailTaken)
      } else if (data?.issues) {
        setFieldErrors(data.issues)
      } else {
        setError(AUTH_ERRORS.generic)
      }
    })
  }

  return (
    <main>
      <h1>{L.title}</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">{L.nameField}</label>
          <input id="name" name="name" type="text" required autoComplete="name" />
          {fieldErrors.name && <span role="alert">{fieldErrors.name.join(', ')}</span>}
        </div>
        <div>
          <label htmlFor="email">{C.emailField}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            onChange={(e) => setEmailInput(e.target.value)}
          />
          {fieldErrors.email && <span role="alert">{fieldErrors.email.join(', ')}</span>}
        </div>
        {(showSubmit || loading) && (
          <button type="submit" disabled={loading}>
            {loading ? L.submitting : L.submit}
          </button>
        )}
      </form>
      <Link href="/login">{L.loginLink}</Link>
    </main>
  )
}