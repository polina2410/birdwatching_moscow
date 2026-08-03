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
const LC = AUTH_LABELS.loginCode

beforeEach(() => {
  pushMock.mockReset()
  refreshMock.mockReset()
  signInMock.mockReset()
  searchParamsGetMock.mockReturnValue(null)
})

// ── Step 1: email entry ─────────────────────────────────────────────────────

describe('LoginPage — step 1 (email)', () => {
  it('renders an email field', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(C.emailField)).toBeDefined()
  })

  it('does not render a password field on step 1', () => {
    render(<LoginPage />)
    expect(screen.queryByLabelText(C.passwordField)).toBeNull()
  })

  it('renders a link to /login/password for admins', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: LC.passwordLoginLink })).toHaveAttribute(
      'href',
      '/login/password'
    )
  })

  it('does NOT render a link to /reset-password', () => {
    render(<LoginPage />)
    expect(screen.queryByRole('link', { name: L.resetLink })).toBeNull()
  })

  it('shows ?registered=1 banner', () => {
    searchParamsGetMock.mockImplementation((k: string) => (k === 'registered' ? '1' : null))
    render(<LoginPage />)
    expect(screen.getByText(L.registered)).toBeDefined()
  })
})

// ── Step 2: code entry ──────────────────────────────────────────────────────

async function submitEmail(email = 'user@test.com') {
  render(<LoginPage />)
  fireEvent.change(screen.getByLabelText(C.emailField), { target: { value: email } })
  fireEvent.submit(screen.getByRole('button', { name: LC.requestCode }))
  // Wait for step 2 to appear (code input)
  await waitFor(() => screen.getByLabelText(LC.codeField))
}

describe('LoginPage — step 2 (code entry)', () => {
  beforeEach(() => {
    // Step 1 API call succeeds (endpoint returns ok: true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  it('shows code field and no email field after step-1 submit', async () => {
    await submitEmail()
    expect(screen.getByLabelText(LC.codeField)).toBeDefined()
    expect(screen.queryByLabelText(C.emailField)).toBeNull()
  })

  it('calls signIn("login-code") with email and code on step-2 submit', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await submitEmail('user@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith('login-code', {
        email: 'user@test.com',
        code: 'ABCD2F',
        redirect: false,
      })
    )
  })

  it('redirects to "/" on success', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await submitEmail()
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })
})

// ── Error handling (step 2) ─────────────────────────────────────────────────

describe('LoginPage — errors', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  it('CredentialsSignin error → AUTH_ERRORS.invalidCode', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: null })
    await submitEmail()
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'WRONG1' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.invalidCode)
    )
  })

  it('account_blocked code → AUTH_ERRORS.accountBlocked', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: 'account_blocked' })
    await submitEmail()
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.accountBlocked)
    )
  })
})
