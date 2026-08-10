import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RegisterPage from '@/app/(auth)/register/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_CONFLICT, HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@/lib/constants'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const L = AUTH_LABELS.register
const C = AUTH_LABELS.common

async function fillForm({ name = 'Иван', email = 'ivan@test.com' } = {}) {
  fireEvent.change(screen.getByLabelText(L.nameField), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(C.emailField), { target: { value: email } })
  await waitFor(() => screen.getByRole('button', { name: L.submit }))
  fireEvent.submit(screen.getByRole('button', { name: L.submit }))
}

beforeEach(() => {
  pushMock.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('RegisterPage — rendering (passwordless)', () => {
  it('renders name and email fields but NO password field', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(L.nameField)).toBeInTheDocument()
    expect(screen.getByLabelText(C.emailField)).toBeInTheDocument()
    expect(screen.queryByLabelText(C.passwordField)).toBeNull()
  })

  it('does not render submit button before a valid email is entered', () => {
    render(<RegisterPage />)
    expect(screen.queryByRole('button', { name: L.submit })).toBeNull()
  })

  it('renders login link', () => {
    render(<RegisterPage />)
    expect(screen.getByRole('link', { name: L.loginLink })).toHaveAttribute('href', '/login')
  })

  it('shows submit button after a valid email is typed', async () => {
    render(<RegisterPage />)
    fireEvent.change(screen.getByLabelText(C.emailField), { target: { value: 'ivan@test.com' } })
    await waitFor(() => expect(screen.getByRole('button', { name: L.submit })).toBeInTheDocument())
  })
})

describe('RegisterPage — success', () => {
  it('sends { email, name } (no password) and redirects to /login?registered=1', async () => {
    ;(fetch as Mock).mockResolvedValue({ ok: true })
    render(<RegisterPage />)
    await fillForm({ name: 'Мария', email: 'maria@test.com' })
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({ email: 'maria@test.com', name: 'Мария' }),
      })
      expect(pushMock).toHaveBeenCalledWith('/login?registered=1')
    })
  })

  it('request body does not contain a password key', async () => {
    ;(fetch as Mock).mockResolvedValue({ ok: true })
    render(<RegisterPage />)
    await fillForm()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const body = JSON.parse((fetch as Mock).mock.calls[0][1].body as string) as Record<string, unknown>
    expect('password' in body).toBe(false)
  })
})

describe('RegisterPage — errors', () => {
  it('shows email-taken error on 409', async () => {
    ;(fetch as Mock).mockResolvedValue({ ok: false, status: HTTP_STATUS_CONFLICT, json: async () => ({}) })
    render(<RegisterPage />)
    await fillForm()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.emailTaken)
    )
  })

  it('shows generic error on 500', async () => {
    ;(fetch as Mock).mockResolvedValue({ ok: false, status: HTTP_STATUS_INTERNAL_SERVER_ERROR, json: async () => ({}) })
    render(<RegisterPage />)
    await fillForm()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.generic)
    )
  })

  it('shows network error when fetch rejects', async () => {
    ;(fetch as Mock).mockRejectedValue(new Error('Network failure'))
    render(<RegisterPage />)
    await fillForm()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network)
    )
  })
})

describe('RegisterPage — loading state', () => {
  it('disables submit button while submitting', async () => {
    let resolve!: (v: unknown) => void
    ;(fetch as Mock).mockReturnValue(new Promise((r) => { resolve = r }))
    render(<RegisterPage />)
    await fillForm()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent(L.submitting)
    resolve({ ok: true })
    await waitFor(() => expect(pushMock).toHaveBeenCalled())
  })
})
