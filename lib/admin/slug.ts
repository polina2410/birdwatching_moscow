import { randomBytes } from 'crypto'

const CYRILLIC: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch',
  'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'event'
}

export async function ensureUniqueSlug(
  title: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxRetries = 5,
): Promise<string> {
  const base = slugify(title)

  if (!(await checkExists(base))) return base

  for (let i = 0; i < maxRetries; i++) {
    const suffix = randomBytes(2).toString('hex')
    const candidate = `${base}-${suffix}`
    if (!(await checkExists(candidate))) return candidate
  }

  throw new Error('Не удалось сгенерировать уникальный slug. Попробуйте ещё раз.')
}
