# Deploying Birdwatching Moscow

## Initial server setup (one-time)

### 1. System dependencies

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
sudo apt install postgresql postgresql-contrib -y
```

### 2. PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE birdwatching_staging;
CREATE USER birdwatching_user WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE birdwatching_staging TO birdwatching_user;
GRANT ALL ON SCHEMA public TO birdwatching_user;
```

⚠️ **Important:** PostgreSQL 15+ no longer grants privileges on the `public` schema by default, even with `ALL PRIVILEGES` on the database — the `GRANT ALL ON SCHEMA public` command is required, otherwise `prisma migrate deploy` fails with `permission denied for schema public`.

### 3. Cloning the repository

```bash
ssh-keygen -t ed25519 -C "server-deploy-key"
cat ~/.ssh/id_ed25519.pub
```

Add the key to your **personal GitHub account** (Settings → SSH and GPG keys), not to the repository's Deploy Keys — Deploy Keys are disabled by the `birdwatching-moscow` organization policy.

```bash
git clone git@github.com:YOUR_ACCOUNT_OR_ORG/YOUR_REPO_NAME.git birdwatching_moscow
```

### 4. Environment variables

**The only file you need is `.env.production`.** `prisma.config.ts` hard-codes this path for all Prisma CLI commands (`prisma migrate deploy`, `prisma generate`), and Next.js automatically loads `.env.production` when `NODE_ENV=production` (set automatically by `next build`/`next start`). Don't create `.env` or `.env.local` — they're unnecessary and create confusion.

```bash
cd ~/birdwatching_moscow
cp .env.example .env.production
nano .env.production
```

Generate `AUTH_SECRET`:
```bash
npx auth secret
```
⚠️ The command outputs the variable under the name `BETTER_AUTH_SECRET` — **use only the value**; the variable name in `.env.production` must stay `AUTH_SECRET` (as in `.env.example`), otherwise the code won't find it.

### 5. Build

```bash
pnpm install
pnpm approve-builds   # press `a` to select all packages, then Enter
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm build
```

⚠️ **Always build with webpack, not Turbopack.** `package.json` is already configured (`"build": "next build --webpack"`) — don't remove the `--webpack` flag. As of this writing, Turbopack (the Next.js 16 default) doesn't stamp CSP nonces on dynamically loaded chunks — this breaks hydration on pages with client components (notably `/login`). Tracking bug: https://github.com/vercel/next.js/issues/96063

### 6. PM2

```bash
sudo npm install -g pm2
cd ~/birdwatching_moscow
pm2 start "pnpm start" --name birdwatching --cwd ~/birdwatching_moscow
pm2 startup
pm2 save
```

### 7. Nginx + SSL

```bash
sudo apt install nginx apache2-utils certbot python3-certbot-nginx -y
sudo htpasswd -c /etc/nginx/.htpasswd_staging admin   # staging only
```

Config file `/etc/nginx/sites-available/birdwatching-staging`:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        auth_basic "Staging access";                       # remove in production
        auth_basic_user_file /etc/nginx/.htpasswd_staging;  # remove in production

        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/birdwatching-staging /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

After certbot runs, add HSTS to the `listen 443 ssl` block:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

```bash
sudo nginx -t && sudo systemctl restart nginx
```

---

## Automated deployment (GitHub Actions)

Already configured in `.github/workflows/deploy.yml` — triggers on push to `main`.

**Repository secrets** (Settings → Secrets and variables → Actions):
- `SERVER_HOST` — server IP
- `SERVER_USER` — `root`
- `SERVER_SSH_KEY` — private key of a separate key pair created specifically for CI (`~/.ssh/gh_actions_deploy` on the server), **not** a developer's personal key

The public half of this key must be added to `~/.ssh/authorized_keys` on the server.

⚠️ `appleboy/ssh-action` may be unavailable if the organization restricts third-party Actions (Organization Settings → Actions → General → Policies). If the workflow fails with `Unresolved action` / `Bad credentials`, either allow `appleboy/ssh-action@*` in the organization settings, or replace the step with a direct `ssh` call via `run:` that doesn't rely on third-party actions.

On failure, check the **Actions** tab in the repository and expand the **Deploy via SSH** step for the full log.

---

## Manual update (if needed, bypassing automated deployment)

```bash
ssh birdwatching
cd ~/birdwatching_moscow
git pull
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm build
pm2 restart birdwatching
pm2 status
```

---

## Known project quirks

- **`middleware.ts`, not `proxy.ts`.** Next.js 16.3.2 shows a deprecation warning suggesting a move to `proxy.ts`, but as of this version the runtime doesn't actually support that convention yet — a file named `proxy.ts` is not picked up. Don't rename it until this is confirmed fixed in a newer Next.js release.
- **`middleware.ts` requires `runtime: 'nodejs'`** in its `config` export — without it, Next.js runs the file in the Edge Runtime, which doesn't support the native Node.js modules (`node:crypto`, `node:fs`, etc.) that the Prisma Client needs. This is easy to accidentally drop during refactors — double-check it whenever editing `config` in this file.
- **Dynamic API routes** (`app/api/.../[id]/route.ts`) must type `context.params` strictly as `Promise<{ id: string }>`, not a union with the non-Promise variant — Next.js 16 enforces this at the generated-types level during build.
- **`/login` and the whole `app/(auth)` route group** are marked with `export const dynamic = 'force-dynamic'` — without it, the page is statically rendered at build time, and the CSP nonce baked into the HTML won't match the fresh one generated by middleware on each real request.
- **Yandex Cloud DNS:** when creating a record, put only the short label in the "Name" field (e.g. `www` or `staging-xxxxxxxx`), not the full name including the domain — otherwise the domain gets duplicated (`sub.example.com.example.com`).
- **The env file is `.env.production`, not `.env.local`.** `prisma.config.ts` originally hard-coded `.env.local` — renamed to match standard Next.js convention (`.env.local` is meant for a developer's local overrides, not for staging/production). When setting up a new server: rename the physical file first, then deploy the updated `prisma.config.ts` — otherwise one short auto-deploy cycle will fail on the filename mismatch.