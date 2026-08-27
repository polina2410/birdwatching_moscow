# Spec: ЮKassa payment (Smart payment / Смарт-платёж)

**Goal:** A logged-in user can pay for reserved walk seats through ЮKassa and receive tickets, with the order marked `PAID` only by a verified provider notification — and the whole flow runs locally against a stub because no merchant credentials exist yet.

> Reference: ЮKassa Smart payment scenario — https://yookassa.ru/developers/payment-acceptance/integration-scenarios/smart-payment
> ⚠️ The spec was written without live access to that page. Every value marked **[verify]** must be checked against the current docs during implementation; none of them change the design, only constants.

## Context

- Only **walks** are sold online (see `context/specs/schema-spec.md`). Expeditions never reach this flow.
- `prisma/schema.prisma` already has `Order` (with unique `yooKassaPaymentId`), `Ticket`, `CartItem.reservedUntil`, and `OrderStatus { PENDING, AWAITING_PAYMENT, PAID, FAILED, EXPIRED }`. This spec fills in the missing pieces, it does not redesign them.
- There is no cart API, no checkout UI and no payment code in the repo today. This spec covers the **server-side payment path** plus the minimum client surface needed to exercise it.

## What to build

### 1. Schema additions (migration required)

- `OrderItem { id, orderId, walkId, quantity, unitPriceKopecks, createdAt }` — the line items of an order, snapshotted at checkout. Needed because `Ticket` rows only exist after payment, so without this the order has no memory of what was bought. `unitPriceKopecks` is a **copy** of `Walk.priceKopecks` at checkout time; a later admin price edit must not change an in-flight order.
- `Order.expiresAt DateTime` — end of the payment window, set at checkout to `now + PAYMENT_HOLD_MINUTES` where **`PAYMENT_HOLD_MINUTES = 20`** (a new constant in `lib/constants.ts`, matching the cart's existing 20-minute hold). The clock restarts at checkout, so a user who reaches the payment page at cart-minute 19 still gets a full 20 minutes to pay.
- `Order.paidAt DateTime?` — set when the order transitions to `PAID`.
- `Order.paymentIssue String?` — non-null marks an order needing manual admin attention (amount mismatch, oversell, unexpected provider state). Null in the normal path.
- CHECK constraints (raw SQL in the migration, per project convention): `OrderItem.quantity >= 1`, `OrderItem.unitPriceKopecks >= 0`.
- Index `Order(status, expiresAt)` for the expiry sweep, `OrderItem(walkId)` for the capacity query.

**Seat-hold formula (authoritative from now on).** Seats taken for a walk =
`sold Tickets` + `active CartItems (reservedUntil > now)` + `OrderItems of orders where status = AWAITING_PAYMENT AND expiresAt > now`.
Checkout **deletes** the user's `CartItem` rows and converts them to `OrderItem` rows in the same transaction, so a seat is counted exactly once.

### 2. Provider client — `lib/payments/yookassa/`

One interface, two implementations, chosen by `YOOKASSA_MODE`. Callers never branch on mode (same pattern as the existing `lib/mail.ts` stub).

```
createPayment(input) -> { id, status, confirmationUrl }
getPayment(paymentId) -> Payment
```

- **`live.ts`** — a dedicated **Axios instance** against `https://api.yookassa.ru/v3`. HTTP Basic auth: `shopId` as user, secret key as password. Header `Idempotence-Key` on every POST **[verify header spelling]**. Timeout, and retry only on network errors / 429 / 5xx with backoff, reusing the same idempotence key.
- **`stub.ts`** — no network. Generates a fake payment id, persists nothing outside the `Order`, returns a `confirmationUrl` pointing at the local dev page (§6).
- **`index.ts`** — factory reading validated env.

`createPayment` body (Smart payment = **no** `payment_method_data`, so ЮKassa renders every method the shop has enabled):

```jsonc
{
  "amount": { "value": "1500.00", "currency": "RUB" },
  "capture": true,                       // one-stage; no waiting_for_capture hold
  "confirmation": { "type": "redirect", "return_url": "<APP_URL>/checkout/return?orderId=<uuid>" },
  "description": "Заказ <short-id>: <walk title>",   // truncated to 128 chars [verify limit]
  "metadata": { "orderId": "<uuid>" },   // fallback lookup key
  "receipt": {                           // REQUIRED — see below
    "customer": { "email": "<user email>" },
    "items": [                           // one entry per OrderItem
      {
        "description": "<walk title>",   // truncated to 128 chars [verify limit]
        "quantity": "2.00",
        "amount": { "value": "750.00", "currency": "RUB" },   // per unit, not the line total
        "vat_code": "<YOOKASSA_VAT_CODE>",
        "payment_subject": "service",
        "payment_mode": "full_payment"
      }
    ]
  }
}
```

**The `receipt` is mandatory, not optional.** The merchant uses «Чеки от ЮKassa», so ЮKassa fiscalises on our behalf and a payment sent without a receipt is a 54-ФЗ violation. Build it from `OrderItem` rows plus the buyer's account email. `item.amount` is the **per-unit** price (`unitPriceKopecks`), and `Σ(quantity × item.amount)` must equal the top-level `amount.value` — a mismatch is rejected by ЮKassa **[verify]**, so assert it in the builder. A guided walk is `payment_subject: "service"` with `payment_mode: "full_payment"` (full prepayment for a service rendered later) **[verify against the client's accounting]**.

