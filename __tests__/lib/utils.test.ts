import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/utils'

describe('generateSlug', () => {
  it('converts a plain ASCII title to kebab-case', () => {
    expect(generateSlug('Morning Bird Walk')).toBe('morning-bird-walk')
  })

  it('strips punctuation and special characters', () => {
    expect(generateSlug('Birds & Nature!')).toBe('birds-nature')
  })

  it('collapses multiple spaces and hyphens into a single hyphen', () => {
    expect(generateSlug('Birds  --  Nature')).toBe('birds-nature')
  })

  it('trims leading and trailing whitespace', () => {
    expect(generateSlug('  walk  ')).toBe('walk')
  })

  it('truncates output to 180 characters', () => {
    expect(generateSlug('a'.repeat(200))).toHaveLength(180)
  })

  it('returns empty string for input with only special characters', () => {
    expect(generateSlug('!@#$%')).toBe('')
  })

  it('returns empty string for Cyrillic-only input (non-latin chars are stripped)', () => {
    expect(generateSlug('Утренняя Прогулка')).toBe('')
  })
})