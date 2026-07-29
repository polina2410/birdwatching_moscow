import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RegisterPage from '@/app/(auth)/register/page'
import { AUTH_ERRORS } from '@/lib/auth-errors'
import { AUTH_LABELS } from '@/lib/auth-labels'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

const L = AUTH_LABELS.register
const C = AUTH_LABELS.common

function fillForm({ name = 'Иван', email = 'ivan@test.com', password = 'password123' } = {}) {
  fireEvent.change(screen.getByLabelText(L.nameField), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(C.emailField), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(C.passwordField), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: L.submit }))
}

beforeEach(() => {
  pushMock.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('RegisterPage — rendering', () => {
  it('renders all form fields, submit button, and login link', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(L.nameField)).toBeInTheDocument()
    expect(screen.getByLabelText(C.emailField)).toBeInTheDocument()
    expect(screen.getByLabelText(C.passwordField)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: L.submit })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: L.loginLink })).toHaveAttribute('href', '/login')
  })
})

describe('RegisterPage — success', () => {
  it('sends typed data to endpoint and redirects to /login?registered=1', async () => {
    (fetch as Mock).mockResolvedValue({ ok: true })
    render(<RegisterPage />)

    fillForm({ name: 'Мария', email: 'maria@test.com', password: 'securePassword123' })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'maria@test.com',
          password: 'securePassword123',
          name: 'Мария',
        }),
      })
      expect(pushMock).toHaveBeenCalledWith('/login?registered=1')
    })
  })
})

describe('RegisterPage — errors & validation', () => {
  it('shows email-taken error on 409 status', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, status: 409, json: async () => ({}) })
    render(<RegisterPage />)
    fillForm()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.emailTaken)
    )
  })

  it('renders specific field errors from validation response', async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        issues: {
          name: ['Имя слишком короткое'],
          email: ['Неверный формат email'],
          password: ['Пароль слишком простой'],
        },
      }),
    })
    render(<RegisterPage />)
    fillForm()

    await waitFor(() => {
      expect(screen.getByText('Имя слишком короткое')).toBeInTheDocument()
      expect(screen.getByText('Неверный формат email')).toBeInTheDocument()
      expect(screen.getByText('Пароль слишком простой')).toBeInTheDocument()
    })
  })

  it('clears previous field errors on new submit attempt', async () => {
    (fetch as Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ issues: { email: ['Неверный формат email'] } }),
      })
      .mockResolvedValueOnce({ ok: true })

    render(<RegisterPage />)
    fillForm()

    await waitFor(() =>
      expect(screen.getByText('Неверный формат email')).toBeInTheDocument()
    )

    fillForm()

    await waitFor(() => {
      expect(screen.queryByText('Неверный формат email')).not.toBeInTheDocument()
    })
  })

  it('shows generic error on 500 server error', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<RegisterPage />)
    fillForm()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.generic)
    )
  })

  it('shows network error when fetch rejects', async () => {
    (fetch as Mock).mockRejectedValue(new Error('Network failure'))
    render(<RegisterPage />)
    fillForm()
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network)
    )
  })
})

describe('RegisterPage — loading state', () => {
  it('disables the submit button while submitting', async () => {
    let resolve!: (v: unknown) => void
    ;(fetch as Mock).mockReturnValue(new Promise((r) => { resolve = r }))

    render(<RegisterPage />)
    fillForm()

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(L.submitting)

    // Clean up pending promise
    resolve({ ok: true })
    await waitFor(() => expect(pushMock).toHaveBeenCalled())
  })
})