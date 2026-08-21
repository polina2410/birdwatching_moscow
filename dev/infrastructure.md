# Infrastructure

Services required to run the project. Credentials (passwords, keys, server IP) are stored outside the repository — in the team password manager.

---

## Selectel VPS

**Role:** the server that runs the application.

The project is deployed on a VPS, not a serverless platform. This means:
- no function execution time limits
- long-running background tasks are fine (e.g. certificate generation via Puppeteer)

**Configured outside the repo:** IP address, SSH key, nginx config, systemd unit for the app process.

---

## PostgreSQL

**Role:** primary database. Schema managed by Prisma.

| Environment | Where it runs |
|---|---|
| Local | Docker (`docker compose up -d`) |
| Production | Same VPS (Selectel) |

**Env variable:**
```
DATABASE_URL=postgresql://user:password@host:5432/birdwatching_moscow
```

---

## Yandex Cloud Postbox

**Role:** transactional email — welcome, password reset, login code, payment confirmation.

SMTP gateway: `postbox.cloud.yandex.net:587` (STARTTLS). The host is hardcoded in `lib/constants.ts` and requires no env configuration.

A verified sender domain is required — add DKIM and SPF DNS records via the Yandex Cloud console.

**Getting credentials:**
```bash
yc iam api-key create --scope yc.postbox.send
# id     → POSTBOX_SMTP_USER
# secret → POSTBOX_SMTP_PASSWORD
```

**Env variables:**
```
POSTBOX_SMTP_USER=        # id from api-key create
POSTBOX_SMTP_PASSWORD=    # secret from api-key create
POSTBOX_FROM_ADDRESS=     # verified sender address
POSTBOX_FROM_NAME=Птицы Москвы
```

**Local development:** if `POSTBOX_SMTP_USER` is unset, `sendMail()` skips silently — no error.

---

## YooKassa

**Role:** payment processing. Uses the embedded widget (not a redirect to a hosted page).

The app runs in one of two modes, switched via env:

| Mode | Behaviour |
|---|---|
| `stub` (default) | Full payment flow with no real YooKassa API calls |
| `live` | Real payments; missing required variables throw at startup |

**Env variables:**
```
YOOKASSA_MODE=stub           # or live
YOOKASSA_SHOP_ID=            # required in live
YOOKASSA_SECRET_KEY=         # required in live
YOOKASSA_RECEIPT_ENABLED=true
YOOKASSA_VAT_CODE=           # required in live when receipts are enabled (54-FZ)
```

Widget docs: https://yookassa.ru/developers/payment-acceptance/integration-scenarios/widget/basics

---

## Local development

Only one service needs to be running:

```bash
docker compose up -d   # starts PostgreSQL
pnpm dev
```

Email and payments work in stub/skip mode with no additional setup.
