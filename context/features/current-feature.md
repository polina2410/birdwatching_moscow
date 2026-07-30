# Current Feature: yookassa-payment

## Status
In Progress

## Goals

- Kopecks ↔ ЮKassa string conversion is exact; no float arithmetic anywhere in the money path
- `POST /api/checkout` — authenticated, rate-limited; creates `Order` + `OrderItem` rows and deletes `CartItem` rows in one locked transaction; calls ЮKassa and returns `{ orderId, confirmationUrl }`
- `POST /api/checkout` rejects unauthenticated (401), empty/expired cart (409 CART_EMPTY / CART_EXPIRED), oversubscribed walk (409 CAPACITY_EXCEEDED); never accepts prices from the request body
- ЮKassa provider client (`lib/payments/yookassa/`) — `live.ts` (Axios, HTTP Basic, Idempotence-Key, receipt object) and `stub.ts` (no network), selected by `YOOKASSA_MODE`
- Schema additions: `OrderItem`, `Order.expiresAt`, `Order.paidAt`, `Order.paymentIssue`; authoritative seat-hold formula implemented
- `POST /api/payments/yookassa/webhook` — IP-allowlist check, Zod parse, dispatches to `applyPaymentResult`; always 200 on handled/ignored events
- `lib/payments/applyPaymentResult.ts` — single state machine for `succeeded` / `canceled` / `pending`; idempotent on duplicate delivery; creates tickets and sends confirmation mail on success
- `GET /api/orders/[id]` — owner-only status endpoint; 404 for other users, 401 unauthenticated
- `app/checkout/return/page.tsx` — polls order status, shows processing → success → failed
- `app/dev/yookassa/[paymentId]/page.tsx` — stub-only confirmation page with «Оплатить» / «Отменить» buttons; 404 in live mode
- `lib/env.ts` validates all `YOOKASSA_*` vars at startup; `live` mode requires shop id + secret key + VAT code
- `YOOKASSA_MODE=stub` runs the full state machine with zero outbound HTTP; switching to live is an env change only

## Notes

**Spec:** context/specs/yookassa-payment/spec.md
