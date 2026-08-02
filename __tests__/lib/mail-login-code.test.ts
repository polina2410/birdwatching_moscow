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
  sendMailSpy.mockResolvedValue({ messageId: 'test-id' })
})

afterEach(() => {
  delete process.env.POSTBOX_SMTP_USER
  delete process.env.POSTBOX_SMTP_PASSWORD
})

describe('sendMail — login-code', () => {
  it('calls transporter.sendMail with subject "Ваш код входа"', async () => {
    await sendMail({ to: 'user@example.com', kind: 'login-code', data: { code: 'ABCD2F' } })
    expect(sendMailSpy).toHaveBeenCalledTimes(1)
    const call = sendMailSpy.mock.calls[0][0] as { subject: string; html: string; text: string }
    expect(call.subject).toBe('Ваш код входа')
  })

  it('html contains the code verbatim', async () => {
    await sendMail({ to: 'user@example.com', kind: 'login-code', data: { code: 'ABCD2F' } })
    const call = sendMailSpy.mock.calls[0][0] as { html: string }
    expect(call.html).toContain('ABCD2F')
  })

  it('text contains the code verbatim', async () => {
    await sendMail({ to: 'user@example.com', kind: 'login-code', data: { code: 'ABCD2F' } })
    const call = sendMailSpy.mock.calls[0][0] as { text: string }
    expect(call.text).toContain('ABCD2F')
  })

  it('html and text mention the 5-minute expiry', async () => {
    await sendMail({ to: 'user@example.com', kind: 'login-code', data: { code: 'ABCD2F' } })
    const call = sendMailSpy.mock.calls[0][0] as { html: string; text: string }
    expect(call.html).toContain('5')
    expect(call.text).toContain('5')
  })
})
