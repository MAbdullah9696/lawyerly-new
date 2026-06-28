# Lawyerly

A role-based, AI-powered legal marketplace connecting Pakistani citizens with verified lawyers. See [`CLAUDE.md`](CLAUDE.md) / [`docs/SPEC.md`](docs/SPEC.md) for the full specification.

> **No RAG.** The chatbot is a direct LLM API call. There is no vector store, embeddings, or retrieval layer anywhere in this codebase.

## Monorepo layout

| Path | What |
| --- | --- |
| `apps/web` | Public + User + Lawyer portals (Next.js + Tailwind) — *Milestone 3+* |
| `apps/admin-web` | Isolated admin panel (Next.js, separate subdomain) — *Milestone 10* |
| `apps/core-api` | Core API — Express + Prisma (auth, RBAC, marketplace, chat, LLM call) |
| `apps/ai-service` | OCR + NLP microservice (Python + FastAPI) — *Milestone 8* |
| `packages/shared` | Shared TypeScript types/enums |
| `docs/` | Spec, schema notes, architecture decision records |

## Local development

Prerequisites: Node 20+, npm, Docker Desktop, Python 3.11+ (for the AI service).

**poppler (PDF support):** Download the latest [poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases) release. Extract to `C:\poppler\` so that the binaries live at `C:\poppler\Library\bin\`. Set `POPPLER_PATH=C:\poppler\Library\bin` in `apps/ai-service/.env`.

```bash
# 1. Install JS workspace dependencies
npm install

# 2. Copy environment template and fill in values
cp .env.example .env            # PowerShell: Copy-Item .env.example .env

# 3. Start local infrastructure (PostgreSQL + MinIO)
npm run infra:up

