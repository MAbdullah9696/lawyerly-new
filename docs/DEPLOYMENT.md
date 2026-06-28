# Lawyerly — Deployment Guide

*FYP Project · University of Management and Technology (UMT) · Fall 2025*  
*Team: Ahmad Sajjad · Bilal Khan · Ubada Aleem · Hafiz Muhammad Abdullah Mazhar Bhatti*

---

## Option A — Local Demo (FYP Presentation)

Run the entire system on a single Windows machine for a live demo.

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker Desktop | 4.x | Must be running before you start |
| Node.js | 18+ | `node -v` to check |
| Python | 3.11+ | `python --version` to check |
| uvicorn, FastAPI etc. | see `requirements.txt` | `pip install -r apps/ai-service/requirements.txt` |
| spaCy model | en_core_web_sm | `python -m spacy download en_core_web_sm` |
| npm deps | latest | Run `npm install` from the repo root |

### One-Command Start

Open PowerShell in the repo root (`E:\Lawerly_new`) and run:

```powershell
.\start.ps1
```

`start.ps1` will:
1. Auto-start Docker Desktop if needed and wait for the daemon
2. `docker compose up -d` — starts Postgres (port 5433) and MinIO (ports 9000/9001)
3. Wait up to 60 s for Postgres to be ready
4. Launch all 4 app services with color-coded labeled output:
   - `core-api` → http://localhost:4000 (green)
   - `web` → http://localhost:3000 (blue)
   - `admin-web` → http://localhost:3100 (magenta)
   - `ai-svc` → http://localhost:8000 (yellow)
5. Stream live logs from all services in the terminal

Press **Ctrl+C** to stop everything cleanly.

### Service URLs

| Service | URL | Notes |
|---|---|---|
| User portal | http://localhost:3000 | Citizen & Lawyer UX |
| Admin panel | http://localhost:3100 | Requires 2FA (see credentials below) |
| Core API | http://localhost:4000/health | REST + Socket.IO |
| AI service | http://localhost:8000/health | OCR + NLP |
| MinIO console | http://localhost:9001 | user: `minioadmin` / pass: `minioadmin` |

### Demo Credentials

**Admin (localhost:3100)**

> **Important:** TOTP secrets are regenerated each time `npx tsx prisma/seed.ts` is run.
> The secrets below were generated on the most recent seed run. If you re-seed, update this table.

| Username | Password | Role | 2FA Secret (current) |
|---|---|---|---|
| `superadmin` | `Admin@2025` | Super Admin | `IROCG3SOAUJWUOYA` |
| `moderator1` | `Admin@2025` | Moderator | `LN4AC6JFLM2UI3JM` |
| `analyst1` | `Admin@2025` | Analyst | `HINSIB3ROQGGG2RG` |

Each account now has its own independent TOTP secret (C-2 security fix).

