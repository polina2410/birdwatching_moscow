import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, s3SendMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  s3SendMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/s3', () => ({
  s3: { send: s3SendMock },
  S3_BUCKET: 'test-bucket',
}))
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

import { POST } from '@/app/api/admin/upload/route'

const ADMIN_SESSION = { user: { id: 'admin-1', role: 'ADMIN' } }
const YC_BASE = 'https://storage.yandexcloud.net/test-bucket/'

function makeUploadRequest(file: File | null, extraFields?: Record<string, string>) {
  const form = new FormData()
  if (file) form.append('file', file)
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) form.append(k, v)
  }
  return new Request('http://localhost/api/admin/upload', {
    method: 'POST',
    body: form,
  })
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes).fill(0)
  return new File([content], name, { type })
}

beforeEach(() => {
  vi.clearAllMocks()
  s3SendMock.mockResolvedValue({})
})

describe('POST /api/admin/upload — auth', () => {
  it('returns 401 when no session', async () => {
    authMock.mockResolvedValue(null)
    const res = await POST(makeUploadRequest(makeFile('photo.jpg', 'image/jpeg', 100)))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'unauthorized' })
  })

  it('returns 401 when session role is USER', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: 'USER' } })
    const res = await POST(makeUploadRequest(makeFile('photo.jpg', 'image/jpeg', 100)))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/admin/upload — file validation', () => {
  beforeEach(() => { authMock.mockResolvedValue(ADMIN_SESSION) })

  it('returns 400 when no file field', async () => {
    const res = await POST(makeUploadRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'file required' })
  })

  it('returns 400 for text/plain MIME type', async () => {
    const res = await POST(makeUploadRequest(makeFile('data.txt', 'text/plain', 100)))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'unsupported file type' })
  })

  it('returns 400 for application/pdf MIME type', async () => {
    const res = await POST(makeUploadRequest(makeFile('doc.pdf', 'application/pdf', 100)))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'unsupported file type' })
  })

  it('returns 400 for file larger than 5 MB', async () => {
    const over5MB = 5 * 1024 * 1024 + 1
    const res = await POST(makeUploadRequest(makeFile('big.jpg', 'image/jpeg', over5MB)))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too large|size/i)
  })
})

describe('POST /api/admin/upload — happy path', () => {
  beforeEach(() => { authMock.mockResolvedValue(ADMIN_SESSION) })

  it('returns 200 with a URL for a valid JPEG', async () => {
    const res = await POST(makeUploadRequest(makeFile('bird.jpg', 'image/jpeg', 1024)))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(new RegExp(`^${YC_BASE}`))
  })

  it('returns 200 with a URL for image/png', async () => {
    const res = await POST(makeUploadRequest(makeFile('bird.png', 'image/png', 1024)))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(new RegExp(`^${YC_BASE}`))
  })

  it('returns 200 with a URL for image/webp', async () => {
    const res = await POST(makeUploadRequest(makeFile('bird.webp', 'image/webp', 1024)))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(new RegExp(`^${YC_BASE}`))
  })

  it('returned URL key uses uploads/<uuid>.<ext> format', async () => {
    const res = await POST(makeUploadRequest(makeFile('photo.jpg', 'image/jpeg', 1024)))
    const { url } = await res.json()
    expect(url).toMatch(/\/uploads\/[0-9a-f-]{36}\.jpg$/)
  })

  it('two concurrent uploads produce different keys', async () => {
    const [r1, r2] = await Promise.all([
      POST(makeUploadRequest(makeFile('a.jpg', 'image/jpeg', 512))),
      POST(makeUploadRequest(makeFile('b.jpg', 'image/jpeg', 512))),
    ])
    const [b1, b2] = await Promise.all([r1.json(), r2.json()])
    expect(b1.url).not.toBe(b2.url)
  })
})

describe('POST /api/admin/upload — S3 error handling', () => {
  beforeEach(() => { authMock.mockResolvedValue(ADMIN_SESSION) })

  it('returns 500 when S3 send throws', async () => {
    s3SendMock.mockRejectedValue(new Error('S3 network error'))
    const res = await POST(makeUploadRequest(makeFile('photo.jpg', 'image/jpeg', 512)))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'upload failed' })
  })

  it('does not leak the S3 error message in the response', async () => {
    s3SendMock.mockRejectedValue(new Error('AccessDenied: bucket policy violation'))
    const res = await POST(makeUploadRequest(makeFile('photo.jpg', 'image/jpeg', 512)))
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('AccessDenied')
  })
})
