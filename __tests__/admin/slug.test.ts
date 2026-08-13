import { describe, it, expect, vi } from 'vitest'
import { ensureUniqueSlug } from '@/lib/admin/slug'

describe('ensureUniqueSlug', () => {
  it('returns the base slug when no collision', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('hello world', checkExists)
    expect(slug).toBe('hello-world')
    expect(checkExists).toHaveBeenCalledWith('hello-world')
  })

  it('appends a 4-char lowercase hex suffix on collision', async () => {
    const checkExists = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const slug = await ensureUniqueSlug('hello world', checkExists)
    expect(slug).toMatch(/^hello-world-[0-9a-f]{4}$/)
  })

  it('retries on multiple consecutive collisions', async () => {
    const checkExists = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const slug = await ensureUniqueSlug('walk', checkExists)
    expect(slug).toMatch(/^walk-[0-9a-f]{4}$/)
    expect(checkExists).toHaveBeenCalledTimes(4)
  })

  it('throws after exhausting all retries', async () => {
    const checkExists = vi.fn().mockResolvedValue(true)
    await expect(ensureUniqueSlug('test', checkExists)).rejects.toThrow()
  })

  it('strips special characters and lowercases the slug', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('Hello, World!', checkExists)
    expect(slug).toMatch(/^[a-z0-9-]+$/)
    expect(slug).not.toContain(',')
    expect(slug).not.toContain('!')
  })

  it('transliterates Cyrillic characters to Latin', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('Прогулка в лесу', checkExists)
    expect(slug).toBe('progulka-v-lesu')
  })

  it('returns "event" fallback for an empty string input', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('', checkExists)
    expect(slug).toBe('event')
  })

  it('returns "event" fallback when input contains only non-transliterable characters', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('---', checkExists)
    expect(slug).toBe('event')
  })

  it('collapses consecutive spaces into a single hyphen', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('hello  world', checkExists)
    expect(slug).toBe('hello-world')
  })

  it('returns an already-clean slug unchanged', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('hello-world', checkExists)
    expect(slug).toBe('hello-world')
  })

  it('transliterates ё → yo', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('ёж', checkExists)
    expect(slug).toBe('yozh')
  })

  it('transliterates щ → shch (multi-char Cyrillic mapping)', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const slug = await ensureUniqueSlug('Щука', checkExists)
    expect(slug).toBe('shchuka')
  })
})
