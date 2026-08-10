import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/(auth)/login/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_ERROR_ACCOUNT_BLOCKED, AUTH_ERROR_PASSWORD_RESET_REQUIRED } from '@/lib/auth/errors'
import { ADMIN_2FA_PROVIDER_ID, LOGIN_CODE_PROVIDER_ID } from '@/lib/constants'
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
const LA = AUTH_LABELS.adminPassword
const ASP = AUTH_LABELS.adminSetPassword

// Default fetch mock: request-login-code (step 1) passes through ok;
// verify-login-code (step 2) returns { next: 'session' } for the USER path.
function stubFetchForUser() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('verify-login-code')) {
      return Promise.resolve({ ok: true, json: async () => ({ next: 'session' }) })
    }
    return Promise.resolve({ ok: true })
  }))
}

function stubFetchForAdmin(challengeToken = 'tok123') {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('verify-login-code')) {
      return Promise.resolve({ ok: true, json: async () => ({ next: 'password', challengeToken }) })
    }
    return Promise.resolve({ ok: true })
  }))
}

function stubFetchForAdminNoPassword(verifyChallengeToken = 'tok123', newChallengeToken = 'newtoken456') {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('verify-login-code')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ next: 'set-password', challengeToken: verifyChallengeToken }),
      })
    }
    if (String(url).includes('set-initial-password')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ challengeToken: newChallengeToken }),
      })
    }
    return Promise.resolve({ ok: true })
  }))
}

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
  await waitFor(() => screen.getByRole('button', { name: LC.requestCode }))
  fireEvent.submit(screen.getByRole('button', { name: LC.requestCode }))
  await waitFor(() => screen.getByLabelText(LC.codeField))
}

describe('LoginPage — step 2 (code entry)', () => {
  beforeEach(stubFetchForUser)

  it('shows code field and no email field after step-1 submit', async () => {
    await submitEmail()
    expect(screen.getByLabelText(LC.codeField)).toBeDefined()
    expect(screen.queryByLabelText(C.emailField)).toBeNull()
  })

  it('does not show a password field on step 2', async () => {
    await submitEmail()
    expect(screen.queryByLabelText(C.passwordField)).toBeNull()
  })

  it('calls signIn("login-code") with email and code when verify returns { next:"session" }', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await submitEmail('user@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith(LOGIN_CODE_PROVIDER_ID, {
        email: 'user@test.com',
        code: 'ABCD2F',
        redirect: false,
      })
    )
  })

  it('redirects to "/" on successful USER login', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await submitEmail()
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })
})

// ── Step 2 → password step (admin path) ────────────────────────────────────

describe('LoginPage — admin path: verify returns { next:"password" }', () => {
  beforeEach(() => stubFetchForAdmin())

  it('shows password field and hides code field', async () => {
    await submitEmail('admin@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => screen.getByLabelText(C.passwordField))
    expect(screen.queryByLabelText(LC.codeField)).toBeNull()
  })

  it('does NOT call signIn("login-code") when advancing to password step', async () => {
    await submitEmail('admin@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => screen.getByLabelText(C.passwordField))
    expect(signInMock).not.toHaveBeenCalled()
  })
})

// ── Step 3: password (admin only) ───────────────────────────────────────────

async function advanceToPasswordStep(email = 'admin@test.com', challengeToken = 'tok123') {
  stubFetchForAdmin(challengeToken)
  await submitEmail(email)
  fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
  fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
  await waitFor(() => screen.getByLabelText(C.passwordField))
}

describe('LoginPage — step 3 (admin password)', () => {
  it('calls signIn("admin-2fa") with email, challengeToken, and password', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await advanceToPasswordStep('admin@test.com', 'tok123')
    fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: 'AdminPass123!' } })
    fireEvent.submit(screen.getByRole('button', { name: LA.submit }))
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith(ADMIN_2FA_PROVIDER_ID, {
        email: 'admin@test.com',
        challengeToken: 'tok123',
        password: 'AdminPass123!',
        redirect: false,
      })
    )
  })

  it('redirects to "/" on success', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await advanceToPasswordStep()
    fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: 'pass' } })
    fireEvent.submit(screen.getByRole('button', { name: LA.submit }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })

  it('password_reset_required → AUTH_ERRORS.passwordResetRequired', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: AUTH_ERROR_PASSWORD_RESET_REQUIRED })
    await advanceToPasswordStep()
    fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: 'pass' } })
    fireEvent.submit(screen.getByRole('button', { name: LA.submit }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.passwordResetRequired)
    )
  })

  it('account_blocked → AUTH_ERRORS.accountBlocked', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: AUTH_ERROR_ACCOUNT_BLOCKED })
    await advanceToPasswordStep()
    fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: 'pass' } })
    fireEvent.submit(screen.getByRole('button', { name: LA.submit }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.accountBlocked)
    )
  })

  it('wrong password → AUTH_ERRORS.wrongCredentials', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: null })
    await advanceToPasswordStep()
    fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: 'wrong' } })
    fireEvent.submit(screen.getByRole('button', { name: LA.submit }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.wrongCredentials)
    )
  })
})

