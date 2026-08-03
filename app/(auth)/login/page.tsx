'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeRedirect } from '@/utils/safeRedirect'
import { maskEmail } from '@/utils/maskEmail'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.login
const C = AUTH_LABELS.common
const LC = AUTH_LABELS.loginCode

type Step = 'email' | 'code'

// Passwordless sign-in for regular accounts: email → one-time code.
// Staff keep the password form at /login/password.
function LoginCodeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeRedirect(
    searchParams.get('returnUrl') ?? searchParams.get('callbackUrl')
  )
  const { error, setError, loading, run } = useAuthForm()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  const isRegistered = searchParams.get('registered') === '1'

  async function requestCode(address: string) {
    await run(async () => {
      await fetch('/api/auth/request-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      })
      // The endpoint answers identically for every address, so the form always
      // advances — anything else would reveal which emails are registered.
      setEmail(address)
      setStep('code')
    })
  }

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await requestCode(String(form.get('email') ?? ''))
  }

  async function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const code = String(form.get('code') ?? '')

    await run(async () => {
      const result = await signIn('login-code', { email, code, redirect: false })
      if (result?.code === 'account_blocked') {
        setError(AUTH_ERRORS.accountBlocked)
      } else if (result?.error) {
        // One message for wrong / expired / used / attempts-exhausted
        setError(AUTH_ERRORS.invalidCode)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    })
  }

  return (
    <main>
      <h1>{L.title}</h1>
      {isRegistered && step === 'email' && <p>{L.registered}</p>}

      {error && <p role="alert">{error}</p>}

      {step === 'email' ? (
        <>
          <form onSubmit={handleEmailSubmit}>
            <div>
              <label htmlFor="email">{C.emailField}</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? LC.requesting : LC.requestCode}
            </button>
          </form>
          <Link href="/register">{L.registerLink}</Link>
          {' · '}
          <Link href="/login/password">{LC.passwordLoginLink}</Link>
        </>
      ) : (
        <>
          <p>
            {LC.codeSentTo} {maskEmail(email)}
          </p>
          <form onSubmit={handleCodeSubmit}>
            <div>
              <label htmlFor="code">{LC.codeField}</label>
              <input
                id="code"
                name="code"
                type="text"
                required
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? LC.verifying : LC.verify}
            </button>
          </form>
          <button type="button" onClick={() => requestCode(email)} disabled={loading}>
            {LC.resendCode}
          </button>
          {' · '}
          <button type="button" onClick={() => setStep('email')} disabled={loading}>
            {LC.changeEmail}
          </button>
        </>
      )}
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCodeForm />
    </Suspense>
  )
}
