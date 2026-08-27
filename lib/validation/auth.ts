import { z } from 'zod'
import { MAX_EMAIL, MAX_NAME, PASSWORD_MIN_LENGTH } from '@/lib/constants'

// USER accounts are passwordless — registration collects no password
export const registerSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  name: z.string().min(1).max(MAX_NAME),
})

export const loginSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  password: z.string().min(1),
})

export const requestLoginCodeSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
})

export const verifyLoginCodeSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  code: z.string().min(1),
})

export const adminTwoFactorSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  challengeToken: z.string().min(1),
  password: z.string().min(1),
})

export const setInitialPasswordSchema = z.object({
  email:          z.string().email().max(MAX_EMAIL),
  challengeToken: z.string().min(1),
  password:       z.string().min(PASSWORD_MIN_LENGTH),
})

export const verifyRegistrationCodeSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  code: z.string().min(1),
  name: z.string().min(1).max(MAX_NAME),
})

export const requestResetSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
})

export const confirmResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
})