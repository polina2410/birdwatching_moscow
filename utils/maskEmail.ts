/** 'user@test.com' → 'u•••@test.com' — enough to recognise, not enough to leak. */
export function maskEmail(email: string): string {
  const separator = email.lastIndexOf('@')
  if (separator < 1) return email

  const local = email.slice(0, separator)
  const domain = email.slice(separator)

  return `${local.slice(0, 1)}${'•'.repeat(Math.max(local.length - 1, 1))}${domain}`
}
