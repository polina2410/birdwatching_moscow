# Project Roadmap

**Dependency audit & static analysis:**
- ✅ Run `pnpm audit` before launch; resolve any high/critical findings
- ✅ Add `pnpm audit --audit-level=high` to CI so new vulnerabilities are caught automatically
- ✅ Enable automated dependency scanning (Snyk or GitHub Dependabot) to run continuously — catches new CVEs in existing dependencies without manual checks
- ✅ Add ESLint security rules (`eslint-plugin-security`) to the lint step — runs on every commit and flags common issues (unsafe regex, `eval`, unvalidated redirects, etc.)

---

## Part I — Infrastructure _(start before or alongside Part II)_

### Inf-A: Domain purchase & DNS

- Purchase the production domain
- Point DNS to Selectel VPS IP (A record)
- Add MX record for the sending domain (Yandex Cloud Postbox)
- Add SPF, DKIM, DMARC records for outbound email deliverability
- Add CAA record (`0 issue "letsencrypt.org"`) — restricts which CAs may issue certificates for the domain
- Verify records propagate with `dig` / MXToolbox

### Inf-B: Selectel VPS setup & first deployment

Stand up the full production stack on the VPS:

- Install Node.js (LTS), pnpm, PostgreSQL, Redis
- Configure PostgreSQL: create DB user + database, restrict to localhost
- Configure Redis: bind to localhost, set `requirepass`
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
- Snapshots / backups schedule
- Monitoring alert on CPU/RAM/disk thresholds

### Inf-C: Image storage setup

Decide and configure where user-uploaded images live (walk photos, expedition covers, team member photos, hero background):

**Option A — VPS filesystem:** simpler, images served via Nginx at `/uploads`, no extra cost. Risk: images lost if VPS is rebuilt without a backup.
**Option B — Yandex Object Storage:** S3-compatible, images survive VPS rebuilds, CDN-ready. Requires bucket + access key configuration.

Whichever is chosen:
- Update `next.config.js` with the correct `remotePatterns` entry for `next/image`
- Update the admin image upload route to write to the chosen destination
- Document the path/bucket in `.env` so it can be changed per environment

### Inf-D: Email delivery testing

Validate the full email pipeline against the production domain before any users sign up:

- Trigger a login code email → confirm it arrives, check spam score
- Trigger a welcome email (register a test account)
- Trigger an order-paid email (use the dev YooKassa stub)
- Trigger a password-reset email
- Check DKIM signature passes (`mail-tester.com` or similar)
- If any email lands in spam: fix SPF/DKIM record or From address

---

## Part II — Public frontend

### 1. Provider wiring

Wire the missing providers into `app/layout.tsx` so client features work:

- `SessionProvider` from `next-auth/react` — required for `useSession()` in any client component
- `NavigationGuardProvider` from `components/NavigationGuardContext.tsx` — already built, not mounted
- `<Toaster />` from `sonner` — already in dependencies, not mounted

**Files:** `app/layout.tsx`

---

### 2. Header


Site-wide navigation shell. Auth-aware — shows **Login** or **Profile** based on session.


**Sections:**
- Logo (links to `/`)
- Desktop nav: Walks (`/moscow`), Expeditions (`/expeditions`), Team (`/team`), FAQ (`/faq`), Contact (`/contact`), Private (`/private`)
- Auth CTA: **Login** button → `/login`, or **Profile** link → `/profile` when logged in
- Mobile: hamburger menu with the same links
- Cart icon — rendered as a placeholder with no badge in this step; badge and `CartContext` wiring are added in step 5


**New components:** `components/Header.module.css`, `components/nav/MobileMenu.tsx`
**Uses:** `Button`, `useSession`


---


### 2. Footer


Static bottom-of-page section.


**Sections:**
- Logo + short tagline
- Nav columns: same links as header
- Contact block: email, phone, social links (VK, Telegram)
- Legal: link to `/oferta`
- Copyright line


**Files:** `components/Footer.tsx`, `components/Footer.module.css`


---


### 3. Home page


First page a visitor sees. Server component — fetches 3 nearest upcoming walks from DB.


**Sections:**
- Hero: photo background, headline, subtitle, CTA button → `/moscow`
- "What we do" intro: 2–3 short blocks (walks / expeditions / team)
- Upcoming walks teaser: 3 nearest published walks as cards, "View all" → `/moscow`; if none, show "Прогулок пока нет — следите за обновлениями"
- CTA strip: "Join an expedition" → `/expeditions`


