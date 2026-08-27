# Project Roadmap

## Iteration I
✅ **Dependency audit & static analysis:**
- Run `pnpm audit` before launch; resolve any high/critical findings
- Add `pnpm audit --audit-level=high` to CI so new vulnerabilities are caught automatically
- Enable automated dependency scanning (Snyk or GitHub Dependabot) to run continuously — catches new CVEs in existing dependencies without manual checks
- Add ESLint security rules (`eslint-plugin-security`) to the lint step — runs on every commit and flags common issues (unsafe regex, `eval`, unvalidated redirects, etc.)

### ✅ 1. Infrastructure: Domain purchase & DNS
- Purchase the production domain
- Point DNS to Selectel VPS IP (A record)
- Add MX record for the sending domain (Yandex Cloud Postbox)
- Add SPF, DKIM, DMARC records for outbound email deliverability
- Add CAA record (`0 issue "letsencrypt.org"`) — restricts which CAs may issue certificates for the domain
- Verify records propagate with `dig` / MXToolbox

### ✅ 2. Infrastructure: Selectel VPS setup & first deployment
Stand up the full production stack on the VPS:
- Install Node.js (LTS), pnpm, PostgreSQL
- Configure PostgreSQL: create DB user + database, restrict to localhost
- Run Prisma migrations: `pnpm exec prisma migrate deploy`
- Configure environment variables in `.env.production` (never committed)
- Build the app: `pnpm build`
- Run with PM2: `pm2 start "pnpm start" --name birdwatching`
- Nginx reverse proxy: port 3000 → 443, HTTP → HTTPS redirect
- SSL via Let's Encrypt (`certbot --nginx`)
- Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to the Nginx HTTPS server block (HSTS)
- Confirm the app loads at the production URL

**Selectel-specific settings to configure:**
- Firewall: allow 80, 443, 22 only
- SSH: disable password auth (`PasswordAuthentication no`) and root login (`PermitRootLogin no`) in `sshd_config` — key-based access only
- Install `fail2ban` to block IPs after repeated SSH auth failures
- Enable unattended security upgrades for OS packages (`unattended-upgrades`)
- Create staging

### 3. Infrastructure: Image storage setup
Yandex Object Storage: S3-compatible, images survive VPS rebuilds, CDN-ready. Requires bucket + access key configuration.

- ✅ Create S3 client in `lib/s3.ts` (bucket + credentials wired via env)
- ✅ Document the path/bucket in `.env.example` so it can be changed per environment
- ✅ Update `next.config.js` with the correct `remotePatterns` entry for `next/image`
- Update the admin image upload route to write to the chosen destination

### ✅ 4. Infrastructure: Email delivery testing
Validate the full email pipeline against the production domain before any users sign up:

- Trigger a login code email → confirm it arrives, check spam score
- Trigger a welcome email (register a test account)
- Trigger an order-paid email (use the dev YooKassa stub)
- Trigger a password-reset email
- Check DKIM signature passes (`mail-tester.com` or similar)
- If any email lands in spam: fix SPF/DKIM record or From address

### ✅ 5. Provider wiring
Wire the missing providers into `app/layout.tsx` so client features work:
- `SessionProvider` from `next-auth/react` — required for `useSession()` in any client component
- `NavigationGuardProvider` from `components/NavigationGuardContext.tsx` — already built, not mounted

**Files:** `app/layout.tsx`

### 6. Styles
Set global styles, buttons, fonts and so on; create components for all buttons, headers, texts.
Create global classes.

### 7. Header
Site-wide navigation shell. Auth-aware — shows **Войти** or **Профиль** based on session.

**Sections:**
- Logo (links to `/`)
- Desktop nav: Прогулки (`/walks`), Экспедиции (`/expeditions`), Частные (`/private-events`), Книга (`/book`), О проекте (`/about`), Войти (`/login`) (when not authorised) or Профиль (`/profile`) (when authorised)
- Mobile: hamburger menu with the same links

