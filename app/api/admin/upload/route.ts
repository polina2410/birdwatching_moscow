import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth'
import { s3, S3_BUCKET } from '@/lib/s3'
import { Role } from '@/generated/prisma/client'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from '@/lib/constants'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(request: Request) {
  const session = await auth()
  const role = session?.user?.role as Role | undefined
  if (!role || (role !== Role.ADMIN && role !== Role.SUPERADMIN)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: HTTP_STATUS_UNAUTHORIZED })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'file required' }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: HTTP_STATUS_BAD_REQUEST })
  }

  const ext = MIME_TO_EXT[file.type]
  const key = `uploads/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read',
      })
    )
  } catch (err) {
    console.error('[admin/upload] S3 PutObject failed', err)
    return NextResponse.json(
      { error: 'upload failed' },
      { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
    )
  }

  const endpoint = (process.env.YC_S3_ENDPOINT ?? 'https://storage.yandexcloud.net').replace(/\/$/, '')
  const url = `${endpoint}/${S3_BUCKET}/${key}`
  return NextResponse.json({ url })
}