**Files:** `app/page.tsx`, `components/home/Hero.tsx`, `components/home/WalkTeaser.tsx`


**Prerequisite:** Inf-C must be done — hero image source and `next/image` config must be resolved before this step.


---


### 4. City Walks listing (`/moscow`)


Fetch and display all published walks. Server component.


**Walk card shows:** title, date + time, location, guide name + photo thumbnail, price (per person), spots left (capacity − sold), action button.


**Capacity states on WalkCard:**
- Available: "Add to cart" button + spots remaining count
- Low availability (≤ 5 spots): spots count shown in warning colour
- Sold out: button replaced with "Sold out" badge (disabled), no spots count


**Filtering:** URL search params — `?past=1` toggles past walks (server-rendered, shareable, works without JS). Default shows upcoming only.


**Empty and error states:**
- No upcoming walks: "Прогулок пока нет — следите за обновлениями"
- DB error: generic "Что-то пошло не так" with a reload prompt


**Pagination:** fetch up to 20 walks per page; `?page=N` URL param. If total ≤ 20, no pagination UI needed.


**Queries:** use Prisma `include` + `_count` to fetch guide and ticket count in a single query — avoid N+1 on the guide join.


**Step 4+5 coupling:** `WalkCard` accepts an `onAddToCart` prop (no-op stub in this step). Step 5 wires the real handler. This avoids rebuilding the card component later.


**New components:**
- `components/cityWalks/WalkCard.tsx` + `.module.css`
- `components/cityWalks/CityWalks.tsx` (replaces stub)


**Files:** `app/moscow/page.tsx`, component files above


---


### 5. Cart & ticket purchase


Multi-item cart backed by the existing `CartItem` DB model. Guests can add items; login is required only at checkout.


**Guest cart (localStorage):**
- Unauthenticated users can add walks to cart — stored as `[{ walkId, quantity }]` in `localStorage`
- Cart icon and drawer work the same for guests (reading from `localStorage`)
- At checkout click: if not logged in, `LoginPrompt` appears; after login/register, `/api/cart/merge` syncs the localStorage items into DB `CartItem` rows, then proceeds to checkout


**Authenticated cart (DB):**
- Reads/writes `CartItem` rows via API routes
- On session start, if localStorage has items, merge is triggered automatically


✅ **Ticket blocking:** handled server-side in `/api/checkout` with a Prisma transaction + row-level lock. If a walk sells out between cart-add and checkout, the user receives a clear error ("Мест больше нет"). No client-side reservation is needed.


**Flow:**
1. "Add to cart" on a walk card → quantity picker (1–4, capped at spots left) → stored in localStorage (guest) or `POST /api/cart` (authed)
2. Cart icon in Header updated (this step) with `CartContext` and item count badge
3. Cart drawer lists all items: walk title, date, qty, line total, remove button
4. "Checkout" → `LoginPrompt` if guest → after login, merge → `POST /api/checkout` with all cart items → receive `confirmationUrl` → redirect to YooKassa
5. ✅ Return to `/checkout/return` — page exists; apply design pass to match the new design system


**New API routes (cart — not yet built):**
- `GET /api/cart` — fetch current DB cart items
- `POST /api/cart` — add item (walkId + quantity)
- `PATCH /api/cart/[id]` — update quantity
- `DELETE /api/cart/[id]` — remove item
- `POST /api/cart/merge` — merge a localStorage cart payload into DB CartItems (called on login)

**API routes already implemented (payment — from YooKassa feature):**
- ✅ `POST /api/checkout` — creates `Order` + `OrderItem` rows, calls YooKassa Smart Payment, returns `{ orderId, confirmationUrl }`
- ✅ `POST /api/payments/yookassa/webhook` — IP-allowlist check, dispatches to `applyPaymentResult`
- ✅ `GET /api/orders/[id]` — owner-only status polling


**New components:**
- `components/ui/QuantityPicker.tsx`
- `components/ui/login-prompt/LoginPrompt.tsx` — shared auth-gate modal, reused in checkout and any other protected action
- `components/cart/CartDrawer.tsx` — slide-in panel, triggered from Header
- `components/cart/CartItem.tsx` — single line item
- `components/cart/CartContext.tsx` — client context: reads localStorage (guest) or DB (authed), item count, open/close drawer, merge-on-login logic


**Header update:** mount `CartContext` in layout; wire the Header cart icon to show the badge from context.


---


### 6. Expeditions listing (`/expeditions`)


