import nodemailer from 'nodemailer'
import {
  POSTBOX_SMTP_HOST,
  POSTBOX_SMTP_PORT,
  POSTBOX_DEFAULT_FROM_ADDRESS,
  POSTBOX_DEFAULT_FROM_NAME,
} from '@/lib/constants'

export type MailKind = 'welcome' | 'password-reset' | 'order-paid' | 'login-code'

interface MailTemplate {
  subject: string
  html: string
  text: string
}

// Created once at module load. Auth credentials may be absent in local dev —
// no connection is attempted until sendMail() is called, and sendMail() guards
// on POSTBOX_SMTP_USER before ever touching the transporter.
const transporter = nodemailer.createTransport({
  host: POSTBOX_SMTP_HOST,
  port: POSTBOX_SMTP_PORT,
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.POSTBOX_SMTP_USER,
    pass: process.env.POSTBOX_SMTP_PASSWORD,
  },
})

function welcomeTemplate(data: Record<string, string>): MailTemplate {
  const name = data.name ?? ''
  return {
    subject: 'Добро пожаловать в Птицы Москвы!',
    html: `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h1>Добро пожаловать, ${name}!</h1>
        <p>Спасибо, что зарегистрировались на «Птицы Москвы». Теперь вы можете
        записываться на орнитологические прогулки и экспедиции.</p>
      </div>
    `,
    text: `Добро пожаловать, ${name}!\n\nСпасибо, что зарегистрировались на «Птицы Москвы». Теперь вы можете записываться на орнитологические прогулки и экспедиции.`,
  }
}

function passwordResetTemplate(data: Record<string, string>): MailTemplate {
  const link = data.link ?? ''
  return {
    subject: 'Сброс пароля',
    html: `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h1>Сброс пароля</h1>
        <p>Вы запросили сброс пароля. Перейдите по ссылке ниже, чтобы задать новый пароль:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Если вы не запрашивали сброс пароля, просто игнорируйте это письмо.</p>
      </div>
    `,
    text: `Вы запросили сброс пароля. Перейдите по ссылке, чтобы задать новый пароль: ${link}\n\nЕсли вы не запрашивали сброс пароля, просто игнорируйте это письмо.`,
  }
}

function orderPaidTemplate(data: Record<string, string>): MailTemplate {
  const orderId = data.orderId ?? ''
  return {
    subject: 'Заказ оплачен — ваши билеты готовы',
    html: `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h1>Заказ оплачен</h1>
        <p>Ваш заказ ${orderId} успешно оплачен. Билеты уже доступны в личном кабинете.</p>
      </div>
    `,
    text: `Ваш заказ ${orderId} успешно оплачен. Билеты уже доступны в личном кабинете.`,
  }
}

function loginCodeTemplate(data: Record<string, string>): MailTemplate {
  const code = data.code ?? ''
  return {
    subject: 'Ваш код входа',
    html: `
      <div style="font-family: sans-serif; line-height: 1.5;">
        <h1>Код для входа</h1>
        <p>Введите этот код на странице входа:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>Код действует 5 минут.</p>
        <p>Если вы не запрашивали код, просто игнорируйте это письмо.</p>
      </div>
    `,
    text: `Код для входа: ${code}\n\nКод действует 5 минут.\n\nЕсли вы не запрашивали код, просто игнорируйте это письмо.`,
  }
}

function buildTemplate(kind: MailKind, data: Record<string, string>): MailTemplate {
  switch (kind) {
    case 'welcome':
      return welcomeTemplate(data)
    case 'password-reset':
      return passwordResetTemplate(data)
    case 'order-paid':
      return orderPaidTemplate(data)
    case 'login-code':
      return loginCodeTemplate(data)
  }
}

export async function sendMail(args: {
  to: string
  kind: MailKind
  data: Record<string, string>
}): Promise<void> {
  if (!process.env.POSTBOX_SMTP_USER) {
    console.error('[mail] POSTBOX_SMTP_USER not set — skipping')
    return
  }

  const fromAddress = process.env.POSTBOX_FROM_ADDRESS || POSTBOX_DEFAULT_FROM_ADDRESS
  const fromName = process.env.POSTBOX_FROM_NAME || POSTBOX_DEFAULT_FROM_NAME
  const { subject, html, text } = buildTemplate(args.kind, args.data)

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: args.to,
      subject,
      html,
      text,
    })
  } catch (err) {
    console.error('[mail] send failed:', err)
  }
}