To generate a TOTP code from the secret, use [totp.app](https://totp.app) or Google Authenticator. For quick CLI generation, replace `SECRET` with the account's secret from the table above:
```python
python -c "
import hmac, hashlib, struct, time, base64
secret = 'SECRET'
key = base64.b32decode(secret.upper())
t = int(time.time()) // 30
msg = struct.pack('>Q', t)
h = hmac.new(key, msg, hashlib.sha1).digest()
offset = h[-1] & 0xf
code = (struct.unpack('>I', h[offset:offset+4])[0] & 0x7fffffff) % 1000000
print(f'{code:06d}')
"
```

**Seeded Lawyers (localhost:3000)**
| Email | Password | Speciality |
|---|---|---|
| `bilal.ahmed@lawyerly.pk` | `Lawyer@2025` | Family, Civil |
| `sana.malik@lawyerly.pk` | `Lawyer@2025` | Criminal, Constitutional |
| `imran.qureshi@lawyerly.pk` | `Lawyer@2025` | Property, Corporate |
| `ayesha.tariq@lawyerly.pk` | `Lawyer@2025` | Cyber, Labour |
| `hamza.sheikh@lawyerly.pk` | `Lawyer@2025` | Corporate (pending → approve via admin) |

**Seeded Citizens (localhost:3000)**

> Note: Citizens share the same seed password as lawyers (`Lawyer@2025`) — the seed generates one hash reused for all non-admin accounts.

| Email | Password |
|---|---|
| `ahmed.raza@example.com` | `Lawyer@2025` |
| `fatima.noor@example.com` | `Lawyer@2025` |
| `seed.client@lawyerly.pk` | `Lawyer@2025` |

### One-Command Stop

```powershell
.\stop.ps1
```

Kills all service processes and runs `docker compose down`.

### Dev Email / OTP

SMTP is disabled in development. All emails (OTPs, password resets, notifications) are printed to the `[core-api]` colored log in the terminal. Watch for lines like:
```
  [core-api ] ========== [DEV EMAIL] ==========
  [core-api ] To: user@example.com
  [core-api ] Your Lawyerly verification code is: 730596
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `Port :3000 already in use` | Run `.\stop.ps1` first; start.ps1 now warns and skips instead of crashing |
| `uvicorn is not recognized` | Fixed — start.ps1 uses `python -m uvicorn` |
| `docker: cannot connect` | start.ps1 auto-starts Docker Desktop from `E:\Docker\Docker Desktop.exe` |
| ai-service won't start | `pip install -r apps/ai-service/requirements.txt` then `python -m spacy download en_core_web_sm` |
| OTP not appearing | Check `[core-api]` log output in the terminal (SMTP is disabled in dev) |

---

---

## Security Audit — Known Limitations (Deferred)

The following issues were identified in the security audit but intentionally deferred before the FYP demo. They are non-blocking for a local/demo deployment.

| ID | Issue | Reason deferred |
|---|---|---|
| H-3 | Shared `JWT_ACCESS_SECRET` across user and admin token types | Refactoring secrets mid-project risks breaking auth flows; separation should be done in a dedicated session before production |
| M-1 | IP-only rate limiting (shared NAT false positives; botnet bypass) | Acceptable at FYP scale; upgrade to per-user+IP limiting in production |
| M-2 | MIME type validation uses client-supplied string, not magic bytes | Low risk with presigned direct-to-MinIO uploads; add server-side magic-bytes scan before production |
| M-3 | `trust proxy 1` IP spoofing if no real proxy is in front | Will be correct once deployed behind Railway/Nginx reverse proxy |
| M-5 | OCR fileUrl not validated before download (partially covered by C-1 fix) | The C-1 fix adds host-allowlist validation in `ocr.py`; M-5's deeper concern is covered |
| L-1 | Chatbot prompt injection | Gemini 2.5 Flash's built-in resistance is sufficient for preliminary guidance; add input sanitization before production |

---

## Option B — Free Cloud Deployment (FYP Submission)

> **Goal:** examiners can access a live URL without running anything locally.

### Architecture

| Service | Free Tier Option | Notes |
|---|---|---|
| **PostgreSQL** | [Neon.tech](https://neon.tech) | 512 MB free, always-on |
| **Object storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | 10 GB free, S3-compatible |
| **core-api** (Node/Express + Socket.IO) | [Railway](https://railway.app) | 500 h/mo free (enough for demo) |
| **ai-service** (Python/FastAPI) | [Railway](https://railway.app) | Same free plan as above |
| **web** (Next.js) | [Vercel](https://vercel.com) | Free tier, edge-optimised |
| **admin-web** (Next.js) | [Vercel](https://vercel.com) | Free tier |

Railway is the only platform with free-tier support for Docker-based Node + Python services with persistent WebSocket connections. Vercel is ideal for Next.js frontends.

### Step-by-Step

#### Step 1 — Database (Neon)

1. Create a free account at [neon.tech](https://neon.tech).
2. Create a project → note the **connection string** (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. In the Neon console SQL editor, run Prisma migrations:
   ```sql
   -- OR run from your local machine once DATABASE_URL is set to Neon:
   -- npx prisma migrate deploy
   -- npx prisma db seed
   ```
   Easier: set `DATABASE_URL` to the Neon connection string and run locally:
   ```powershell
   cd apps\core-api
   $env:DATABASE_URL="postgresql://..."
   npx prisma migrate deploy
   npx prisma db seed
   ```

#### Step 2 — Object Storage (Cloudflare R2)

1. Create a free [Cloudflare account](https://cloudflare.com).
2. R2 → Create bucket named `lawyerly-documents`.
3. R2 → Manage R2 API tokens → Create token → note **Access Key ID** and **Secret Access Key**.
4. Note your **R2 endpoint**: `https://<account-id>.r2.cloudflarestorage.com`

#### Step 3 — AI Service on Railway

1. Install [Railway CLI](https://docs.railway.app/develop/cli): `npm install -g @railway/cli`
2. `railway login`
3. From `apps/ai-service`:
   ```bash
   railway init          # creates a new project
   railway up            # deploys the Python service
   ```
4. Add environment variables in Railway dashboard → Variables:
   ```
   GEMINI_API_KEY=<your-key>
   ```
5. Note the public URL (e.g. `https://ai-service-production.up.railway.app`).

#### Step 4 — Core API on Railway

1. From `apps/core-api`:
   ```bash
   railway init
   railway up
   ```
2. Add all environment variables:
   ```
   DATABASE_URL=postgresql://...  (Neon URL)
   NODE_ENV=production
   JWT_ACCESS_SECRET=<random 64 chars>
   JWT_REFRESH_SECRET=<random 64 chars>
   FIELD_ENCRYPTION_KEY=<base64 32-byte key>
   WEB_ORIGIN=https://your-web.vercel.app
   ADMIN_WEB_ORIGIN=https://your-admin.vercel.app
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_ACCESS_KEY=<R2 access key>
   S3_SECRET_KEY=<R2 secret key>
   S3_BUCKET=lawyerly-documents
   AI_SERVICE_URL=https://ai-service-production.up.railway.app
   GEMINI_API_KEY=<your-key>
   EMAIL_FROM=Lawyerly <no-reply@lawyerly.pk>
   # Optional SMTP for real emails:
   # SMTP_HOST=smtp.mailgun.org
   # SMTP_PORT=587
   # SMTP_USER=...
   # SMTP_PASSWORD=...
   ```
3. Note the Railway public URL (e.g. `https://core-api-production.up.railway.app`).

#### Step 5 — Web Frontend on Vercel

1. Push the repo to GitHub (if not already there).
2. Go to [vercel.com](https://vercel.com) → New Project → Import the GitHub repo.
3. Set **Root Directory** to `apps/web`.
4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://core-api-production.up.railway.app
   NEXT_PUBLIC_WS_URL=wss://core-api-production.up.railway.app
   ```
5. Deploy. Note the URL (e.g. `https://lawyerly-web.vercel.app`).

#### Step 6 — Admin Panel on Vercel

1. New Project → same repo → Root Directory: `apps/admin-web`.
2. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://core-api-production.up.railway.app
   ```
3. Deploy. Note URL (e.g. `https://lawyerly-admin.vercel.app`).

#### Step 7 — Update CORS in core-api

Go back to Railway → core-api → Variables and update:
```
WEB_ORIGIN=https://lawyerly-web.vercel.app
ADMIN_WEB_ORIGIN=https://lawyerly-admin.vercel.app
```
Railway will redeploy automatically.

### Verifying the Cloud Deployment

```bash
curl https://core-api-production.up.railway.app/health
# → {"status":"ok","service":"core-api",...}

curl https://ai-service-production.up.railway.app/health
# → {"status":"ok","service":"ai-service",...}
```

### Free Tier Limits & Caveats

| Platform | Limit | Impact |
|---|---|---|
| Railway | 500 h/mo CPU (per service) | OK for exam period; 2 services = 250 h each |
| Railway | Services sleep after inactivity | First request after sleep takes ~10 s to wake |
| Neon | 512 MB storage | Fine for demo data |
| Cloudflare R2 | 10 GB storage, 10M reads/mo | More than enough |
| Vercel | 100 GB bandwidth | Fine |

**Cold start warning:** Railway free tier sleeps idle services. Add a `/health` ping in a free uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com)) to keep services warm during the demo.

---

## Option C — One-Command Startup for Demos

`start.ps1` in the repo root is the single command:

```powershell
.\start.ps1
```

### What It Does

1. **Auto-starts Docker Desktop** if the daemon is not running (looks for `E:\Docker\Docker Desktop.exe`).
2. **Checks ports** 3000, 3100, 4000, 8000 before starting — warns and skips any that are already in use instead of crashing.
3. **Starts infrastructure**: `docker compose up -d` for Postgres + MinIO, then waits up to 60 s for Postgres readiness.
4. **Launches all 4 services** using cmd.exe launchers that redirect stdout/stderr to temp log files, then tails them with color-coded prefixes:
   - `[infra    ]` cyan — Docker/infrastructure messages
   - `[core-api ]` green — Node.js API + Socket.IO
   - `[web      ]` blue — Next.js user portal
   - `[admin-web]` magenta — Next.js admin panel
   - `[ai-svc   ]` yellow — FastAPI OCR + NLP service
5. **Exits cleanly on service crash** — prints the error once and stops all processes (no infinite "EXITED unexpectedly" loop).
6. **Ctrl+C** kills all services and runs `docker compose down`.

### Status Dashboard Banner

After all services start you'll see:

```
  +-------------------------------------------------+
  |  Lawyerly dev -- all services running           |
  |                                                 |
  |  Web (user)     ->  http://localhost:3000       |
  |  Admin panel    ->  http://localhost:3100       |
  |  Core API       ->  http://localhost:4000       |
  |  AI service     ->  http://localhost:8000       |
  |  MinIO console  ->  http://localhost:9001       |
  |                                                 |
  |  Ctrl+C to stop all                            |
  +-------------------------------------------------+
```

Then live logs flow with colored labels. You can filter a specific service in a second terminal:

```powershell
# Follow only the AI service logs:
Get-Content "$env:TEMP\lawyerly-dev\ai-svc-err.log" -Wait
```

### Stopping

```powershell
.\stop.ps1
```

Or simply press **Ctrl+C** in the start.ps1 terminal — it runs cleanup automatically.

---

## Environment Variables Reference

All env files are gitignored. Template: `.env.example` in the repo root.

### `apps/core-api/.env`

```env
DATABASE_URL=postgresql://lawyerly:lawyerly_dev_password@localhost:5433/lawyerly?schema=public
NODE_ENV=development
CORE_API_PORT=4000
WEB_ORIGIN=http://localhost:3000
ADMIN_WEB_ORIGIN=http://localhost:3100
JWT_ACCESS_SECRET=<64-char random>
JWT_REFRESH_SECRET=<64-char random>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
FIELD_ENCRYPTION_KEY=<base64 32-byte AES key>
GEMINI_API_KEY=<your key>
AI_SERVICE_URL=http://localhost:8000
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=lawyerly-documents
EMAIL_FROM=Lawyerly <no-reply@lawyerly.pk>
# Leave SMTP_HOST commented out in dev → OTPs print to console
# SMTP_HOST=sandbox.smtp.mailtrap.io
```

### `apps/ai-service/.env`

```env
GEMINI_API_KEY=<your key>
```

---

## First-Time Setup Checklist

```
[ ] Docker Desktop installed and running
[ ] Node.js 18+ installed (npm install from repo root)
[ ] Python 3.11+ installed
[ ] pip install -r apps/ai-service/requirements.txt
[ ] python -m spacy download en_core_web_sm
[ ] apps/core-api/.env created (copy from .env.example, fill in secrets)
[ ] apps/ai-service/.env created (GEMINI_API_KEY)
[ ] apps/web/.env.local created (NEXT_PUBLIC_API_URL=http://localhost:4000)
[ ] apps/admin-web/.env.local created (NEXT_PUBLIC_API_URL=http://localhost:4000)
[ ] npx prisma migrate deploy (from apps/core-api)
[ ] npx prisma db seed (from apps/core-api)
[ ] .\start.ps1
```