Fetch and display all published expeditions. Server component.


**Expedition card shows:** title, destination, dates (start–end), duration (days), guide name, price per spot, spots remaining, "Learn more / Apply" CTA.


**Empty and error states:**
- No expeditions: "Экспедиций пока нет — следите за обновлениями"
- DB error: generic reload prompt


**Pagination:** up to 20 per page, `?page=N` param.


**Queries:** use Prisma `include` to fetch guide(s) in a single query — avoid N+1.


**New components:**
- `components/expeditions/ExpeditionCard.tsx` + `.module.css`
- `components/expeditions/Expeditions.tsx` (replaces stub)


---


### 7. Expedition detail & join request


A detail page per expedition plus a "Request a spot" form. The form is open to all visitors — no login required. If logged in, name and email are pre-filled.


**New route:** `app/expeditions/[slug]/page.tsx`


**Detail page sections:** full description, day-by-day itinerary, guide bios, what's included/excluded, price breakdown, spots remaining.


**Request form:**
- Fields: name, email, phone, message (optional); pre-filled from session if logged in
- Open to guests — no auth gate on this form
- Submits to `/api/requests` → creates `Request` record; ✅ route already implemented (see POST /api/requests feature)
- Success: inline confirmation message; no payment at this stage


✅ **New backend:** `app/api/requests/route.ts` — validate body (Zod), create `Request` row, return 201. Add Zod schema to `lib/validation/`.


**New components:** `components/expeditions/ExpeditionDetail.tsx`, `components/expeditions/RequestForm.tsx`


---


### 8. Team page (`/team`)


Fetch all team members from DB and display as cards.


**Card shows:** photo, name, role/title, short bio, achievements badge (if any).


**Empty and error states:**
- No members: hide section or show placeholder
- DB error: generic reload prompt


**New components:**
- `components/team/TeamMemberCard.tsx` + `.module.css`
- `components/team/Team.tsx` (replaces stub)


---


### 9. FAQ page (`/faq`)


Static content page with an accordion.


**New components:**
- `components/ui/accordion/Accordion.tsx` — reusable expand/collapse list
- `components/faq/FAQ.tsx` (replaces stub) — FAQ items as data array


---


### 10. Contact page (`/contact`)


Static contact info. No database.


**Sections:** email, phone, Telegram/VK links, optional embedded map (Yandex Maps iframe).


**Files:** `components/contact/Contact.tsx` (replaces stub), `.module.css`


---


### 11. Private events page (`/private`)


Static description of the private events offering + contact prompt.


**Files:** `components/private/Private.tsx` (replaces stub), `.module.css`


---


### 12. Profile page (`/profile`)


Route-guarded (middleware already handles redirect to `/login`). Client component using `useSession`.


**Sections:**
- Personal info: name, email (read-only for now)
- Upcoming tickets: walk title, date, location, ticket count, QR code or download button
- Past tickets: same, collapsed or separate tab


**Data:** fetch user's orders + tickets from a new `GET /api/profile` route.


**QR codes:** use `qrcode.react` (or equivalent) to render a QR per ticket. Decide before building `TicketCard`: inline QR or "Download" link. Add the library to `package.json` first.


**New components:** `components/profile/Profile.tsx` (replaces stub), `components/profile/TicketCard.tsx`


---


### 13. Oferta page (`/oferta`)


Legal public offer text. Fully static.


**Files:** `components/Offer.tsx` (replaces blue stub) — formatted prose, `.module.css`


---


## Part III — Cross-cutting polish


These steps can be done after the core public frontend is live. They improve quality and discoverability across the whole site.


---


### 14. Admin panel styling


The entire admin section currently renders with no CSS — raw HTML tables, unstyled forms, no layout. This is its own feature, not part of the public frontend.


**Scope:**
- Shared admin layout: sidebar nav, page header, content area — `app/admin/layout.tsx` + CSS Modules
- Table styles: sortable headers, row hover, status badges using existing `Badge` component
- Form styles: consistent field layout using existing `FormField` component, action button placement
- Responsive: admin is desktop-first (staff use it on desktop), but should not break on tablet


**Approach:** use the existing `Button`, `Badge`, `FormField`, `Alert`, `Spinner`, `Card` UI primitives — no new UI components needed, only layout and table CSS.


---


### 15. SEO & Open Graph


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


---


### 16. Performance testing


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


---


### 17. Security headers & CSP


**HTTP security headers** ✅ — shipped in PR #32
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


