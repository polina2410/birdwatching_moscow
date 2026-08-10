'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeRedirect } from '@/utils/safeRedirect'
import { RETURN_URL_PARAM, CALLBACK_URL_PARAM, REGISTERED_PARAM, HTTP_METHOD, JSON_HEADERS, LOGIN_CODE_PROVIDER_ID, ADMIN_2FA_PROVIDER_ID, LOGIN_CODE_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/constants'
import { AUTH_ERROR_ACCOUNT_BLOCKED, AUTH_ERROR_PASSWORD_RESET_REQUIRED } from '@/lib/auth/errors'
import { useAuthForm } from '@/hooks/useAuthForm'
import { useLooksLikeEmail } from '@/hooks/useLooksLikeEmail'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.login
const C = AUTH_LABELS.common
const LC = AUTH_LABELS.loginCode
const LA = AUTH_LABELS.adminPassword
const ASP = AUTH_LABELS.adminSetPassword

type LoginStep = 'email' | 'code' | 'password' | 'set-password'

function LoginCodeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeRedirect(
    searchParams.get(RETURN_URL_PARAM) ?? searchParams.get(CALLBACK_URL_PARAM)
  )
  const { error, setError, loading, run } = useAuthForm()
  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const showEmailSubmit = useLooksLikeEmail(emailInput)
  const [challengeToken, setChallengeToken] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const newPasswordInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (step === 'password') passwordInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (step === 'set-password') newPasswordInputRef.current?.focus()
  }, [step])

  const isRegistered = searchParams.get(REGISTERED_PARAM) === '1'

  async function requestCode(address: string) {
    await run(async () => {
      await fetch('/api/auth/request-login-code', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({ email: address }),
      })
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
      const verifyRes = await fetch('/api/auth/verify-login-code', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, code }),
      })
      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        setError(AUTH_ERRORS.invalidCode)
        return
      }

      if (verifyData.next === 'password') {
        setChallengeToken(verifyData.challengeToken)
        setStep('password')
        return
      }

      if (verifyData.next === 'set-password') {
        setChallengeToken(verifyData.challengeToken)
        setStep('set-password')
        return
      }

      // USER path: let the login-code provider do the full verification
      const result = await signIn(LOGIN_CODE_PROVIDER_ID, { email, code, redirect: false })
      if (result?.code === AUTH_ERROR_ACCOUNT_BLOCKED) {
        setError(AUTH_ERRORS.accountBlocked)
      } else if (result?.error) {
        setError(AUTH_ERRORS.invalidCode)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    })
  }

  async function handleSetPasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('newPassword') ?? '')
    const confirm = String(form.get('confirmPassword') ?? '')

    if (password !== confirm) {
      setError(ASP.mismatch)
      return
    }

    await run(async () => {
      const setRes = await fetch('/api/auth/set-initial-password', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({ email, challengeToken, password }),
      })
      if (!setRes.ok) {
        setError(AUTH_ERRORS.network)
        return
      }
      const setData = await setRes.json()

      const result = await signIn(ADMIN_2FA_PROVIDER_ID, {
        email,
        challengeToken: setData.challengeToken,
        password,
        redirect: false,
      })
      if (result?.code === AUTH_ERROR_ACCOUNT_BLOCKED) {
        setError(AUTH_ERRORS.accountBlocked)
      } else if (result?.code === AUTH_ERROR_PASSWORD_RESET_REQUIRED) {
        setError(AUTH_ERRORS.passwordResetRequired)
      } else if (result?.error) {
        setError(AUTH_ERRORS.wrongCredentials)
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    })
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')

    await run(async () => {
      const result = await signIn(ADMIN_2FA_PROVIDER_ID, {
        email,
        challengeToken,
        password,
        redirect: false,
      })
      if (result?.code === AUTH_ERROR_ACCOUNT_BLOCKED) {
        setError(AUTH_ERRORS.accountBlocked)
      } else if (result?.code === AUTH_ERROR_PASSWORD_RESET_REQUIRED) {
        setError(AUTH_ERRORS.passwordResetRequired)
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
      <h1>
        {step === 'password' ? LA.title : step === 'set-password' ? ASP.title : L.title}
      </h1>
      {isRegistered && step === 'email' && <p>{L.registered}</p>}

      {error && <p role="alert">{error}</p>}

      {step === 'email' && (
        <>
          <form onSubmit={handleEmailSubmit}>
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
            </div>
            {(showEmailSubmit || loading) && (
              <button type="submit" disabled={loading}>
                {loading ? LC.requesting : LC.requestCode}
              </button>
            )}
          </form>
          <Link href="/register">{L.registerLink}</Link>
        </>
      )}

      {step === 'code' && (
        <>
          <p id="code-sent-to">{LC.codeSentTo}</p>
          <form onSubmit={handleCodeSubmit}>
            <div>
              <label htmlFor="code">{LC.codeField}</label>
              <input
                ref={codeInputRef}
                id="code"
                name="code"
                type="text"
                required
                maxLength={LOGIN_CODE_LENGTH}
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="code-sent-to"
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

      {step === 'set-password' && (
        <form onSubmit={handleSetPasswordSubmit}>
          <div>
            <label htmlFor="newPassword">{ASP.passwordField}</label>
            <input
              ref={newPasswordInputRef}
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword">{ASP.confirmField}</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? ASP.submitting : ASP.submit}
          </button>
        </form>
      )}

      {step === 'password' && (
        <>
          <form onSubmit={handlePasswordSubmit}>
            <div>
              <label htmlFor="password">{C.passwordField}</label>
              <input
                ref={passwordInputRef}
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? LA.submitting : LA.submit}
            </button>
          </form>
          <Link href="/reset-password">{L.resetLink}</Link>
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