import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockImplementation((handler: unknown) => handler),
}))

import middleware, { config } from '@/middleware'

type FakeReq = {
  nextUrl: URL & { clone: () => URL }
  url: string
  auth: { user: { id: string; role: string } } | null
  headers: Headers
}

function makeReq(pathname: string, auth: FakeReq['auth'] = null): FakeReq {
  const url = new URL(`http://localhost${pathname}`)
  return {
    nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
    url: url.toString(),
    auth,
    headers: new Headers(),
  }
}

const ADMIN = { user: { id: 'u1', role: 'ADMIN' } }
const SUPERADMIN = { user: { id: 'u2', role: 'SUPERADMIN' } }
const USER = { user: { id: 'u3', role: 'USER' } }

describe('middleware default export', () => {
  it('exports a function', () => {
    expect(typeof middleware).toBe('function')
  })
})

describe('middleware config.matcher', () => {
  it('is defined as an array', () => {
    expect(Array.isArray(config.matcher)).toBe(true)
    expect((config.matcher as string[]).length).toBeGreaterThan(0)
  })

  it('does NOT exclude /admin paths from matching (Next.js owns admin routes now)', () => {
    const pattern = (config.matcher as string[]).join('\n')
    expect(pattern).not.toMatch(/\(\?!.*admin/)
  })

  it('pattern excludes /api paths', () => {
    const pattern = (config.matcher as string[]).join('\n')
    expect(pattern).toMatch(/api/)
  })

  it('pattern excludes /_next paths', () => {
    const pattern = (config.matcher as string[]).join('\n')
    expect(pattern).toMatch(/_next/)
  })
})

describe('middleware admin route protection', () => {
  it('redirects unauthenticated request on /admin/walks to /login with returnUrl', async () => {
    const req = makeReq('/admin/walks')
    const res = await (middleware as unknown as (r: FakeReq) => Promise<Response>)(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('returnUrl')
  })

  it('redirects USER role on /admin/walks to /', async () => {
    const req = makeReq('/admin/walks', USER)
    const res = await (middleware as unknown as (r: FakeReq) => Promise<Response>)(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).not.toContain('/admin')
  })

  it('redirects ADMIN from /admin/users to /admin/walks?error=superadmin_required', async () => {
    const req = makeReq('/admin/users', ADMIN)
    const res = await (middleware as unknown as (r: FakeReq) => Promise<Response>)(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/admin/walks')
    expect(location).toContain('error=superadmin_required')
  })

  it('passes ADMIN through to /admin/walks', async () => {
    const req = makeReq('/admin/walks', ADMIN)
    const res = await (middleware as unknown as (r: FakeReq) => Promise<Response>)(req)
    expect(res.status).toBeLessThan(300)
  })

  it('passes SUPERADMIN through to /admin/users', async () => {
    const req = makeReq('/admin/users', SUPERADMIN)
    const res = await (middleware as unknown as (r: FakeReq) => Promise<Response>)(req)
    expect(res.status).toBeLessThan(300)
  })
})

describe('middleware CSP headers', () => {
  it('sets img-src to include storage.yandexcloud.net', async () => {
    const req = makeReq('/')
    const res = await (middleware as unknown as (r: FakeReq) => Promise<Response>)(req)
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).toContain('img-src')
    expect(csp).toContain('https://storage.yandexcloud.net')
  })
})
