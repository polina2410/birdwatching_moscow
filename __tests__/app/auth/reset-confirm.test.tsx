import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConfirmResetPage from '@/app/(auth)/reset-password/[token]/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ token: 'valid-reset-token-123' }),
}))

const L = AUTH_LABELS.resetConfirm

function fillAndSubmit(password = 'newpassword123') {
  fireEvent.change(screen.getByLabelText(L.newPasswordField), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: L.submit }))
}

beforeEach(() => {
  pushMock.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('ConfirmResetPage — rendering', () => {
  it('renders new password field and submit button', () => {
    render(<ConfirmResetPage />)
    expect(screen.getByLabelText(L.newPasswordField)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: L.submit })).toBeInTheDocument()
  })
})

describe('ConfirmResetPage — success', () => {
  it('sends token and new password to API and redirects to /login?passwordReset=1', async () => {
    (fetch as Mock).mockResolvedValue({ ok: true })
    render(<ConfirmResetPage />)

    fillAndSubmit('mySecretPassword99')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-reset-token-123',
          newPassword: 'mySecretPassword99',
        }),
      })
      expect(pushMock).toHaveBeenCalledWith('/login?passwordReset=1')
    })
  })
})

describe('ConfirmResetPage — errors & loading', () => {
  it('disables submit button during submission', async () => {
    let resolvePromise!: (v: unknown) => void
    ;(fetch as Mock).mockReturnValue(new Promise((r) => { resolvePromise = r }))

    render(<ConfirmResetPage />)
    fillAndSubmit()

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(L.submitting)

    resolvePromise({ ok: true })
    await waitFor(() => expect(pushMock).toHaveBeenCalled())
  })

  it('shows error message from API response', async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: 'Ссылка устарела или недействительна.' }),
    })
    render(<ConfirmResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ссылка устарела или недействительна.')
    )
  })

  it('falls back to generic error when API returns no error message or non-JSON', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, text: async () => '' })
    render(<ConfirmResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.generic)
    )
  })

  it('shows network error when fetch throws', async () => {
    (fetch as Mock).mockRejectedValue(new Error('Network failure'))
    render(<ConfirmResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network)
    )
  })
})