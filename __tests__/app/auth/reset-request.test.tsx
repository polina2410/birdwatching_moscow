import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RequestResetPage from '@/app/(auth)/reset-password/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

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
  it('renders email field and submit button', () => {
    render(<RequestResetPage />)
    expect(screen.getByLabelText(C.emailField)).toBeDefined()
    expect(screen.getByRole('button', { name: L.submit })).toBeDefined()
  })
})

describe('RequestResetPage — success', () => {
  it('shows success state after successful submission', async () => {
    (fetch as Mock).mockResolvedValue({ ok: true })
    render(<RequestResetPage />)
    fillAndSubmit()
    await waitFor(() => expect(screen.getByText(L.successText)).toBeDefined())
    expect(screen.getByRole('link', { name: C.backToLogin })).toBeDefined()
  })
})

describe('RequestResetPage — errors', () => {
  it('shows generic error on server failure', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, status: 500 })
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
