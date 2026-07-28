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
  it('renders all fields and submit button', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(L.nameField)).toBeDefined()
    expect(screen.getByLabelText(C.emailField)).toBeDefined()
    expect(screen.getByLabelText(C.passwordField)).toBeDefined()
    expect(screen.getByRole('button', { name: L.submit })).toBeDefined()
  })

  it('renders a link to the login page', () => {
    render(<RegisterPage />)
    expect(screen.getByRole('link', { name: L.loginLink })).toBeDefined()
  })
})

describe('RegisterPage — success', () => {
  it('redirects to /login?registered=1 on successful registration', async () => {
    (fetch as Mock).mockResolvedValue({ ok: true })
    render(<RegisterPage />)
    fillForm()
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login?registered=1'))
  })
})

describe('RegisterPage — errors', () => {
  it('shows email-taken error on 409', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, status: 409, json: async () => ({}) })
    render(<RegisterPage />)
    fillForm()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.emailTaken))
  })

  it('shows field errors from validation issues', async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ issues: { email: ['Неверный формат email'] } }),
    })
    render(<RegisterPage />)
    fillForm()
    await waitFor(() => expect(screen.getByText('Неверный формат email')).toBeDefined())
  })

  it('shows generic error on unexpected server error', async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<RegisterPage />)
    fillForm()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.generic))
  })

  it('shows network error when fetch throws', async () => {
    (fetch as Mock).mockRejectedValue(new Error('Network failure'))
    render(<RegisterPage />)
    fillForm()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(AUTH_ERRORS.network))
  })
})

describe('RegisterPage — loading state', () => {
  it('disables the submit button while submitting', async () => {
    let resolve!: (v: unknown) => void
    ;(fetch as Mock).mockReturnValue(new Promise(r => { resolve = r }))
    render(<RegisterPage />)
    fillForm()
    expect(screen.getByRole('button', { name: L.submitting })).toBeDisabled()
    resolve({ ok: true })
  })
})
