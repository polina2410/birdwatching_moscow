'use client'

import { useRouter, useParams } from 'next/navigation'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.resetConfirm

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
          newPassword: form.get('newPassword'),
        }),
      })

      if (res.ok) {
        router.push('/login?passwordReset=1')
        return
      }

      const data = await res.json()
      setError(data.error ?? AUTH_ERRORS.generic)
    })
  }

  return (
    <main>
      <h1>{L.title}</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="newPassword">{L.newPasswordField}</label>
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
          {loading ? L.submitting : L.submit}
        </button>
      </form>
    </main>
  )
}
