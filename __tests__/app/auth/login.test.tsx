import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/(auth)/login/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const { pushMock, refreshMock, searchParamsGetMock, signInMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  searchParamsGetMock: vi.fn(),
  signInMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => ({ get: searchParamsGetMock }),
}))
vi.mock('next-auth/react', () => ({ signIn: signInMock }))
vi.mock('@/utils/safeRedirect', () => ({ safeRedirect: (url: string | null) => url ?? '/' }))

const L = AUTH_LABELS.login
const C = AUTH_LABELS.common

function fillAndSubmit({ email = 'ivan@test.com', password = 'password123' } = {}) {
  fireEvent.change(screen.getByLabelText(C.emailField), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: L.submit }))
}

beforeEach(() => {
  pushMock.mockReset()
  refreshMock.mockReset()
  signInMock.mockReset()
  searchParamsGetMock.mockReturnValue(null)
})

describe('LoginPage — rendering & links', () => {
  it('renders email, password fields, submit button, and navigation links', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(C.emailField)).toBeDefined()
    expect(screen.getByLabelText(C.passwordField)).toBeDefined()
    expect(screen.getByRole('button', { name: L.submit })).toBeDefined()

    expect(screen.getByRole('link', { name: L.registerLink })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: L.resetLink })).toHaveAttribute('href', '/reset-password')
  })

  it('shows registered success banner when ?registered=1', () => {
    searchParamsGetMock.mockImplementation((key: string) => (key === 'registered' ? '1' : null))
    render(<LoginPage />)
    expect(screen.getByText(L.registered)).toBeDefined()
  })

  it('does not show registered banner when ?registered=0 or other values', () => {
    searchParamsGetMock.mockImplementation((key: string) => (key === 'registered' ? '0' : null))
    render(<LoginPage />)
    expect(screen.queryByText(L.registered)).toBeNull()
  })

  it('shows password-reset banner when ?passwordReset=1', () => {
    searchParamsGetMock.mockImplementation((key: string) => (key === 'passwordReset' ? '1' : null))
    render(<LoginPage />)
    expect(screen.getByText(L.passwordReset)).toBeDefined()
  })

  it('does not show password-reset banner when ?passwordReset=0 or other values', () => {
    searchParamsGetMock.mockImplementation((key: string) => (key === 'passwordReset' ? '0' : null))
    render(<LoginPage />)
    expect(screen.queryByText(L.passwordReset)).toBeNull()
  })
})

describe('LoginPage — success & navigation', () => {
  it('passes typed credentials to signIn and redirects to default root route', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    render(<LoginPage />)

    fillAndSubmit({ email: 'user@example.com', password: 'customPassword123' })

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        email: 'user@example.com',
        password: 'customPassword123',
        redirect: false,
      })
      expect(pushMock).toHaveBeenCalledWith('/')
    })
    expect(refreshMock).toHaveBeenCalled()
  })

  it('redirects to returnUrl when present in query params', async () => {
    searchParamsGetMock.mockImplementation((key: string) => (key === 'returnUrl' ? '/dashboard' : null))
    signInMock.mockResolvedValue({ error: null, code: null })

    render(<LoginPage />)
    fillAndSubmit()

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard')
    })
    expect(refreshMock).toHaveBeenCalled()
  })

  it('disables submit button and shows loading text during submission', async () => {
    let resolveSignIn!: (val: unknown) => void
    signInMock.mockImplementation(() => new Promise((res) => { resolveSignIn = res }))

    render(<LoginPage />)
    fillAndSubmit()

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(L.submitting)

    resolveSignIn({ error: null, code: null })
  })
})

describe('LoginPage — errors', () => {
  it('shows wrong-credentials error', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: null })
    render(<LoginPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.wrongCredentials)
    )
  })

  it('shows account-blocked error', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: 'account_blocked' })
    render(<LoginPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.accountBlocked)
    )
  })

  it('shows network error when signIn throws', async () => {
    signInMock.mockRejectedValue(new Error('Network failure'))
    render(<LoginPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network)
    )
  })
})