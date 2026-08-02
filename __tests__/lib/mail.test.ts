import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMailSpy, createTransportMock } = vi.hoisted(() => {
  const sendMailSpy = vi.fn()
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailSpy }))
  return { sendMailSpy, createTransportMock }
})

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}))

import { sendMail } from '@/lib/mail'

beforeEach(() => {
  process.env.POSTBOX_SMTP_USER = 'postbox-test-user'
  process.env.POSTBOX_SMTP_PASSWORD = 'postbox-test-password'
  sendMailSpy.mockReset()
  sendMailSpy.mockResolvedValue({ messageId: 'test-message-id' })
})

afterEach(() => {
  delete process.env.POSTBOX_SMTP_USER
  delete process.env.POSTBOX_SMTP_PASSWORD
})

describe('sendMail — welcome', () => {
  it('calls transporter.sendMail with correct to, subject, and html containing name', async () => {
    await sendMail({
      to: 'newuser@example.com',
      kind: 'welcome',
      data: { name: 'Иван' },
    })

    expect(sendMailSpy).toHaveBeenCalledTimes(1)
    const call = sendMailSpy.mock.calls[0][0] as { to: string; subject: string; html: string }
    expect(call.to).toBe('newuser@example.com')
    expect(call.subject).toBe('Добро пожаловать в Птицы Москвы!')
    expect(call.html).toContain('Иван')
  })
})

describe('sendMail — password-reset', () => {
  it('calls transporter.sendMail with subject "Сброс пароля" and html containing link', async () => {
    await sendMail({
      to: 'user@example.com',
      kind: 'password-reset',
      data: { link: 'https://birdwatching-moscow.ru/reset-password/abc123' },
    })

    expect(sendMailSpy).toHaveBeenCalledTimes(1)
    const call = sendMailSpy.mock.calls[0][0] as { subject: string; html: string }
    expect(call.subject).toBe('Сброс пароля')
    expect(call.html).toContain('https://birdwatching-moscow.ru/reset-password/abc123')
  })
})

describe('sendMail — order-paid', () => {
  it('calls transporter.sendMail with subject "Заказ оплачен — ваши билеты готовы" and html containing orderId', async () => {
    await sendMail({
      to: 'buyer@example.com',
      kind: 'order-paid',
      data: { orderId: 'order-12345' },
    })

    expect(sendMailSpy).toHaveBeenCalledTimes(1)
    const call = sendMailSpy.mock.calls[0][0] as { subject: string; html: string }
    expect(call.subject).toBe('Заказ оплачен — ваши билеты готовы')
    expect(call.html).toContain('order-12345')
  })
})

describe('sendMail — missing config guard', () => {
  it('returns without calling transporter.sendMail when POSTBOX_SMTP_USER is undefined', async () => {
    delete process.env.POSTBOX_SMTP_USER

    await expect(
      sendMail({ to: 'user@example.com', kind: 'welcome', data: { name: 'Аня' } })
    ).resolves.toBeUndefined()

    expect(sendMailSpy).not.toHaveBeenCalled()
  })
})

describe('sendMail — transport failure', () => {
  it('does not rethrow when transporter.sendMail rejects', async () => {
    sendMailSpy.mockRejectedValueOnce(new Error('SMTP connection timed out'))

    await expect(
      sendMail({ to: 'user@example.com', kind: 'welcome', data: { name: 'Аня' } })
    ).resolves.toBeUndefined()
  })
})
