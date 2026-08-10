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

// NOTE: applies to ADMIN/SUPERADMIN only — USER accounts are passwordless
export const PASSWORD_MIN_LENGTH = 16
export const BCRYPT_COST = 12
// NOTE: 1 hour TTL for password reset tokens
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000

// Email one-time login code (USER accounts)
export const LOGIN_CODE_LENGTH = 6
// Ambiguity-free alphabet — no 0/O, no 1/I/L (31 symbols)
export const LOGIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const LOGIN_CODE_TTL_MS = 5 * 60 * 1000
export const LOGIN_CODE_MAX_ATTEMPTS = 5
export const ADMIN_CHALLENGE_TTL_MS = 10 * 60 * 1000

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

export const LOGIN_CODE_PROVIDER_ID = 'login-code'
export const ADMIN_2FA_PROVIDER_ID = 'admin-2fa'

export const HTTP_STATUS_BAD_REQUEST = 400
export const HTTP_STATUS_UNAUTHORIZED = 401
export const HTTP_STATUS_FORBIDDEN = 403
export const HTTP_STATUS_NOT_FOUND = 404
export const HTTP_STATUS_CONFLICT = 409
export const HTTP_STATUS_TOO_MANY_REQUESTS = 429
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
export const HTTP_STATUS_BAD_GATEWAY = 502

export const HTTP_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const

// Query param names used in login redirects
export const RETURN_URL_PARAM = 'returnUrl'
export const CALLBACK_URL_PARAM = 'callbackUrl'
export const REGISTERED_PARAM = 'registered'

// Routes that require a session — extend as new protected pages land
export const LOGIN_PATH = '/login'
export const PROTECTED_PATH_PREFIXES = ['/profile'] as const
// Pages a signed-in visitor has no business seeing
export const AUTH_PAGE_PATHS = ['/login', '/register'] as const

export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60 // 2 weeks
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60 // extend at most once per day

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