// ── Step 2 → set-password step (admin first login) ─────────────────────────

describe('LoginPage — admin first login: verify returns { next:"set-password" }', () => {
  beforeEach(() => stubFetchForAdminNoPassword())

  it('shows set-password step and hides code field', async () => {
    await submitEmail('admin@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => screen.getByLabelText(ASP.passwordField))
    expect(screen.queryByLabelText(LC.codeField)).toBeNull()
  })

  it('also shows a confirm-password field', async () => {
    await submitEmail('admin@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => screen.getByLabelText(ASP.confirmField))
  })

  it('does NOT call signIn when advancing to set-password step', async () => {
    await submitEmail('admin@test.com')
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() => screen.getByLabelText(ASP.passwordField))
    expect(signInMock).not.toHaveBeenCalled()
  })
})

// ── Step set-password: submit (admin first login) ───────────────────────────

async function advanceToSetPasswordStep(email = 'admin@test.com') {
  stubFetchForAdminNoPassword()
  await submitEmail(email)
  fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
  fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
  await waitFor(() => screen.getByLabelText(ASP.passwordField))
}

describe('LoginPage — set-password step (admin first login)', () => {
  it('shows mismatch error when passwords do not match', async () => {
    await advanceToSetPasswordStep()
    fireEvent.change(screen.getByLabelText(ASP.passwordField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.change(screen.getByLabelText(ASP.confirmField), { target: { value: 'bbbbbbbbbbbbbbbb' } })
    fireEvent.submit(screen.getByRole('button', { name: ASP.submit }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(ASP.mismatch)
    )
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('calls set-initial-password then signIn("admin-2fa") with the returned challengeToken', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await advanceToSetPasswordStep()
    fireEvent.change(screen.getByLabelText(ASP.passwordField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.change(screen.getByLabelText(ASP.confirmField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.submit(screen.getByRole('button', { name: ASP.submit }))
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith(ADMIN_2FA_PROVIDER_ID, {
        email: 'admin@test.com',
        challengeToken: 'newtoken456',
        password: 'aaaaaaaaaaaaaaaa',
        redirect: false,
      })
    )
  })

  it('redirects to "/" on success', async () => {
    signInMock.mockResolvedValue({ error: null, code: null })
    await advanceToSetPasswordStep()
    fireEvent.change(screen.getByLabelText(ASP.passwordField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.change(screen.getByLabelText(ASP.confirmField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.submit(screen.getByRole('button', { name: ASP.submit }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
  })

  it('account_blocked → AUTH_ERRORS.accountBlocked', async () => {
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: AUTH_ERROR_ACCOUNT_BLOCKED })
    await advanceToSetPasswordStep()
    fireEvent.change(screen.getByLabelText(ASP.passwordField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.change(screen.getByLabelText(ASP.confirmField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.submit(screen.getByRole('button', { name: ASP.submit }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.accountBlocked)
    )
  })

  it('signIn error → AUTH_ERRORS.wrongCredentials', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: null })
    await advanceToSetPasswordStep()
    fireEvent.change(screen.getByLabelText(ASP.passwordField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.change(screen.getByLabelText(ASP.confirmField), { target: { value: 'aaaaaaaaaaaaaaaa' } })
    fireEvent.submit(screen.getByRole('button', { name: ASP.submit }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.wrongCredentials)
    )
  })
})

// ── Error handling (step 2, USER path) ─────────────────────────────────────

describe('LoginPage — errors (step 2)', () => {
  beforeEach(stubFetchForUser)

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
    signInMock.mockResolvedValue({ error: 'AccessDenied', code: AUTH_ERROR_ACCOUNT_BLOCKED })
    await submitEmail()
    fireEvent.change(screen.getByLabelText(LC.codeField), { target: { value: 'ABCD2F' } })
    fireEvent.submit(screen.getByRole('button', { name: LC.verify }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.accountBlocked)
    )
  })
})