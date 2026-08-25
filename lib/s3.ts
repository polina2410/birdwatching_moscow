import { S3Client } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  endpoint: process.env.YC_S3_ENDPOINT,
  region: process.env.YC_S3_REGION,
  credentials: {
    accessKeyId: process.env.YC_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.YC_S3_SECRET_ACCESS_KEY ?? '',
  },
  // required: Yandex Object Storage does not support virtual-hosted-style URLs
  forcePathStyle: true,
})

export const S3_BUCKET = process.env.YC_S3_BUCKET ?? ''
