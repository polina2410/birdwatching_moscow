import { describe, it, expect, afterEach, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function loadEnvModule() {
  return import('@/lib/env')
}

describe('lib/env — booleanFlag transform', () => {
  it('YOOKASSA_VERIFY_IP=true parses to true', async () => {
    vi.stubEnv('YOOKASSA_VERIFY_IP', 'true')
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_VERIFY_IP).toBe(true)
  })

  it('YOOKASSA_VERIFY_IP=false parses to false', async () => {
    vi.stubEnv('YOOKASSA_VERIFY_IP', 'false')
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_VERIFY_IP).toBe(false)
  })

  it('YOOKASSA_VERIFY_IP absent uses default (true)', async () => {
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_VERIFY_IP).toBe(true)
  })

  it('YOOKASSA_RECEIPT_ENABLED=false parses to false', async () => {
    vi.stubEnv('YOOKASSA_RECEIPT_ENABLED', 'false')
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_RECEIPT_ENABLED).toBe(false)
  })
})

describe('lib/env — defaults', () => {
  it('YOOKASSA_MODE defaults to "stub"', async () => {
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_MODE).toBe('stub')
  })

  it('APP_URL defaults to http://localhost:3000', async () => {
    const { env } = await loadEnvModule()
    expect(env.APP_URL).toBe('http://localhost:3000')
  })
})

describe('lib/env — live mode validation', () => {
  it('throws at startup when YOOKASSA_MODE=live and YOOKASSA_SHOP_ID is missing', async () => {
    vi.stubEnv('YOOKASSA_MODE', 'live')
    vi.stubEnv('YOOKASSA_SECRET_KEY', 'sk-test')
    vi.stubEnv('YOOKASSA_VAT_CODE', '1')
    await expect(loadEnvModule()).rejects.toThrow(/YOOKASSA_SHOP_ID/)
  })

  it('throws at startup when YOOKASSA_MODE=live and YOOKASSA_SECRET_KEY is missing', async () => {
    vi.stubEnv('YOOKASSA_MODE', 'live')
    vi.stubEnv('YOOKASSA_SHOP_ID', 'shop-123')
    vi.stubEnv('YOOKASSA_VAT_CODE', '1')
    await expect(loadEnvModule()).rejects.toThrow(/YOOKASSA_SECRET_KEY/)
  })

  it('throws at startup when YOOKASSA_MODE=live, receipts enabled, and YOOKASSA_VAT_CODE is missing', async () => {
    vi.stubEnv('YOOKASSA_MODE', 'live')
    vi.stubEnv('YOOKASSA_SHOP_ID', 'shop-123')
    vi.stubEnv('YOOKASSA_SECRET_KEY', 'sk-test')
    vi.stubEnv('YOOKASSA_RECEIPT_ENABLED', 'true')
    await expect(loadEnvModule()).rejects.toThrow(/YOOKASSA_VAT_CODE/)
  })

  it('does not throw when YOOKASSA_MODE=live and receipts are disabled (no VAT code needed)', async () => {
    vi.stubEnv('YOOKASSA_MODE', 'live')
    vi.stubEnv('YOOKASSA_SHOP_ID', 'shop-123')
    vi.stubEnv('YOOKASSA_SECRET_KEY', 'sk-test')
    vi.stubEnv('YOOKASSA_RECEIPT_ENABLED', 'false')
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_MODE).toBe('live')
  })

  it('does not throw in stub mode with no credentials', async () => {
    vi.stubEnv('YOOKASSA_MODE', 'stub')
    const { env } = await loadEnvModule()
    expect(env.YOOKASSA_MODE).toBe('stub')
  })
})
