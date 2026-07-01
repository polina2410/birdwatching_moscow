export function safeRedirect(target: string | null | undefined, fallback = '/'): string {
  if (!target) return fallback
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return fallback
  }
  return target
}
