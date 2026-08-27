'use client'

import Link from 'next/link'
import { useRef, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLooksLikeEmail } from '@/hooks/useLooksLikeEmail'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_CONFLICT, LOGIN_CODE_LENGTH, LOGIN_CODE_PROVIDER_ID } from '@/lib/constants'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const L = AUTH_LABELS.register
const C = AUTH_LABELS.common

export default function RegisterPage() {
  const router = useRouter()
  const { error, setError, loading, run } = useAuthForm()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  const showSubmit = useLooksLikeEmail(emailInput)
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus()
  }, [step])

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    const form = new FormData(e.currentTarget)
    const submittedEmail = String(form.get('email') ?? '')
    const submittedName = String(form.get('name') ?? '')

    await run(async () => {
      const res = await fetch('/api/auth/register', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({ email: submittedEmail, name: submittedName }),
      })

      if (res.status === HTTP_STATUS_CONFLICT) {
        setError(AUTH_ERRORS.emailTaken)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (data?.issues) {
          setFieldErrors(data.issues)
        } else {
          setError(AUTH_ERRORS.generic)
        }
        return
      }

      const data = await res.json()
      setCsrfToken(data.csrfToken ?? '')
      setEmail(submittedEmail)
      setName(submittedName)
      setStep('code')
    })
  }

  async function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const code = String(form.get('code') ?? '')

    await run(async () => {
      const verifyRes = await fetch('/api/auth/verify-registration-code', {
        method: HTTP_METHOD.POST,
        headers: { ...JSON_HEADERS, 'x-csrf-token': csrfToken },
        body: JSON.stringify({ email, code, name }),
      })

      if (!verifyRes.ok) {
        setError(AUTH_ERRORS.invalidCode)
        return
      }

      const result = await signIn(LOGIN_CODE_PROVIDER_ID, { email, code, redirect: false })
      if (result?.error) {
        setError(AUTH_ERRORS.invalidCode)
      } else {
        router.push('/profile')
        router.refresh()
      }
    })
  }

  return (
    <main>
      <h1>{step === 'code' ? L.confirmTitle : L.title}</h1>
      {error && <p role="alert">{error}</p>}

      {step === 'form' && (
        <>
          <form onSubmit={handleFormSubmit}>
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
        </>
      )}

      {step === 'code' && (
        <>
          <p id="code-sent-to">{L.codeSentTo} {email}</p>
          <form onSubmit={handleCodeSubmit}>
            <div>
              <label htmlFor="code">{L.codeField}</label>
              <input
                ref={codeInputRef}
                id="code"
                name="code"
                type="text"
                required
                maxLength={LOGIN_CODE_LENGTH}
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                aria-describedby="code-sent-to"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? L.verifying : L.verify}
            </button>
          </form>
          <button type="button" onClick={() => setStep('form')} disabled={loading}>
            {L.changeEmail}
          </button>
        </>
      )}
    </main>
  )
}