**Components:** `components/header/Header.tsx`, `components/header/Header.module.css`, `components/header/MobileMenu.tsx`

### 8. Login / Registration pages
Backend is ready. Add frontend. Both flows share a single page — the difference is only one extra field.

**Flow:**
1. User enters email → system sends a one-time code to that address
2. User enters the code → if the email is already registered, they are logged in; if new, a name field appears and they complete registration
3. After auth, redirect to `callbackUrl` (preserved in the query param by middleware) — critical for the ticket-purchase flow where the user lands back on the walk page

**Login form:**
- Email field + "Получить код" button
- OTP input (6 digits) — triggers numeric keyboard on mobile
- "Отправить повторно" resend link with a cooldown timer (e.g. 60 s)
- Error states: invalid/expired code, too many attempts (rate-limited)

**Registration addition:**
- After valid code: if email is new, show a name field before completing sign-in
- Name is the only extra field — no separate registration page

**UX details:**
- `callbackUrl` query param passed to `/login`; after successful auth, `router.push(callbackUrl ?? '/profile')`
- On return to walk page after login, `BuySection` reads `pendingTickets:<walkSlug>` from localStorage and restores the selected quantity
- Page is accessible to guests only — redirect to `/profile` if already logged in

**Files:** `app/login/page.tsx`, `components/auth/LoginForm.tsx`, `components/auth/OtpInput.tsx`

### 9. Footer
Static bottom-of-page section.

**Sections:**
- Title + short tagline on the left
- Разделы (Прогулки (`/walks`), Экспедиции (`/expeditions`), Частные события (`/private-events`), О проекте (`/about`), FAQ (`/faq`), Сертификаты (`/certificates`)) and Контакты (birdwatching@mail.ru link, Оферта (`/oferta`)) columns on the right
- Contact block: email, phone, social links (VK, Telegram)
- Legal: link to `/oferta`
- Copyright line

**Files:** `components/footer/Footer.tsx`, `components/footer/Footer.module.css`

### 10. Home page: Hero, Full-width photo, Expeditions photo
**Sections:**
- Hero: photo background, headline, subtitle
- Walks photo (full-width photo component)
- Expeditions photo (full-width photo component)

**Files:** `app/page.tsx`, `components/home/Hero.tsx`, `components/ui/FullWidthPhoto.tsx`
**Prerequisite:** step 3 must be done — hero image source and `next/image` config must be resolved before this step.

### 11. Home page: Прогулки по Москве
- Shows 3 nearest walks.
- `WalksTable` with all available walks. Columns: Дата, Прогулка, Стоимость
**Files:** `components/walks/WalksTable.tsx`, `components/walks/WalkRow.tsx`

### 12. Home page: Экспедиции
Show 3 nearest expeditions. Reuses `ExpeditionCard` built in section 26.

**Files:** `components/expeditions/ExpeditionsGrid.tsx`, `components/expeditions/ExpeditionCard.tsx`

### 13. Home page: Частные события, Книга
**Sections:**
- Частные события
- Книга

**Files:** `components/home/PrivateEventsCard.tsx`, `components/home/BookCard.tsx`

### 14. Home page: BirdID, Сертификат
Two small feature blocks using the same component with different props.

**Files:** `components/home/FeatureCard.tsx`

### 15. Home page: Отзывы
**Files:** `components/home/reviews/Reviews.tsx`, `components/home/reviews/Review.tsx`

### 16. Home page: Partners
**Files:** `components/home/partners/Partners.tsx`, `components/home/partners/Partner.tsx`

### 17. City Walks page (`/walks`)
Fetch and display all published walks. Server component.

