'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })
    setLoading(false)
    if (result?.code === 'account_blocked') {
      setError('Ваш аккаунт заблокирован. Обратитесь к администратору.')
    } else if (result?.error) {
      setError('Invalid email or password')
    } else {
      router.push(callbackUrl)
      router.refresh()
    }
  }

  return (
    <main>
      <h1>Log in</h1>
      {searchParams.get('registered') && <p>Registration successful, please log in.</p>}
      {searchParams.get('passwordReset') && <p>Password updated, please log in.</p>}
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <Link href="/register">Create an account</Link>
      {' · '}
      <Link href="/reset-password">Forgot password?</Link>
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