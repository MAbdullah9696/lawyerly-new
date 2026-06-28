# Lawyerly — Railway Deployment Guide

*FYP Project · University of Management and Technology (UMT) · Fall 2025*
*Team: Ahmad Sajjad · Bilal Khan · Ubada Aleem · Hafiz Muhammad Abdullah Mazhar Bhatti*

Everything — database, object storage, backend, AI service, and both frontends — deploys on [Railway](https://railway.app). No Vercel, no Neon, no Cloudflare.

---

## Prerequisites

- A [Railway account](https://railway.app) (free plan gives $5/month credit)
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini 2.5 Flash, free tier)
- An SMTP provider for production emails (Mailtrap, Mailgun, or Gmail App Password)
- The repo pushed to a **GitHub repository**

---

## Architecture on Railway

```
Railway Project: lawyerly
├── PostgreSQL        (Railway managed database)
├── minio             (Docker image: minio/minio  — object storage)
├── core-api          (GitHub: apps/core-api      — Node.js + Socket.IO)
├── ai-service        (GitHub: apps/ai-service    — Python FastAPI)
├── web               (GitHub: apps/web           — Next.js user portal)
└── admin-web         (GitHub: apps/admin-web     — Next.js admin panel)
```

---

## Deploy Order

**You must follow this exact order.** Services depend on each other's URLs.

---

### STEP 0 — Push code to GitHub

```powershell
git add .
git commit -m "chore: Railway deployment preparation"
git push origin master
```

---

### STEP 1 — Create the Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **"Empty Project"** (you will add services manually)
3. Name it `lawyerly`

---

### STEP 2 — Add PostgreSQL

1. In the project → click **"Add Service"** → **"Database"** → **"PostgreSQL"**
2. Railway provisions the database automatically.
3. Click the PostgreSQL service → **Variables** tab → copy the `DATABASE_URL` value.
   It looks like: `postgresql://postgres:password@monorail.proxy.rlwy.net:PORT/railway`

---

### STEP 3 — Add MinIO (Object Storage)

See [docs/RAILWAY_MINIO.md](./RAILWAY_MINIO.md) for full MinIO setup instructions.

**Quick steps:**
1. **Add Service** → **Docker Image** → image: `minio/minio`
2. Start command: `server /data --console-address ":9001"`
3. Variables:
   ```
   MINIO_ROOT_USER=lawyerly
   MINIO_ROOT_PASSWORD=<generate: openssl rand -hex 24>
   ```
4. Add a **Volume** mounted at `/data` (Settings → Volumes)
5. Note the public URL for port 9000 — this is your `S3_ENDPOINT`
6. Open the MinIO console (port 9001), create bucket: `lawyerly-documents`

---

### STEP 4 — Deploy core-api

1. **Add Service** → **GitHub Repo** → select your repo
2. Set **Root Directory**: `apps/core-api`
3. Railway will detect `railway.json` and use it automatically.

#### Environment Variables for core-api

Go to the service **Variables** tab and set every variable below:

```
# Database
DATABASE_URL=<paste from Step 2>

# Server
NODE_ENV=production
CORE_API_PORT=3000

# JWT secrets (generate fresh ones)
JWT_ACCESS_SECRET=<run: openssl rand -hex 32>
JWT_REFRESH_SECRET=<run: openssl rand -hex 32>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Field encryption — must be exactly 32 bytes base64-encoded
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
FIELD_ENCRYPTION_KEY=<32-byte base64 key>

# AI
GEMINI_API_KEY=<from aistudio.google.com>
AI_SERVICE_URL=https://PLACEHOLDER   # update after Step 5
AI_SERVICE_API_KEY=<run: openssl rand -hex 32>

# Object storage (MinIO from Step 3)
S3_ENDPOINT=https://<minio-railway-url>
S3_REGION=us-east-1
S3_ACCESS_KEY=lawyerly
S3_SECRET_KEY=<your MINIO_ROOT_PASSWORD>
S3_BUCKET=lawyerly-documents

# CORS — update after Steps 6 & 7
CORS_ORIGIN=https://PLACEHOLDER_WEB,https://PLACEHOLDER_ADMIN

# Email (required in production — OTPs and resets will not work without SMTP)
EMAIL_FROM=Lawyerly <no-reply@lawyerly.pk>
SMTP_HOST=smtp.mailgun.org       # or sandbox.smtp.mailtrap.io for testing
SMTP_PORT=587
SMTP_USER=<your smtp username>
SMTP_PASSWORD=<your smtp password>
SMTP_SECURE=false

# Admin
ADMIN_ALERT_EMAIL=<your email>
```

> **CORE_API_PORT=3000** — Railway ignores the `CORE_API_PORT` env var and uses `$PORT` automatically. Set it to 3000 or omit it entirely; Railway's health check will find the service on whatever port it binds.

After Railway deploys core-api:
- Note the **public URL**, e.g. `https://core-api-production.up.railway.app`
- Go to **Settings → Shell** and run:
  ```bash
  npx prisma migrate deploy
  npx prisma db seed
  ```
  Wait for both to complete before proceeding.

---

### STEP 5 — Deploy ai-service

1. **Add Service** → **GitHub Repo** → same repo
2. Set **Root Directory**: `apps/ai-service`
3. Railway detects `railway.json` and `nixpacks.toml` automatically.
   nixpacks.toml installs `tesseract-ocr`, `poppler-utils`, spaCy, and all pip deps.

#### Environment Variables for ai-service

```
AI_SERVICE_API_KEY=<same value as core-api>
GEMINI_API_KEY=<same value as core-api>
```

After Railway deploys ai-service:
- Note the public URL, e.g. `https://ai-service-production.up.railway.app`
- Go back to **core-api → Variables** and update:
  ```
  AI_SERVICE_URL=https://ai-service-production.up.railway.app
  ```
  Railway redeploys core-api automatically.

---

### STEP 6 — Deploy web (user portal)

1. **Add Service** → **GitHub Repo** → same repo
2. Set **Root Directory**: `apps/web`

#### Environment Variables for web

```
NEXT_PUBLIC_CORE_API_URL=https://core-api-production.up.railway.app
CORE_API_URL=https://core-api-production.up.railway.app
NODE_ENV=production
```

After deploy, note the URL: e.g. `https://web-production.up.railway.app`

---

### STEP 7 — Deploy admin-web

1. **Add Service** → **GitHub Repo** → same repo
2. Set **Root Directory**: `apps/admin-web`

#### Environment Variables for admin-web

```
NEXT_PUBLIC_CORE_API_URL=https://core-api-production.up.railway.app
CORE_API_URL=https://core-api-production.up.railway.app
NODE_ENV=production
```

After deploy, note the URL: e.g. `https://admin-web-production.up.railway.app`

---

### STEP 8 — Update CORS (Final Step)

Now that all services have Railway public URLs, update core-api to allow both frontends:

1. Go to **core-api → Variables**
2. Update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://web-production.up.railway.app,https://admin-web-production.up.railway.app
   ```
3. Railway redeploys core-api automatically with the new CORS settings.

---

## Post-Deploy Verification

Run these checks after all services are up:

```bash
# 1. core-api health
curl https://core-api-production.up.railway.app/health
# → {"status":"ok","service":"core-api","time":"..."}

# 2. ai-service health
curl https://ai-service-production.up.railway.app/health
# → {"status":"ok","service":"ai-service","version":"0.8.0"}
```

**Manual checks:**
- Open the web URL → register a citizen → check email for OTP (or Railway logs if SMTP not yet configured)
- Open the admin URL → login with `superadmin` / `Admin@2025` + TOTP
- Start a consultation → send a message (confirms WebSockets work)
- Upload a document → wait for "Analysis Complete" (confirms MinIO + ai-service work)

---

## Demo Credentials (after `npx prisma db seed`)

These are regenerated on every seed run. Use `docs/DEPLOYMENT.md` for the current TOTP secrets.

**Admin panel** (`/admin/login`):

| Username | Password | Role | 2FA |
|---|---|---|---|
| `superadmin` | `Admin@2025` | Super Admin | See `docs/DEPLOYMENT.md` |
| `moderator1` | `Admin@2025` | Moderator | See `docs/DEPLOYMENT.md` |
| `analyst1` | `Admin@2025` | Analyst | See `docs/DEPLOYMENT.md` |

**Lawyers / Citizens** (user portal):

| Email | Password |
|---|---|
| `bilal.ahmed@lawyerly.pk` | `Lawyer@2025` |
| `ahmed.raza@example.com` | `Lawyer@2025` |

---

## Railway Free Tier Limits

| Resource | Limit | Impact |
|---|---|---|
| Credit | $5/month | Covers ~500 CPU hours across all services |
| Services | Unlimited | Fine for 6 services |
| RAM | 512 MB per service | ai-service uses most (spaCy model loads into memory) |
| Sleep | After 30 min idle (Hobby plan) | Add UptimeRobot ping to `/health` to keep warm |
| Storage (volumes) | 5 GB free | Sufficient for demo documents |

**Keep-alive tip:** In [UptimeRobot](https://uptimerobot.com) (free), add HTTP monitors for:
- `https://core-api-production.up.railway.app/health` — every 5 minutes
- `https://ai-service-production.up.railway.app/health` — every 5 minutes

---

## Environment Variables Reference

### core-api — Full List

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://...` from Railway PostgreSQL |
| `NODE_ENV` | Yes | `production` |
| `JWT_ACCESS_SECRET` | Yes | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Yes | `openssl rand -hex 32` |
| `FIELD_ENCRYPTION_KEY` | Yes | 32-byte base64 key |
| `GEMINI_API_KEY` | Yes | From aistudio.google.com |
| `AI_SERVICE_URL` | Yes | Railway ai-service public URL |
| `AI_SERVICE_API_KEY` | Yes | `openssl rand -hex 32` |
| `S3_ENDPOINT` | Yes | Railway MinIO public URL (port 9000) |
| `S3_ACCESS_KEY` | Yes | `lawyerly` |
| `S3_SECRET_KEY` | Yes | Your MinIO root password |
| `S3_BUCKET` | Yes | `lawyerly-documents` |
| `S3_REGION` | No | `us-east-1` |
| `CORS_ORIGIN` | Yes | `https://web.railway.app,https://admin.railway.app` |
| `EMAIL_FROM` | No | `Lawyerly <no-reply@lawyerly.pk>` |
| `SMTP_HOST` | Yes (prod) | `smtp.mailgun.org` |
| `SMTP_PORT` | No | `587` |
| `SMTP_USER` | Yes (prod) | Your SMTP username |
| `SMTP_PASSWORD` | Yes (prod) | Your SMTP password |
| `ADMIN_ALERT_EMAIL` | No | Your email |

### ai-service — Full List

| Variable | Required | Example |
|---|---|---|
| `AI_SERVICE_API_KEY` | Yes | Same value as core-api |
| `GEMINI_API_KEY` | Yes | From aistudio.google.com |

### web — Full List

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_CORE_API_URL` | Yes | Railway core-api public URL |
| `CORE_API_URL` | Yes | Railway core-api public URL (same) |
| `NODE_ENV` | No | `production` |

### admin-web — Full List

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_CORE_API_URL` | Yes | Railway core-api public URL |
| `CORE_API_URL` | Yes | Railway core-api public URL (same) |
| `NODE_ENV` | No | `production` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| core-api fails to start | Check Railway logs — usually a missing env var. Run `npx prisma generate` if Prisma client is missing |
| `FIELD_ENCRYPTION_KEY must be 32 bytes` | Use `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| ai-service crashes at startup | Railway logs will show the spaCy model download step. First deploy may take 3–5 min |
| Document upload fails | Verify `S3_ENDPOINT` is the MinIO port-9000 URL (not 9001 console). Ensure bucket exists |
| CORS error in browser | Update `CORS_ORIGIN` in core-api to include the exact Railway frontend URLs (no trailing slash) |
| WebSocket disconnects | Railway supports persistent WebSockets on all plans. If issues persist, check the Socket.IO `transports` setting in the web client |
| OTP emails not arriving | In production, ensure `SMTP_HOST` is set. Without it, emails are silently dropped and a warning appears in Railway logs |
| `npx prisma migrate deploy` fails | Run from Railway Shell in the core-api service. Make sure `DATABASE_URL` is set |
| Admin TOTP codes rejected | TOTP secrets change on every `prisma db seed` run. Check `docs/DEPLOYMENT.md` for the current secrets |