# 4. Generate the Prisma client, run migrations, and seed reference data
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Run the core API (health check at http://localhost:4000/health)
npm run dev:api
```

MinIO console: http://localhost:9001 (default `minioadmin` / `minioadmin`).

## Status

- **Milestone 1 (Foundation) complete:** monorepo scaffolding, full database schema, seed, env config, local infra.
- **Milestone 2 (Auth & RBAC) complete:** all `/api/auth` routes (registration + OTP, lawyer 3-step, login with lockout/CAPTCHA/2FA, refresh rotation, sessions, forgot/reset/change password, 2FA management), Zod validation, bcrypt(12), JWT access/refresh, AES-256-GCM field encryption, RBAC middleware. See route list in the milestone notes.
- **Milestone 3 (Public pages + Auth UI) complete:** Next.js App Router app in `apps/web` (navy/gold Tailwind design system). Homepage, About, Terms, Privacy, 404/403/500/503, and all auth screens (role selection → citizen 2-step + OTP, lawyer 3-step + document upload, login with 2FA/CAPTCHA/lockout, forgot/reset password). Access token in memory + httpOnly refresh cookie via a Next BFF (`app/api/auth/*`) proxying core-api. Run the web app with `npm run dev --workspace apps/web` (needs core-api on :4000).
- **Milestone 4 (User dashboard & core flows) complete:**
  - **Backend** (core-api): `POST /api/chat/message` (direct LLM call, NO RAG, via `@anthropic-ai/sdk`; dev fallback when `LLM_API_KEY` unset), `GET /api/chat/sessions`, `GET /api/chat/sessions/:id/messages`, `PATCH /api/chat/messages/:id/feedback`; `GET /api/lawyers` (filters/sort/pagination), `GET /api/lawyers/:id` (+ paginated reviews); `GET/PATCH /api/users/me`; `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`. Seeded 4 verified lawyers with reviews.
  - **Frontend** (apps/web): `/user/*` portal shell (sidebar + topbar + notifications bell) and all pages — dashboard, chatbot (session list, citation chips, thumbs feedback, "Connect with a lawyer" CTA), find-lawyer (filters/sort/pagination/search), lawyer profile (+ reviews), profile, settings (password/2FA/sessions), notifications.
- **Milestone 5 (Lawyer Portal) complete:**
  - **Backend** (core-api `/api/lawyer/*`): dashboard metrics, requests (list/accept/decline with mandatory reason + lazy 24h expiry), cases (active/closed), consultation detail + auto-saving private notes + close (creates a Transaction), earnings (summary/12-month chart/transactions/payout methods/history), payout request (≥ PKR 1,000), add payout method, profile get/patch (editable-only), availability toggle, settings (cap + auto-decline). Seeded lawyer activity (transactions, pending/declined/expired requests, an active case, a payout method) + a **pending lawyer** (`hamza.sheikh@lawyerly.pk`) for the verification screen.
  - **Frontend** (apps/web `/lawyer/*`): status-gated portal shell (sidebar + topbar with availability toggle) + pending verification screen, dashboard, requests (tabs + accept/decline modals + countdown), cases, consultation (chat placeholder + case info + private notes), profile editor (+ preview modal), earnings (cards/bar chart/CSV/payouts), settings (shared security section + cap/auto-decline). Lawyer creds: all seeded lawyers password `Lawyer@2025`.
- **Milestone 6 (Realtime consultation chat) complete:**
  - **Socket.IO gateway** (`src/realtime/`): JWT-handshake auth, room per consultation (`consultation:{id}`), events `join_consultation` / `send_message` / `typing_start` / `typing_stop` / `message_read` / `leave_consultation` (server emits `joined` / `message` / `receipt` / `typing` / `consultation_closed` / `chat_error`). Message text **encrypted at rest** (AES-256-GCM). Delivery: sent → delivered (recipient in room) → read.
  - **REST** (`/api/consultations/*`): request, requests, cancel, list (active/pending/closed), header (no `caseNotes` for citizen), messages (paginated), send (fallback), attachments, close (records earnings), review. **Auto-expiry** sweep (`CONSULTATION_EXPIRY_INTERVAL_MS`, default 5 min) expires stale pending requests + notifies both parties.
  - **Frontend**: shared `ChatPanel` (socket.io-client) with delivery ticks + typing indicator; user `/user/consultation/[id]` (padlock, End Consultation → review, report, attach), lawyer `/lawyer/consultation/[id]` (chat + collapsible case info + auto-saving private notes + close), `/user/my-consultations` (Active/Pending/Closed), and the lawyer-profile "Start Consultation" now creates a real request.
- **Milestone 7 (Admin Panel) complete:** separate `apps/admin-web` (port 3100) + `/api/admin/*` in core-api.
  - **Admin auth** (`admin_accounts`, separate from users): password → **mandatory TOTP** → single session (`admin_sessions`, evicts others) with **30-min inactivity**. Failed logins email the super admin. Admin token held in an httpOnly cookie via the admin BFF; all admin calls proxy through it.
  - **RBAC:** super_admin (full incl. settings + admin accounts), moderator (verifications/users/reports/reviews), analyst (read-only — blocked from all writes). **Every mutating action writes to the append-only audit log.**
  - **Endpoints:** dashboard, verifications (FIFO + per-doc verify/issue + approve/reject with Bar-Council-uniqueness check), users (search + suspend/ban/lift/reset, timed `suspendedUntil`), reports (resolve: dismiss/warn/suspend/ban/remove-content), reviews (approve-flag/remove), analytics (date range + CSV), settings (disclaimer/fee/maintenance/practice-areas), admin accounts (create with TOTP QR + activate/deactivate), audit-log (search + CSV).
  - **Seed admins** (password `Admin@2025`): `superadmin` (TOTP `JBSWY3DPEHPK3PXP`), `moderator1` (`KZXW6YTBOIQWE3DF`), `analyst1` (`MFRGGZDFMZTWQ2LK`). Run admin-web: `npm run dev --workspace apps/admin-web` (port 3100).
- **Milestone 8 (Document Analyzer + AI wiring) complete:**
  - **AI service** (`apps/ai-service`, port 8000): FastAPI + Tesseract OCR + spaCy NER + Gemini summarization. PDF via `pdf2image` (requires poppler). Endpoints: `POST /ocr`, `POST /analyze`. Raw OCR text is never stored — only the structured `DocumentAnalysis` result persists.
  - **Backend**: `POST /api/documents/upload`, `GET /api/documents`, `GET /api/documents/:id/analysis`, `DELETE /api/documents/:id`, `GET /api/storage/presign` (upload + download). Parallel OCR → NLP pipeline runs in background; status progresses `processing → analysis_complete | low_confidence | processing_failed`.
  - **Frontend**: `/user/my-documents` (drag-and-drop upload, progress bar, status badges, split-screen analysis viewer with entity highlighting, "Share with Lawyer" to active consultation), profile photo upload in user and lawyer profiles, consultation attachment modal.
- **Milestone 9 (Final Hardening & Polish) complete:**
  - **Privacy fix:** `_fallback_summary()` no longer returns OCR-derived text — returns a static generic message only.
  - **PDF support:** `POPPLER_PATH` env var wires `pdf2image` to poppler; graceful error if missing.
  - **Real SMTP:** Mailtrap sandbox SMTP. All §13 transactional emails now send HTML-formatted messages (inline CSS, responsive table layout). Templates: OTP, welcome, password reset/change, new device login, account suspended/banned/lifted, consultation accepted/declined/expired/closed, document analysis complete, lawyer application received/approved/rejected, new request/review/payout, admin alerts.
  - **Admin email template editor:** super-admin can override 5 key email bodies via Settings → Email Templates.
  - **Maintenance mode:** `GET /api/system/status` (public) + Next.js Edge middleware redirects all public routes to `/maintenance` when mode is ON. Admin panel remains accessible.
  - **Session expiry modal:** dispatches `session-expired` CustomEvent on double-401; `<SessionExpiredModal>` shows "Log in again" prompt without silent failure.
  - **Offline banner:** `<NetworkBanner>` appears at top when `navigator.onLine` is false.
  - **Mobile:** `viewport-fit=cover`, `env(safe-area-inset-bottom)` on chat input, all admin/lawyer tables wrapped in `overflow-x-auto`.

## Test credentials (dev seed)

| Role | Email / Username | Password | Notes |
|---|---|---|---|
| Citizen | `alice.khan@test.com` | `Test@2025` | Verified citizen |
| Lawyer | `sara.malik@lawyerly.pk` | `Lawyer@2025` | Verified lawyer, Family Law |
| Lawyer (pending) | `hamza.sheikh@lawyerly.pk` | `Lawyer@2025` | Pending verification |
| Super Admin | `superadmin` | `Admin@2025` | TOTP secret: `JBSWY3DPEHPK3PXP` |
| Moderator | `moderator1` | `Admin@2025` | TOTP: `KZXW6YTBOIQWE3DF` |
| Analyst | `analyst1` | `Admin@2025` | TOTP: `MFRGGZDFMZTWQ2LK` |

> TOTP secrets can be entered directly in any authenticator app (e.g. Google Authenticator → "Enter a setup key").

## SMTP setup (Mailtrap)

1. Create a free account at [mailtrap.io](https://mailtrap.io) and open **Email Testing → Inboxes**.
2. Copy the SMTP credentials from the **SMTP Settings** tab of your inbox.
3. Set them in `apps/core-api/.env`:
   ```
   SMTP_HOST=sandbox.smtp.mailtrap.io
   SMTP_PORT=587
   SMTP_USER=<your-mailtrap-user>
   SMTP_PASSWORD=<your-mailtrap-password>
   SMTP_SECURE=false
   EMAIL_FROM=Lawyerly <no-reply@lawyerly.pk>
   ```
4. All transactional emails (OTP, verification, consultation events, etc.) will appear in the Mailtrap inbox.

## Start all services

```bash
# Terminal 1 — infrastructure (PostgreSQL :5433 + MinIO :9000/:9001)
npm run infra:up

# Terminal 2 — core API (:4000)
npm run dev:api

# Terminal 3 — web portal (:3000)
npm run dev --workspace apps/web

# Terminal 4 — admin panel (:3100)
npm run dev --workspace apps/admin-web

# Terminal 5 — AI service (:8000)
cd apps/ai-service
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

MinIO console: http://localhost:9001 (credentials: `minioadmin` / `minioadmin`).
