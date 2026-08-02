export const MAX_EVENT_TITLE = 150
export const MAX_EVENT_SLUG = 200
export const MAX_EVENT_LOCATION = 100
export const MAX_NAME = 50
export const MAX_EMAIL = 254
export const MAX_URL = 2048
export const MAX_DESCRIPTION = 1000
export const MAX_EXPEDITION_DAY_TITLE = 150

export const MAX_GALLERY_IMAGES = 15
export const MAX_PROFILE_LINKS = 1
export const MAX_EXPEDITION_DAYS = 30
export const MAX_GUIDES_PER_EVENT = 5

export const PASSWORD_MIN_LENGTH = 8
export const BCRYPT_COST = 12
// NOTE: 1 hour TTL for password reset tokens
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

// NOTE: matches the cart's existing 20-minute hold; the clock restarts at checkout
export const PAYMENT_HOLD_MINUTES = 20

// ЮKassa: `description` and receipt `items[].description` are both capped at 128 chars [verify limit]
export const YOOKASSA_DESCRIPTION_MAX_LENGTH = 128

// Return-page reconciliation poll cadence
export const ORDER_STATUS_POLL_INTERVAL_MS = 2000

// Yandex Cloud Postbox — SMTP gateway is fixed by the provider, not an env var
export const POSTBOX_SMTP_HOST = 'postbox.cloud.yandex.net'
export const POSTBOX_SMTP_PORT = 587
export const POSTBOX_DEFAULT_FROM_ADDRESS = 'no-reply@localhost'
export const POSTBOX_DEFAULT_FROM_NAME = 'Птицы Москвы'
