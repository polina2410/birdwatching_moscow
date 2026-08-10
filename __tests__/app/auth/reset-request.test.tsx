import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RequestResetPage from '@/app/(auth)/reset-password/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@/lib/constants'

const L = AUTH_LABELS.resetRequest
const C = AUTH_LABELS.common

function fillAndSubmit(email = 'ivan@test.com') {
  fireEvent.change(screen.getByLabelText(C.emailField), { target: { value: email } })
  fireEvent.submit(screen.getByRole('button', { name: L.submit }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('RequestResetPage — rendering', () => {
  it('renders title, description, email field, submit button, and back link', () => {
    render(<RequestResetPage />)
    expect(screen.getByRole('heading', { level: 1, name: L.title })).toBeInTheDocument()
    expect(screen.getByText(L.description)).toBeInTheDocument()
    expect(screen.getByLabelText(C.emailField)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: L.submit })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: C.backToLogin })).toHaveAttribute('href', '/login')
  })
})

describe('RequestResetPage — success', () => {
  it('sends email payload to endpoint and shows success state', async () => {
    (fetch as Mock).mockResolvedValue({ ok: true })
    render(<RequestResetPage />)

    fillAndSubmit('user@example.com')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/request-password-reset', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({ email: 'user@example.com' }),
      })
      expect(screen.getByRole('heading', { level: 1, name: L.successTitle })).toBeInTheDocument()
      expect(screen.getByText(L.successText)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: C.backToLogin })).toHaveAttribute('href', '/login')
    })
  })
})

describe('RequestResetPage — errors & loading', () => {
  it('disables submit button and shows submitting state while loading', async () => {
    let resolvePromise!: (v: unknown) => void
    ;(fetch as Mock).mockReturnValue(new Promise((r) => { resolvePromise = r }))

    render(<RequestResetPage />)
    fillAndSubmit()

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(L.submitting)

    resolvePromise({ ok: true })
    await waitFor(() => expect(screen.getByText(L.successText)).toBeInTheDocument())
  })

  it('shows generic error on server failure', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, status: HTTP_STATUS_INTERNAL_SERVER_ERROR })
    render(<RequestResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.generic)
    )
  })

  it('shows network error when fetch throws', async () => {
    (fetch as Mock).mockRejectedValue(new Error('Network failure'))
    render(<RequestResetPage />)
    fillAndSubmit()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network)
    )
  })
})