- Full-width photo
- Short info
- More info and photo
- Sold out: button replaced with "Sold out" badge (user can open the walk and see what's inside)

**Empty and error states:**
- No upcoming walks: "Прогулок пока нет — следите за обновлениями"
- DB error: generic "Что-то пошло не так" with a reload prompt

**Queries:** use Prisma `include` + `_count` to fetch guide and ticket count in a single query — avoid N+1 on the guide join.

**Components:** `components/walks/CityWalksPage.tsx`, `components/walks/WalksTable.tsx`, `components/walks/WalkRow.tsx`
**Files:** `app/walks/page.tsx`

### 18. Walk detail page
- Path: `/walk-name` — the walk's name latinised with spaces replaced by `-`
- About event
- Guide (reuses team member info from DB)
- Important info
- Optional second info block
- Price and purchase block (`BuySection` from section 24)
- Certificate upselling block

**Files:** `app/[walkSlug]/page.tsx`, `components/walks/WalkDetailPage.tsx`, `components/walks/ImportantInfoCard.tsx`, `components/walks/Guide.tsx`

### 19. Admin panel styling
The entire admin section currently renders with no CSS — raw HTML tables, unstyled forms, no layout. Must be done before other admin sections since it defines the shared layout.

`app/admin/` index page: cards/links to Прогулки, Экспедиции, Заявки, Команда, Заказы, Пользователи.

**Scope:**
- Shared admin layout: sidebar nav, page header, content area — `app/admin/layout.tsx` + CSS Modules
- Responsive: admin is desktop-first (staff use it on desktop), but should not break on tablet

### 20. Admin: Walks management
Lets the admin create, edit, publish, and delete walks without Prisma Studio.

**Admin UI** (`app/admin/walks/`):
- List page — all walks (past and upcoming), status badge, Edit / Delete / Publish toggle per row
- Create / edit form — title, slug (auto-generated from title, editable), date & time, meeting point, description, price, total spots, guide assignment, published toggle
- Delete — confirm before sending

**API routes:**
- `GET`, `POST /api/admin/walks`
- `PATCH`, `DELETE /api/admin/walks/[id]`

### 21. Profile page — shell & personal info
Route-guarded (middleware already handles redirect to `/login`). Client component using `useSession`.

**Scope:** page layout, route guard, personal info section only — no ticket data.

**Sections:**
- Personal info: name, email (read-only for now)
- Empty ticket area: placeholder "Ваши билеты появятся здесь" until section 22 is built

**Data:** `GET /api/profile` — returns `{ name, email }` for now; ticket fields added in section 22.
**Files:** `app/profile/page.tsx`, `components/profile/Profile.tsx` (replaces stub)

### 22. Profile page — ticket history & QR codes
Extends the profile page from section 21 with order history.

**Sections:**
- Upcoming tickets: walk title, date, location, ticket count, QR code
- Past tickets: same, in a separate collapsed section or tab

**Data:** extend `GET /api/profile` to include `orders` + `OrderItem` rows.
**QR codes:** use `qrcode.react`; decide before building: inline QR or "Download" button. Add library to `package.json` first.
**New components:** `components/profile/TicketCard.tsx`

### 23. Mail blueprints
Email templates sent to users on key events. Built with React Email or plain HTML — decide before starting.

**Templates** (`lib/emails/templates/`):
- `register.tsx` — welcome email on first sign-in; includes name, link to profile
- `otp-login.tsx` — OTP code email; includes the 6-digit code and expiry time
- `ticket-purchase.tsx` — order confirmation; includes walk title, date, location, ticket count, total price, QR code placeholder
- `join-request.tsx` — confirmation to the user that their expedition/private walk request was received; includes event name and next steps

**Files:** `lib/emails/templates/register.tsx`, `lib/emails/templates/otp-login.tsx`, `lib/emails/templates/ticket-purchase.tsx`, `lib/emails/templates/join-request.tsx`

### 24. Ticket purchase — UI & quantity persistence
Build the buy section on the walk page. No payment integration yet — ends at the "Купить" button.

**Scope:**
- `QuantityPicker` — quantity selector, 1–N capped at spots remaining
- `BuySection` — shows `QuantityPicker` + "Купить" button (logged in) or "Залогиньтесь для оплаты" (guest)
- localStorage persistence: on quantity change write `pendingTickets:<walkSlug>` = `{ quantity, walkSlug }`; on mount restore it; clear on quantity → 0

**New components:**
- `components/ui/QuantityPicker.tsx`
- `components/walks/BuySection.tsx`

### 25. Ticket purchase — YooKassa widget & success flow
Wire the payment layer. Depends on section 24 (`BuySection` already renders the "Купить" button).

**Flow:**
1. "Купить" clicked → `POST /api/checkout` → receive `{ orderId, confirmationToken }`
2. Mount YooKassa widget inline with `confirmationToken`; widget gives the user **20 minutes** to pay
3. Poll `GET /api/orders/[id]` until status is `paid` or `failed`
4. On `paid`: clear localStorage key, redirect to the walk page with `?success=true`
5. Walk page reads `?success=true` → shows "Спасибо за покупку" banner → removes param from URL

✅ **Ticket blocking:** server-side in `/api/checkout` with a Prisma transaction + row-level lock. Sold-out error: "Мест больше нет".

**API routes already implemented:**
- ✅ `POST /api/checkout`
- ✅ `POST /api/payments/yookassa/webhook`
- ✅ `GET /api/orders/[id]`

### 26. Expeditions page (`/expeditions`)
Fetch and display all published expeditions. Server component.

- Full-width photo
- Explanation
- More explanation + photo
- List of active expeditions via `ExpeditionsGrid`

**Expedition card shows:** title, destination, dates (start–end), duration (days), guide name, price per spot, spots remaining, "Learn more / Apply" CTA.

**Empty and error states:**
- No expeditions: "Экспедиций пока нет — следите за обновлениями"
- DB error: generic reload prompt

**Queries:** use Prisma `include` to fetch guide(s) in a single query — avoid N+1.

**New components:**
- `components/expeditions/ExpeditionCard.tsx` + `.module.css`
- `components/expeditions/ExpeditionsGrid.tsx` (replaces stub)

### 27. Expedition details
**New route:** `app/expeditions/[slug]/page.tsx`
**Detail page sections:** full description, day-by-day itinerary, guide bios, what's included/excluded, price breakdown, spots remaining.

**New components:** `components/expeditions/ExpeditionDetailPage.tsx`
**API routes:** `app/api/requests/route.ts` — validate body (Zod), create `Request` row, return 201. Zod schema to `lib/validation/`

### 28. Join request
**Request form:**
- Fields: name, email, phone, message (optional); pre-filled from session if logged in
- Open to guests — no auth gate on this form
- Success: inline confirmation message; `join-request` email sent to the user
- Props needed: type (`expedition` | `private`); on expedition, expedition name/id is saved

**New components:** `components/expeditions/RequestForm.tsx`
**API routes:** `/api/requests` → creates `Request` record (already implemented)

### 29. Admin: Expeditions management
Lets the admin create, edit, publish, and delete expeditions without Prisma Studio.

**Admin UI** (`app/admin/expeditions/`):
- List page — all expeditions, status badge, Edit / Delete / Publish toggle per row
- Create / edit form — title, slug (auto-generated, editable), destination, start/end dates, description, itinerary, price, total spots, guide assignment(s), published toggle
- Delete — confirm before sending

**API routes:**
- `GET`, `POST /api/admin/expeditions`
- `PATCH`, `DELETE /api/admin/expeditions/[id]`

### 30. Admin: Join requests management
Lets the admin view and manage expedition and private walk join requests submitted via the request form.

**Admin UI** (`app/admin/requests/`):
- List page — table of all requests: name, email, walk/expedition requested, message, submitted date
- Filter by walk/expedition and by status
- No create form — requests come only from the public form

**API routes:**
- `GET /api/admin/requests` — list all requests; supports `?walkId=` and `?status=` query params
- `DELETE /api/admin/requests/[id]` — delete a request; confirm before sending

### 31. Project page (`/about`)
- Fetch all team members from DB and display as cards
- About project info
- Card shows: photo, name, role/title, short bio, ebird link
- DB error: generic reload prompt

**New components:**
- `components/team/TeamMemberCard.tsx` + `.module.css`
- `components/team/Team.tsx` (replaces stub)

### 32. Admin: Team members management
Lets the admin create, edit, and delete team members without Prisma Studio.

**Admin UI** (`app/admin/team/`):
- List page — all members, photo thumbnail, name, role, Edit / Delete per row
- Create / edit form — name, role/title, short bio, photo upload (to Yandex Object Storage), ebird link

**API routes:**
- `GET`, `POST /api/admin/team`
- `PATCH`, `DELETE /api/admin/team/[id]`

### 33. Admin: Orders & users
Gives the admin visibility into what's happening on the platform.

**Orders list** (`app/admin/orders/`):
- Table: order ID, username + email, walk/expedition title, ticket count, total amount, status (pending / paid / failed), date
- Filter by status and by walk/expedition
- Row detail: expand to see individual `OrderItem` rows
- No edit — orders are read-only; refunds handled outside the app for now
- API route: `GET /api/admin/orders` with optional `?status=` and `?walkId=` query params

**Users list** (`app/admin/users/`):
- Table: name, email, registered date, order count
- Read-only; no user edit or delete in Iteration I
- API route: `GET /api/admin/users`

### 34. Book page (`/book`)
- Hero section
- About book
- Author

### 35. FAQ page (`/faq`)
Server component — fetches FAQ items from DB (see Admin: FAQ management in Iteration II).

**New components:**
- `components/ui/accordion/Accordion.tsx` — reusable expand/collapse list
- `components/faq/FAQ.tsx` (replaces stub) — renders items fetched from DB

### 37. Private events page (`/private-events`)
Static description of the private events offering + request form (`RequestForm` from section 28 with `type="private"`).

**Files:** `components/private-events/PrivateEvents.tsx` (replaces stub), `components/private-events/PrivateEvents.module.css`

### 38. Oferta page (`/oferta`)
Legal public offer text. Fully static.

**Files:** `components/oferta/Oferta.tsx` (replaces blue stub) — formatted prose

### 39. BirdID (simple version, TBD in iteration 2)
- Create a path (`/birdid`)
- Basic data

**Files:** `components/birdid/BirdID.tsx`

### 40. Certificates
Create a Сертификаты page and path (`/certificates`); fill with basic info.

**Files:** `components/certificates/Certificates.tsx`

### 41. SEO & Open Graph
Add metadata to every public page so the site is indexed correctly by Yandex and Google, and links share well on Telegram and VK.

**Per-page work:**
- `generateMetadata` export on each page (title, description, og:title, og:description, og:image, og:url)
- Dynamic routes (expedition detail) generate metadata from DB data
- Static pages use fixed strings

**Site-wide:**
- `public/robots.txt` — allow all, point to sitemap
- `app/sitemap.ts` — Next.js sitemap generator; include all published walks and expedition slugs
- Yandex.Metrica counter script in `app/layout.tsx` (add to `<head>`)
- Canonical URLs set on all pages

**OG images:** static fallback image (`public/og-default.jpg`) for all pages; per-walk and per-expedition dynamic OG images are a Stage 2 nice-to-have.

### 42. Loading skeletons & route loading states
Two layers of loading UI are needed: a route-level `loading.tsx` for instant feedback on navigation, and component-level skeletons inside `<Suspense>` for streaming data.

**Route-level `loading.tsx`** — Next.js shows this file instantly on navigation while the page's async server component resolves. Add one for every non-static route:
- `app/walks/loading.tsx`
- `app/[walkSlug]/loading.tsx`
- `app/expeditions/loading.tsx`
- `app/expeditions/[slug]/loading.tsx`
- `app/profile/loading.tsx`
- `app/admin/walks/loading.tsx`
- `app/admin/expeditions/loading.tsx`
- `app/admin/team/loading.tsx`
- `app/admin/orders/loading.tsx`
- `app/admin/users/loading.tsx`
- `app/admin/faq/loading.tsx`

Each `loading.tsx` renders the matching skeleton component so the two layers are visually consistent.

**Component-level skeletons** — wrap async sections in `<Suspense>` for fine-grained streaming within a page:
- Walks listing — skeleton table rows (`WalkRowSkeleton.tsx`)
- Walk detail — skeleton for title, date, guide block, `BuySection`
- Expeditions listing — skeleton cards (`ExpeditionCardSkeleton.tsx`)
- Expedition detail — skeleton for description, itinerary, guide block
- Profile — skeleton for personal info and ticket list

**Pattern:** each skeleton lives alongside its real component — `WalkRow.tsx` → `WalkRowSkeleton.tsx`, etc. Use CSS `@keyframes pulse` for the shimmer; no extra library needed.

### 43. Performance testing
Validate the app performs acceptably under realistic load before opening to the public.

**Lighthouse / Core Web Vitals:**
- Run Lighthouse on home, walks listing, expedition detail
- Target: LCP < 2.5s, CLS < 0.1, INP < 200ms
- Fix any large images (`next/image` sizes/priority), render-blocking scripts, or layout shifts

**Load testing:**
- Simulate concurrent checkout attempts on a single walk (the double-booking scenario)
- Confirm Prisma row-level lock holds under 50 concurrent requests (per CLAUDE.md)

**DB query analysis:**
- Run `EXPLAIN ANALYZE` on the walks and expeditions listing queries
- Add indexes if full-table scans appear on filtered columns (date, status)

### 44. Security headers & CSP
✅ **HTTP security headers**
- `X-Frame-Options: SAMEORIGIN` — clickjacking protection
- `X-Content-Type-Options: nosniff` — MIME-sniffing protection
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Content-Security-Policy — do before YooKassa goes live** (payment pages are in PCI DSS v4.0 scope):
- Start with `Content-Security-Policy-Report-Only` in staging to capture violations without breaking the app
- The YooKassa widget requires specific `script-src`, `frame-src`, and `connect-src` entries — check their docs for exact domains
- Next.js nonce-based CSP via middleware is the right foundation (handles inline hydration scripts without `unsafe-inline`)
- Tighten the policy iteratively until no violations appear in staging, then switch to enforcing mode

**Verify headers in production:**
- Scan the live site at `securityheaders.com` — aim for an A or A+ rating
- Fix any missing or misconfigured headers flagged in the report

### 45. YooKassa webhook HMAC verification
IP allowlisting alone is not sufficient — YooKassa signs every webhook with an HMAC-SHA256 signature. **Do this before go-live.**

- Read the `X-Request-Id` and raw body from the incoming request
- Compute `HMAC-SHA256(secret, rawBody)` using the YooKassa webhook secret stored in `.env`
- Compare with the `Authorization` header value; reject with 401 if they don't match
- This check must run before `applyPaymentResult` is called in `app/api/payments/yookassa/webhook/route.ts`
- Add a unit test: valid signature passes, tampered body returns 401

### 46. Rate limiting on sensitive endpoints
Protect the auth flow and checkout from abuse. Uses an in-memory store (sliding window) — see `lib/rateLimit.ts`.

**Endpoints to rate-limit:**
- `POST /api/auth/*` (OTP send + verify) — e.g. 5 requests per 15 min per IP
- `POST /api/checkout` — e.g. 10 requests per minute per user session

**Implementation:** a thin middleware helper `lib/rateLimit.ts` wraps each route handler; returns 429 with `Retry-After` header on breach.

### 47. Cross-browser smoke test
CLAUDE.md lists Yandex Browser as a target alongside Chrome and Safari. Run a manual smoke test in each before launch.

**Browsers to cover:** Chrome (latest), Safari (latest), Yandex Browser (latest)

**Pages to test:** home, walks listing, walk detail + ticket purchase, profile, login

**Checks per page:** layout integrity, fonts loaded, interactive elements respond, YooKassa widget renders, no console errors

### 48. Cookie & privacy notice
The site collects personal data (names, emails) and takes payments — a privacy notice is required under Russian law (152-ФЗ). Privacy policy and cookie notice are part of the Оферта page (section 38) — no separate `/privacy` page needed.

- Add a consent banner on first visit (localStorage flag to dismiss)
- Banner links to `/oferta` for the full policy text
- The banner appears at the bottom of the screen; dismissing it sets `privacy_accepted=true` in localStorage and hides it permanently
- **Files:** `components/ui/PrivacyBanner.tsx`

### 49. Security updates
- Snapshots / backups schedule
- Monitoring alert on CPU/RAM/disk thresholds

---

## Iteration II

### 1. Private: add all locations to the Частные page
**Files:** `components/ui/BirdwatchingLocations.tsx`, `components/ui/BirdwatchingLocation.tsx`

### 7. Superadmin functionality in /admin
Full user management for superadmins. Builds on the read-only users list from section 33.

**Admin UI** (`app/admin/users/`):
- Change a user's role (USER → ADMIN → SUPERADMIN and back)
- Block / unblock an account
- Soft-delete a user

**Guards:**
- At least one non-blocked SUPERADMIN must remain at all times — enforce server-side (already guarded in `_actions.ts`)
- All actions restricted to SUPERADMIN role; ADMIN hitting these routes gets 403

**API routes:**
- `PATCH /api/admin/users/[id]` — update role or blockedAt
- `DELETE /api/admin/users/[id]` — soft-delete

### 8. Cron job: expired token cleanup
Periodic cleanup of stale rows that accumulate over time but are never automatically removed.

**Tables to clean:**
- `LoginCode` — delete rows where `expiresAt < NOW()` or `usedAt IS NOT NULL`
- `PasswordResetToken` — delete rows where `expiresAt < NOW()` or `usedAt IS NOT NULL`
- `AdminLoginChallenge` — delete rows where `expiresAt < NOW()` or `usedAt IS NOT NULL`

**Implementation:** a script in `scripts/cleanup-expired-tokens.ts` running via `pnpm exec ts-node` scheduled as a daily cron job on the Selectel VPS (system crontab or PM2 cron mode).

### 2. Admin: FAQ management
Lets the admin create, edit, delete, and reorder FAQ items without a code deploy.

**Schema:**
- Add `Faq` model to Prisma: `id`, `question`, `answer`, `order` (Int), `published` (Boolean); run migration

**Admin UI** (`app/admin/faq/`):
- List page — shows all FAQ items in current order; each row has Edit and Delete buttons
- Drag-and-drop reordering — use `@dnd-kit/sortable`; on drop, `PATCH /api/admin/faq/reorder` sends the new `[{ id, order }]` array
- Create / edit form — question + answer fields; published toggle; saves via `POST` or `PATCH /api/admin/faq/[id]`
- Delete — `DELETE /api/admin/faq/[id]`; confirm before sending

**API routes** (`app/api/admin/faq/`):
- `GET /api/admin/faq` — return all items ordered by `order`
- `POST /api/admin/faq` — create item
- `PATCH /api/admin/faq/[id]` — update question / answer / published
- `DELETE /api/admin/faq/[id]` — delete item
- `PATCH /api/admin/faq/reorder` — accept `{ items: { id, order }[] }`, update all in a single Prisma transaction

**Public page:** `FAQ.tsx` calls `prisma.faq.findMany({ where: { published: true }, orderBy: { order: 'asc' } })`
**New dependency:** `@dnd-kit/core`, `@dnd-kit/sortable`

### 3. BirdID
### 4. Login/Registration in purchase page
### 5. PDF book on `book` page
### 6. Certificates Generation