### 3. `POST /api/checkout`

Authenticated. Rate-limited via existing `checkRateLimit` keyed on user id. In one Prisma transaction with `SELECT … FOR UPDATE` on the affected `Walk` rows:

1. Load the caller's active cart items; reject if empty or all expired.
2. Recompute capacity with the formula above; reject if any walk is oversubscribed.
3. Compute `totalKopecks` **from the database**, never from the request body. The request body carries no prices and no quantities.
4. Create `Order (PENDING)` + `OrderItem` rows, delete the cart items, set `expiresAt`.

Then, outside the transaction, call `createPayment` with `Idempotence-Key = order.id`, store `yooKassaPaymentId`, move the order to `AWAITING_PAYMENT`, and return `{ orderId, confirmationUrl }`.

### 4. `POST /api/payments/yookassa/webhook`

Public, no auth, no CSRF, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`. Steps: source-IP allowlist → Zod-parse the notification → dispatch to §5. Always returns 200 for anything it has correctly handled or deliberately ignored, so ЮKassa stops retrying **[verify retry policy — believed 24h with decreasing frequency]**.

Handled events: `payment.succeeded`, `payment.canceled`, `payment.waiting_for_capture` (unexpected under `capture: true` → record `paymentIssue`, no ticket creation). `refund.succeeded` is accepted and logged only.

### 5. `lib/payments/applyPaymentResult.ts` — the single state machine

Both the webhook and the return-page reconciliation call **this one function**; the transition logic must not be duplicated.

| Provider status | Order transition | Side effects |
|---|---|---|
| `succeeded` | `AWAITING_PAYMENT`/`EXPIRED` → `PAID` | create one `Ticket` per seat, `paidAt = now`, send confirmation mail |
| `canceled` | `AWAITING_PAYMENT` → `FAILED` | release the hold, no tickets |
| `pending` | no change | — |

Runs in a transaction, re-reads the order `FOR UPDATE`, and is a no-op if the order is already in the target state.

### 6. Client surface

- `app/checkout/return/page.tsx` — polls `GET /api/orders/[id]` (owner-only) and shows *processing → success → failed*. Never infers success from the redirect itself.
- `app/dev/yookassa/[paymentId]/page.tsx` — stub-mode-only confirmation page with «Оплатить» / «Отменить» buttons that POST a realistic notification body to the real webhook endpoint. Returns 404 when `YOOKASSA_MODE !== 'stub'`.

### 7. Config — `lib/env.ts` (Zod, validated at startup)

`YOOKASSA_MODE` (`stub` | `live`, default `stub`), `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_API_URL`, `YOOKASSA_VERIFY_IP` (default true), `YOOKASSA_RECEIPT_ENABLED` (**default `true`**), `YOOKASSA_VAT_CODE`, `APP_URL`. `live` mode requires shop id, secret **and**, while receipts are enabled, `YOOKASSA_VAT_CODE`; `stub` requires none of them. Add all of these to `.env.example`.

## Success criteria

- [ ] `pnpm test:run` and `pnpm typecheck` pass; every criterion below maps to at least one test.
- [ ] Kopecks→ЮKassa amount conversion is exact for `1 → "0.01"`, `99 → "0.99"`, `100 → "1.00"`, `150000 → "1500.00"`; no float arithmetic anywhere in the money path.
- [ ] `POST /api/checkout` unauthenticated → `401`.
- [ ] `POST /api/checkout` with no cart items, or only items where `reservedUntil <= now` → `409` with code `CART_EMPTY` / `CART_EXPIRED`; no `Order` row created.
- [ ] `POST /api/checkout` on a walk whose seats are already taken → `409 CAPACITY_EXCEEDED`; no `Order` row created.
- [ ] Happy path `POST /api/checkout` → `200 { orderId, confirmationUrl }`; DB shows one `Order` with `status = AWAITING_PAYMENT`, non-null `yooKassaPaymentId`, `expiresAt > now`, `OrderItem` rows mirroring the cart, `totalKopecks === Σ(quantity × Walk.priceKopecks)`, and zero remaining `CartItem` rows for that user.
- [ ] A request body containing `totalKopecks` or `priceKopecks` is ignored: the created order's total still equals the DB-computed total.
- [ ] The outbound create-payment call carries `Idempotence-Key === order.id`, `amount.currency === "RUB"`, `capture === true`, `confirmation.type === "redirect"`, a `return_url` on `APP_URL`, `metadata.orderId === order.id`, a `description` of ≤ 128 chars, and **no** `payment_method_data` key.
- [ ] The outbound create-payment call always includes a `receipt` with `customer.email` equal to the buyer's account email and exactly one `items` entry per `OrderItem`, each carrying `description`, `quantity`, per-unit `amount` in RUB, `vat_code` from `YOOKASSA_VAT_CODE`, `payment_subject` and `payment_mode`.
- [ ] For a two-walk cart (e.g. 2 × 750,00 ₽ + 1 × 1 200,00 ₽), `Σ(item.quantity × item.amount.value)` equals the top-level `amount.value` ("2700.00"); the receipt builder throws rather than emitting a receipt whose lines don't sum to the charged total.
- [ ] Order `expiresAt` is `createdAt + 20 minutes`; an order polled after that window is reported as `EXPIRED`.
- [ ] ЮKassa returning 500 or timing out on create → endpoint returns `502 PAYMENT_PROVIDER_UNAVAILABLE`, order stays `PENDING` with `yooKassaPaymentId === null`, and the cart contents are restored (nothing is silently lost).
- [ ] Webhook `payment.succeeded` for a known payment id → `200`; order `PAID` with `paidAt` set; exactly `Σ quantity` `Ticket` rows exist, each linked to the order, user and walk.
- [ ] Delivering the identical `payment.succeeded` notification twice → `200` both times, and the ticket count after the second delivery is unchanged.
- [ ] Webhook `payment.canceled` → order `FAILED`, zero tickets, seats released (a subsequent checkout for the same walk succeeds).
- [ ] Webhook whose `object.amount.value` ≠ the order's `totalKopecks` → order is **not** marked `PAID`, `paymentIssue` is set, response is `200`.
- [ ] Webhook with a body that fails the Zod schema → `400`, no DB write.
- [ ] Webhook for an unknown payment id → `200` (so retries stop), no DB write.
- [ ] With `YOOKASSA_VERIFY_IP=true`, a webhook from an IP outside the allowlist → `403`, no DB write; an IP inside the allowlist is processed normally.
- [ ] `GET /api/orders/[id]` returns `{ status }` to the owner; returns `404` for a different logged-in user and `401` when unauthenticated.
- [ ] With `YOOKASSA_MODE=stub`: checkout succeeds with **zero outbound HTTP requests** (assert the HTTP client is never invoked) and returns a `confirmationUrl` on `APP_URL`; the dev confirmation page's «Оплатить» action drives the order to `PAID` through the real webhook endpoint.
- [ ] With `YOOKASSA_MODE=live` and a missing `YOOKASSA_SECRET_KEY`, env validation throws at startup — not on the first payment attempt.

## Edge cases

- **Payment completes after `expiresAt`.** The order is `EXPIRED` but the customer's money was taken → `applyPaymentResult` still issues the tickets and marks it `PAID`. Honouring a real payment always beats consistency with our own timer.
- **Seat sold to someone else during the payment window.** Should be impossible — the `OrderItem` hold covers the whole window — but if the re-check at `PAID` time fails, still create the tickets, set `paymentIssue`, and let an admin resolve it. Never refuse a successful payment automatically.
- **Double checkout click.** Two concurrent `POST /api/checkout` calls for the same cart must not produce two `AWAITING_PAYMENT` orders; the second returns the existing order's `confirmationUrl` (the cart is emptied inside the same locked transaction, so the loser sees an empty cart → reuse path).
- **Webhook arrives before the checkout response is stored.** The webhook cannot find the order by `yooKassaPaymentId` → fall back to `metadata.orderId`; if still not found, return `200` and let the return-page reconciliation catch up.
- **Webhook never arrives** (misconfigured URL, outage). The return page's poll triggers a server-side `getPayment` reconciliation through the same state machine, so the order still settles.
- **User closes the tab on ЮKassa's page.** Order sits in `AWAITING_PAYMENT` until `expiresAt`, then is lazily marked `EXPIRED` on read (lazy-on-read, consistent with the cart's existing no-worker decision).
- **Walk cancelled or deleted between checkout and payment.** Payment still settles into tickets; the refund, if any, is a manual dashboard action by the admin — the code does nothing.
- **Price changed by an admin mid-flight.** `OrderItem.unitPriceKopecks` wins; the customer pays the price shown when they checked out.
- **Multiple walks in one order.** Total is the sum; tickets are created per walk per seat.

## Error cases

| Situation | Response |
|---|---|
| Not logged in | `401` |
| Empty / fully expired cart | `409 CART_EMPTY` / `409 CART_EXPIRED` |
| Not enough seats | `409 CAPACITY_EXCEEDED` |
| Rate limit hit | `429` with `Retry-After` |
| ЮKassa 4xx (bad credentials / bad request) | `502 PAYMENT_PROVIDER_ERROR`, full provider error logged server-side, order stays `PENDING`, generic message to the user — never leak provider internals or the secret key |
| ЮKassa 5xx / timeout | `502 PAYMENT_PROVIDER_UNAVAILABLE`, retryable, same idempotence key on retry |
| Webhook: bad shape | `400` |
| Webhook: bad source IP | `403` |
| Webhook: unknown payment | `200`, logged |
| Webhook: amount mismatch | `200`, `paymentIssue` set, order not paid, admin alert logged |
| Webhook: handler throws | `500` so ЮKassa retries — the only case where a non-2xx is deliberate |

## Out of scope

- **All refund logic.** No `POST /v3/refunds` call, no admin refund UI, no automated refund on any path — explicitly including cancelled walks, amount mismatches and the oversell case, which only ever *flag* an order via `paymentIssue`. Refunds are performed by hand in the ЮKassa dashboard. Confirmed with the client; do not add "just a small refund endpoint" during implementation.
- Two-stage payments (`capture: false`, `waiting_for_capture`, manual capture/cancel).
- The embedded checkout widget (`confirmation.type: "embedded"`) and any ЮKassa JS on our pages — that would require loosening the CSP in `proxy.ts`.
- Saved payment methods, recurring/autopayments, `save_payment_method`.
- Payouts, deals/marketplace splitting, installments, B2B.
- Cart UI, cart CRUD API, and the walk detail "add to cart" flow. Tests seed `CartItem` rows directly.
- Multi-currency — RUB only.
- Registering webhook subscriptions via `POST /v3/webhooks`; for MVP they are configured by hand in the ЮKassa dashboard.
- A background job to sweep expired orders (lazy-on-read instead).
- Real transactional email templates — `lib/mail.ts` stays a stub; this spec only adds an `order-paid` kind.

## Technical notes

**Files likely affected**
- `prisma/schema.prisma`, new migration under `prisma/migrations/`, `prisma/seed.ts`
- `lib/payments/yookassa/{index,live,stub,types}.ts`, `lib/payments/applyPaymentResult.ts`, `lib/payments/money.ts`, `lib/payments/receipt.ts`
- `lib/validation/payment.ts` (webhook notification + checkout schemas), `lib/env.ts`, `lib/constants.ts` (`PAYMENT_HOLD_MINUTES = 20`), `lib/mail.ts`
- `package.json` — add `axios`
- `app/api/checkout/route.ts`, `app/api/payments/yookassa/webhook/route.ts`, `app/api/orders/[id]/route.ts`
- `app/checkout/return/page.tsx`, `app/dev/yookassa/[paymentId]/page.tsx`
- `types/payment.ts`, `.env.example`
- `__tests__/payments/*`, `__tests__/api/checkout.test.ts`, `__tests__/api/yookassa-webhook.test.ts`

**Constraints**
- **No credentials exist.** `YOOKASSA_MODE` defaults to `stub`, so `pnpm dev` and the whole test suite run with zero provider access. Switching to `live` must be an env change only — no code edits. This mirrors the `lib/mail.ts` precedent.
- **Money is integer kopecks in our DB, a two-decimal string in the ЮKassa payload.** Conversion lives in one tested helper. No `Number.toFixed` round-tripping through floats.
- **Webhooks need a public HTTPS endpoint** — impossible on localhost, which is the second reason for stub mode. `ngrok`/`cloudflared` is the escape hatch once a test shop exists.
- **IP allowlist behind nginx.** On the Selectel VPS the app sees nginx's IP, so the check must read the forwarded client IP and nginx must set `X-Real-IP`/`X-Forwarded-For`. Getting this wrong fails either open (accepts spoofed notifications) or closed (rejects all real ones) — cover both with tests using an explicit injected IP.
- **CSP.** `proxy.ts` sets `form-action 'self'`, so the redirect to ЮKassa must be a top-level navigation (`window.location.assign`) or a server-issued 303 — **not** a cross-origin form POST.
- **Concurrency.** Row-level locks on `Walk` during checkout and on `Order` during `applyPaymentResult`; VPS deployment means no serverless timeout pressure.
- `auth.ts` currently uses `strategy: 'jwt'`, not the database sessions described in `CLAUDE.md`. Doesn't block this feature, but don't "fix" it here.

**Dependencies**
- **Add `axios`** to `package.json` — it is not installed yet, and it is required (decided; `fetch` was rejected). `live.ts` builds one configured Axios instance — `baseURL`, `auth: { username: shopId, password: secretKey }`, `timeout`, `validateStatus` — and reuses it. The stub imports no HTTP client at all, so tests can assert the instance is never touched.
- Rate limiting uses the existing in-memory store in `lib/rateLimit.ts`.

## Open questions

1. **Notification IP allowlist.** The exact ranges must be copied from the current ЮKassa docs at implementation time; a stale list silently rejects real payments. Store as a constant with a link and a "checked on <date>" comment.
2. **Test shop.** A ЮKassa test shop can be created before the contract is signed; once available, add a `live`-mode smoke test against it. Not a blocker for building.
3. **Max seats per order** — `CartItem.quantity` is capped `1..10` in the schema spec but the real cap was never chosen.

## Resolved decisions

Settled with the client — implement as stated, don't relitigate.

- **HTTP client: `axios`.** `live.ts` uses a dedicated Axios instance, per the project rule. `fetch` is not an option.
- **54-ФЗ receipts: enabled.** The merchant uses «Чеки от ЮKassa», so every create-payment call carries a `receipt`. `YOOKASSA_RECEIPT_ENABLED` defaults to `true` and `YOOKASSA_VAT_CODE` is a required env var in `live` mode.
- **`PAYMENT_HOLD_MINUTES = 20`,** matching the cart's existing 20-minute hold. One constant, one number to reason about.
- **No refunds in code.** No refund API call, no admin refund UI, not even for cancelled walks — the admin refunds manually in the ЮKassa dashboard. `paymentIssue` flags an order for a human; it never triggers an automated refund.
