type MailKind = 'welcome' | 'password-reset'

export async function sendMail(args: {
  to: string
  kind: MailKind
  data: Record<string, string>
}): Promise<void> {
  // NOTE: real SMTP will replace this console.log without changing callers
  console.log('[mail]', args)
}