'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeRedirect } from '@/utils/safeRedirect'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.login
const C = AUTH_LABELS.common

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeRedirect(
    searchParams.get('returnUrl') ?? searchParams.get('callbackUrl')
  )
  const { error, setError, loading, run } = useAuthForm()

  const isRegistered = searchParams.get('registered') === '1'
  const isPasswordReset = searchParams.get('passwordReset') === '1'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    await run(async () => {
      const result = await signIn('credentials', {
        email: form.get('email'),
        password: form.get('password'),
        redirect: false,
      })
      if (result?.code === 'account_blocked') {
        setError(AUTH_ERRORS.accountBlocked)
      } else if (result?.error) {
        setError(AUTH_ERRORS.wrongCredentials)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    })
  }

  return (
    <main>
      <h1>{L.title}</h1>
      {isRegistered && <p>{L.registered}</p>}
      {isPasswordReset && <p>{L.passwordReset}</p>}

      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">{C.emailField}</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">{C.passwordField}</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? L.submitting : L.submit}
        </button>
      </form>
      <Link href="/register">{L.registerLink}</Link>
      {' · '}
      <Link href="/reset-password">{L.resetLink}</Link>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}