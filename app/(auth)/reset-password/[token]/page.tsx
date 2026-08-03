'use client'

import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'

const L = AUTH_LABELS.resetConfirm
const C = AUTH_LABELS.common

async function safeJsonParse<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

export default function ConfirmResetPage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const { error, setError, loading, run } = useAuthForm()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    await run(async () => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: params.token,
          newPassword: form.get('password'),
        }),
      })

      if (res.ok) {
        router.push('/login?passwordReset=1')
        return
      }

      const data = await safeJsonParse<{ error?: string }>(res)

      if (data?.error) {
        setError(data.error)
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
          <label htmlFor="password">{L.newPasswordField}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? L.submitting : L.submit}
        </button>
      </form>

      <Link href="/login">{C.backToLogin}</Link>
    </main>
  )
}
