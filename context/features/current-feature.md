# Current Feature: passwordless-otp

## Status
In Progress

## Goals

- `USER` accounts log in with a 6-char email OTP (valid 5 min, 5-attempt cap) — no password required
- `ADMIN`/`SUPERADMIN` keep password login at `/login/password`; `PASSWORD_MIN_LENGTH` raised to 16
- All existing ADMIN/SUPERADMIN accounts flagged `passwordResetRequired = true` by migration — must reset before next login
- Sessions live 2 weeks with sliding renewal (mirroring Django `SESSION_COOKIE_AGE` + `SESSION_SAVE_EVERY_REQUEST`)
- `middleware.ts` written so sliding renewal actually fires (without it the config is silently inert)
- `User.passwordHash` made nullable; USER rows nulled by migration; `LoginCode` model added
- Registration drops the password field; password-reset flow silently skips USER accounts
- Django admin immune to `TypeError` 500 when a USER email is entered (null-hash guard + role check reordered)
- `pnpm test:run` green (195 → ~230+ tests), `pnpm build` zero TS errors

## Notes

**Spec:** context/specs/passwordless-otp/spec.md
