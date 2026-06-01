import { z } from 'zod'
import { MAX_EMAIL, MAX_NAME, PASSWORD_MIN_LENGTH } from '@/lib/constants'

export const registerSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  name: z.string().min(1).max(MAX_NAME),
})

export const loginSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  password: z.string().min(1),
})

export const requestResetSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
})

export const confirmResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
})