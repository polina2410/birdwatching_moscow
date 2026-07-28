import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConfirmResetPage from '@/app/(auth)/reset-password/[token]/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ token: 'valid-token' }),
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
    expect(screen.getByLabelText(L.newPasswordField)).toBeDefined()
    expect(screen.getByRole('button', { name: L.submit })).toBeDefined()
  })
})

describe('ConfirmResetPage — success', () => {
  it('redirects to /login?passwordReset=1 on success', async () => {
    (fetch as Mock).mockResolvedValue({ ok: true })
    render(<ConfirmResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/login?passwordReset=1')
    )
  })
})

describe('ConfirmResetPage — errors', () => {
  it('shows error message from API response', async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Ссылка устарела или недействительна.' }),
    })
    render(<ConfirmResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ссылка устарела или недействительна.')
    )
  })

  it('falls back to generic error when API returns no error message', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, json: async () => ({}) })
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
