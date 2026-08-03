import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPasswordPage from '@/app/(auth)/login/password/page'
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

function fillAndSubmit({ email = 'admin@test.com', password = 'AdminPass1234567' } = {}) {
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

describe('LoginPasswordPage — rendering', () => {
  it('renders email and password fields', () => {
    render(<LoginPasswordPage />)
    expect(screen.getByLabelText(C.emailField)).toBeDefined()
    expect(screen.getByLabelText(C.passwordField)).toBeDefined()
  })

  it('renders a link to /reset-password', () => {
    render(<LoginPasswordPage />)
    expect(screen.getByRole('link', { name: L.resetLink })).toHaveAttribute('href', '/reset-password')
  })

  it('renders the password-reset banner when ?passwordReset=1', () => {
    searchParamsGetMock.mockImplementation((k: string) => (k === 'passwordReset' ? '1' : null))
    render(<LoginPasswordPage />)
    expect(screen.getByText(L.passwordReset)).toBeDefined()
  })
})

describe('LoginPasswordPage — success', () => {
  it('calls signIn("credentials") with email and password', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    render(<LoginPasswordPage />)
    fillAndSubmit({ email: 'admin@test.com', password: 'AdminPass1234567' })
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        email: 'admin@test.com',
        password: 'AdminPass1234567',
        redirect: false,
      })
    )
    expect(pushMock).toHaveBeenCalledWith('/')
  })
})

describe('LoginPasswordPage — errors', () => {
  it('CredentialsSignin → AUTH_ERRORS.wrongCredentials', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: null })
    render(<LoginPasswordPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.wrongCredentials)
    )
  })

  it('account_blocked → AUTH_ERRORS.accountBlocked', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: 'account_blocked' })
    render(<LoginPasswordPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.accountBlocked)
    )
  })

  it('password_reset_required → AUTH_ERRORS.passwordResetRequired', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: 'password_reset_required' })
    render(<LoginPasswordPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.passwordResetRequired)
    )
  })

  it('network error → AUTH_ERRORS.network', async () => {
    signInMock.mockRejectedValue(new Error('Network failure'))
    render(<LoginPasswordPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network)
    )
  })
})
