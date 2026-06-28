# Lawyerly App — Build Brief for Claude Code

> **What this file is:** A complete, self-contained specification for the Lawyerly App.
> Drop it in the repo root (e.g. as `CLAUDE.md` or `docs/SPEC.md`) so Claude Code has full
> context for every feature, route, flow, data model, and rule. Build incrementally using the
> milestones at the end. **Do not invent features not described here. When something is
> ambiguous, ask before guessing.**

---

## 0. How to use this brief (instructions to the coding agent)

- This is a **Final Year Project (FYP)**. Favor clear, maintainable, well-documented code over cleverness. The team must be able to read, run, and defend everything.
- Build **portal by portal, feature by feature**, in the milestone order in §15. After each feature, confirm it runs before moving on.
- Treat the tech stack in §3 as a **strong default recommendation**, not a mandate. If the user has already chosen a stack, conform to it instead and tell them which parts of this brief change.
- **There is no RAG / vector database / document-retrieval pipeline in this project.** The AI chatbot is a **direct LLM call via API**. Do not add embeddings, vector stores, or a law-corpus retrieval layer.
- Every screen that shows AI output must carry the legal disclaimer (see §1). This is non-negotiable.
- Respect the security rules in §11 from day one — auth, hashing, RBAC, and input sanitization are not "later" tasks.

---

## 1. Product summary & hard constraints

**Lawyerly** is a role-based, AI-powered legal marketplace connecting Pakistani citizens with verified lawyers, operating in **English**. It delivers:

1. Instant **preliminary legal guidance** via an AI chatbot.
2. **Document analysis** of uploaded legal documents using OCR + NLP.
3. A **marketplace** where users discover lawyers and consult them over secure in-app chat.

**Non-negotiable constraints:**

- **AI is preliminary guidance, never legal advice.** Every chatbot screen carries a permanent banner: *"This is not legal advice. Consult a licensed lawyer for your specific case."* Every public page carries a sticky footer banner: *"AI guidance on this platform is for informational purposes only and does not constitute legal advice."*
- **Three portals, three workflows:** User, Lawyer, Admin.
- **Admin panel is isolated:** separate subdomain (e.g. `admin.lawyerly.pk`), never linked from the public site, **2FA mandatory** for all admin accounts.
- **Pakistan context:** CNIC numbers, Bar Council enrollment, Pakistani provinces/cities, PKR currency, Easypaisa/JazzCash payouts, **PECA 2016 (Prevention of Electronic Crimes Act)** compliance for data handling.
- **No RAG.** The chatbot is a direct LLM API call (see §9.1).

---

## 2. User roles

| Role | Description |
| --- | --- |
| **Regular User (Citizen)** | A citizen seeking legal guidance or a lawyer to consult. |
| **Lawyer** | A verified legal professional providing paid consultations. Locked in "Pending Verification" until an admin approves. |
| **Admin** | Platform staff: verification, moderation, system health. Sub-roles: Super Admin (full), Moderator (reports + verifications), Analyst (read-only). |

---

## 3. Recommended tech stack (flexible)

A pragmatic split for a student team that has ML components:

- **Frontend:** React (Next.js recommended) + Tailwind CSS. Responsive (web + mobile-friendly).
- **Main backend / API:** Node.js + Express **or** Python + FastAPI. Pick one for the core app.
- **AI service:** A **Python (FastAPI)** microservice for OCR + NLP (these libraries are Python-native). The chatbot LLM call can live in either the main backend or this service.
- **Database:** PostgreSQL (relational data, RBAC, audit logs). Use an ORM (Prisma for Node, SQLAlchemy for Python).
- **Realtime chat:** WebSockets (Socket.IO or native WS) for messages, typing indicators, delivery/read receipts, and live notifications.
- **Object storage:** S3-compatible storage (AWS S3 / MinIO) for documents and profile photos, encrypted at rest, served via pre-signed URLs.
- **OCR:** Tesseract (open-source) or a cloud OCR API. Start with Tesseract for printed/scanned docs.
- **NLP:** A BERT-style model (e.g. fine-tuned `bert-base` via Hugging Face Transformers) for Named-Entity Recognition + text classification; summarization via a transformer summarizer or the same LLM used for chat.
- **Chatbot LLM:** Any chat-completions API. No retrieval layer.
- **Auth:** JWT (access + refresh), bcrypt/Argon2 for password hashing, TOTP for 2FA.
- **Email:** Transactional email provider (OTP, verification, notifications) with editable templates.

> If the team prefers an all-Python or all-Node stack, that's fine — keep the OCR/NLP in Python regardless, even if it means a small dedicated service.

---

## 4. Data model (entities & key fields)

Implement these as tables/collections. Field lists are the minimum required.

- **User** — `id`, `role` (citizen | lawyer | admin), `fullName`, `email` (unique), `phone`, `passwordHash`, `emailVerified` (bool), `twoFactorEnabled` (bool), `twoFactorSecret`, `profilePhotoUrl`, `status` (active | suspended | banned | pending), `createdAt`, `lastLoginAt`.
- **LawyerProfile** — `userId` (FK), `fullLegalName`, `cnic` (encrypted, 13 digits), `barCouncilNumber`, `province`, `city`, `yearsExperienceBand` (1–5 | 6–10 | 11–20 | 20+), `practiceAreas` (array), `languages` (array), `consultationFeePkr`, `bio` (min 200 chars), `verificationStatus` (pending | verified | rejected | suspended | banned), `showWinLossStats` (bool), `availability` (online | busy | offline), `maxActiveConsultations` (default 10), `autoDeclineWhenOffline` (bool), `ratingAvg`, `reviewCount`, `winLossStats` (total/won/lost/ongoing).
- **LawyerDocument** — `id`, `lawyerProfileId` (FK), `docType` (bar_council_cert | cnic_front | cnic_back | law_degree | profile_photo), `fileUrl`, `status` (submitted | verified | issue_found), `issueNote`, `uploadedAt`.
- **ChatSession** (AI chatbot) — `id`, `userId`, `createdAt`, `title` (first message preview).
- **ChatMessage** — `id`, `sessionId`, `sender` (user | ai), `text`, `citations` (array of label strings, e.g. `["PPC Section 302"]`), `feedback` (up | down | null), `timestamp`.
- **Document** (user-uploaded) — `id`, `userId`, `fileName`, `fileType`, `fileUrl`, `status` (uploaded | processing | analysis_complete | processing_failed | low_confidence), `uploadDate`.
- **DocumentAnalysis** — `documentId` (FK), `caseType`, `summary` (150–300 words), `entities` (array of `{type, value, confidence}` for person/org/date/money/legal_section/location), `overallConfidence`. *(Raw OCR text is processed transiently and deleted — only results persist.)*
- **ConsultationRequest** — `id`, `userId`, `lawyerId`, `caseType`, `description` (≤500 chars), `status` (pending | accepted | declined | expired), `declineReason`, `createdAt`, `expiresAt` (createdAt + 24h).
- **Consultation** — `id`, `userId`, `lawyerId`, `status` (active | closed), `caseType`, `startedAt`, `closedAt`, `caseNotes` (lawyer-only, auto-saved).
- **Message** (consultation chat) — `id`, `consultationId`, `senderId`, `text`, `attachments` (array of doc refs), `deliveryStatus` (sent | delivered | read), `timestamp`.
- **Review** — `id`, `consultationId`, `lawyerId`, `userId`, `rating` (1–5), `text` (≤500 chars), `caseType`, `date`, `flagged` (bool), `removed` (bool), `removalReason`.
- **Report** — `id`, `reporterId`, `reportedPartyId`, `type` (conversation | profile | review), `reasonCategory`, `reasonText`, `priority` (high | medium | low, auto-assigned), `status` (open | resolved), `resolutionNote`, `createdAt`.
- **Notification** — `id`, `userId`, `type`, `text`, `link`, `read` (bool), `createdAt`.
- **Transaction** (lawyer earnings) — `id`, `consultationId`, `lawyerId`, `feePkr`, `platformFeePercent`, `netEarnedPkr`, `status` (paid | pending), `date`.
- **PayoutMethod** — `id`, `lawyerId`, `type` (bank | easypaisa | jazzcash), `details` (IBAN+title / mobile number), `isDefault`.
- **Payout** — `id`, `lawyerId`, `amountPkr`, `method`, `status`, `requestedAt`, `processedAt`.
- **AdminAccount** — `id`, `username`, `passwordHash`, `role` (super_admin | moderator | analyst), `twoFactorSecret` (mandatory).
- **AuditLog** (append-only) — `id`, `adminUsername`, `actionType`, `targetId`, `details`, `timestamp`. **No delete allowed, ever.** Retain ≥ 2 years.
- **SystemConfig** (singleton) — `practiceAreas` (managed list), `chatbotDisclaimerText`, `platformFeePercent`, `emailTemplates` (map), `maintenanceMode` (bool).

**Reference lists:**
- Provinces: Punjab, Sindh, KPK, Balochistan, AJK, GB, Federal.
- Practice areas: Civil Litigation, Criminal Law, Family Law, Property & Real Estate, Corporate & Business, Constitutional Law, Intellectual Property, Labour Law, Immigration, Cyber Law.
- Languages: English, Urdu, Punjabi, Sindhi, Pashto, Balochi.

---

## 5. Complete route / page index

### Public routes (no login)
| Route | Page |
| --- | --- |
| `/` | Homepage — hero, features, how-it-works, testimonials |
| `/about` | About the platform & team |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy (PECA 2016 note) |
| `/register` | Role selection → User or Lawyer registration |
| `/login` | Login for all roles (role auto-detected) |
| `/forgot-password` | Email input for reset |
| `/reset-password/[token]` | Reset form loaded from email link |

### User routes (citizen login required)
| Route | Page |
| --- | --- |
| `/user/dashboard` | Quick actions, active consultations, recent AI chats, notifications |
| `/user/chatbot` | AI Legal Chatbot — session list + chat |
| `/user/find-lawyer` | Lawyer search — filters + results grid |
| `/user/lawyer/[id]` | Lawyer public profile |
| `/user/my-consultations` | Active / Pending / Closed tabs |
| `/user/consultation/[id]` | Consultation chat (active or read-only) |
| `/user/my-documents` | Document list + upload + analysis viewer |
| `/user/profile` | Edit name & photo |
| `/user/settings` | Password, 2FA, sessions, notifications, privacy |
| `/user/notifications` | Full notification history |

### Lawyer routes (verified lawyer login required)
| Route | Page |
| --- | --- |
| `/lawyer/pending` | Pending-verification status screen |
| `/lawyer/dashboard` | Metrics, requests, active cases, recent reviews |
| `/lawyer/requests` | Pending / Declined / Expired tabs |
| `/lawyer/cases` | Active / Closed tabs |
| `/lawyer/consultation/[id]` | Consultation chat + case-info panel |
| `/lawyer/profile/edit` | Edit bio, photo, areas, fee, availability |
| `/lawyer/earnings` | Summary, transaction log, payouts |
| `/lawyer/settings` | Password, 2FA, notifications, consultation cap |

### Admin routes (admin + 2FA, separate subdomain)
| Route | Page |
| --- | --- |
| `/admin/login` | Admin-only login |
| `/admin/dashboard` | Metrics, alerts, system health |
| `/admin/verifications` | Lawyer verification queue + review workflow |
| `/admin/users` | Account management — search, view, act |
| `/admin/reports` | Content moderation queue |
| `/admin/reviews` | Platform-wide review management |
| `/admin/analytics` | Growth, consultation, AI, document analytics |
| `/admin/settings` | Practice areas, fee, email templates, maintenance |
| `/admin/audit-log` | Immutable audit trail |

---

## 6. Pre-login / public pages

**Homepage (`/`)** must communicate trust immediately:
- Navbar: Logo (Lawyerly) | Find a Lawyer | How It Works | About | Register | Log In.
- Hero: headline "Get Legal Guidance Instantly", subheadline, two CTAs — "Find a Lawyer" and "Ask the AI Chatbot", both redirecting to `/register` if not logged in.
- Trust bar: "500+ Verified Lawyers · 10,000+ Cases Helped · Bar Council Certified".
- Feature cards: AI Chatbot | Document Analysis | Secure Chat | Verified Lawyers.
- How It Works: 3-step visual — Register → Find a Lawyer → Get Guidance.
- Testimonials (lawyer + user quotes).
- Footer: Terms | Privacy | Contact | About.
- **Sticky AI disclaimer banner** at the bottom of every public page (see §1).

**About / Terms / Privacy** — fully readable without login. Privacy page includes data collected, storage duration, third-party sharing, and the **PECA 2016 compliance** note.

---

## 7. Authentication flows

### 7.1 User registration (2 steps)
1. `/register` → role selection ("I am a Citizen" / "I am a Lawyer"). Citizen selected.
2. **Step 1 of 2 — Basic Info:** Full Name, Email, Phone, Password, Confirm Password. Progress bar.
3. Real-time validation: email format, password strength meter (Weak/Fair/Strong), live confirm-match, show/hide toggle.
4. Checkbox: agree to Terms + Privacy (linked). Click "Create Account".
5. System creates **unverified** account, emails a **6-digit OTP**, shows **Step 2 of 2 — Verify Email**.
6. OTP valid **10 minutes**; "Resend code" appears after **60s** with countdown.
7. On success: mark verified, auto-login, redirect to `/user/dashboard` with a welcome modal.
8. On wrong OTP: inline "Incorrect code. X attempts remaining". After **5** wrong attempts: invalidate OTP, force re-request.

### 7.2 Lawyer registration (3 steps → Pending Verification)
1. Select "I am a Lawyer".
2. **Step 1 of 3 — Account Info:** Full Legal Name, CNIC (13 digits, format `XXXXX-XXXXXXX-X`), Email, Phone, Password, Confirm Password. Validate CNIC format, email uniqueness, password strength (min 8 chars, 1 uppercase, 1 digit, 1 special).
3. **Step 2 of 3 — Professional Details:** Bar Council Enrollment Number (mandatory), Province (dropdown), City (text), Years of Experience (band dropdown), Practice Areas (multi-select), Languages (multi-select), Consultation Fee (PKR number), Bio (min 200 chars, live counter).
4. **Step 3 of 3 — Document Upload (all 5 mandatory):** Bar Council Certificate (PDF/JPG/PNG ≤5MB), CNIC Front (JPG/PNG ≤3MB), CNIC Back (JPG/PNG ≤3MB), Law Degree Certificate (PDF/JPG/PNG ≤5MB), Profile Photo (JPG/PNG ≤2MB, crop tool after upload).
5. "Submit Application" → save data + docs, email "received, verified within 48 hours", redirect to `/lawyer/pending`.
6. `/lawyer/pending` shows status ("Under Review"), per-document status (Submitted/Verified/Issue Found), estimated review time, check-email note.

### 7.3 Login (all roles)
1. `/login`: Email, Password (show/hide), "Remember me" (30-day session), "Forgot Password?", "Log In". **No role selector** — role auto-detected.
2. Verify email + password hash (bcrypt/Argon2). Detect role.
3. Role-based redirect: User → `/user/dashboard` | Lawyer (verified) → `/lawyer/dashboard` | Lawyer (pending) → `/lawyer/pending` | Admin → `/admin/dashboard`.
4. Wrong credentials: generic "Incorrect email or password" (never specify which). Increment failed-attempt counter per IP+email.
5. After **3** fails: show CAPTCHA (reCAPTCHA v2). After **5** fails: lock account **15 min** with countdown.
6. If 2FA enabled: after correct password, show 2FA screen — 6-digit TOTP (30s) or SMS (5 min), backup code option.
7. New-device login: email "New login detected from [City, Device]" with "Secure my account" link.

### 7.4 Forgot password
1. `/forgot-password`: email input.
2. **Always** show "If this email is registered, you will receive a reset link shortly." (prevents enumeration).
3. If email exists: email a signed JWT reset link — valid **15 min**, one-time use.
4. Valid token → Reset Password form (New + Confirm).
5. Submit: not same as previous password, meets strength rules, not a known-compromised password (HaveIBeenPwned check). On success: invalidate all sessions, save new hash, "Password changed successfully. Please log in."
6. Expired/used token: "This link has expired. Request a new one."

---

## 8. User portal

### 8.1 Dashboard (`/user/dashboard`)
- Top navbar: logo | notifications bell (unread badge) | avatar dropdown (My Profile / Settings / Log Out).
- Left sidebar: Dashboard | Find a Lawyer | AI Chatbot | My Documents | My Consultations | Settings.
- Greeting card ("Good morning, [Name]" + date).
- Quick actions: Ask AI Chatbot | Find a Lawyer | Upload Document.
- Active Consultations widget (lawyer name, last message preview, time since). Click → chat.
- Recent AI Chats (last 3 sessions, date + first message). Click → reopen.
- Notifications panel (last 3 unread + "View all").

### 8.2 AI Legal Chatbot (`/user/chatbot`)
1. Left panel: session list grouped by date (Today / Yesterday / Last 7 Days / Older) + "New Chat".
2. "New Chat" → create session (id, timestamp, userId). Empty state shows suggested starters (e.g. "What are my tenant rights?", "How do I file for divorce in Pakistan?", "What is Section 302 PPC?").
3. User types (≤1000 chars, live counter), Enter/Send.
4. User message appears right with timestamp; typing indicator (3 dots) on left.
5. **System sends the message to the LLM via API; the model generates a plain-English answer.** *(No retrieval pipeline.)*
6. AI response on left: answer text + section-reference **label chips** (e.g. "[PPC Section 302]" — labels only, not clickable for MVP) + thumbs-up/down feedback buttons.
7. Permanent disclaimer banner pinned under the chat header at all times (configurable text from SystemConfig).
8. Copy icon on each AI response; thumbs feedback records `{sessionId, messageId, rating}`.
9. Soft CTA under each AI response: "Connect with a lawyer about this →" → `/user/find-lawyer` with practice area **pre-filtered by the AI's classification of the query topic**.
10. User can continue the session or start a new one; past sessions always accessible.

### 8.3 Find a Lawyer (`/user/find-lawyer`)
- Search bar + full grid of verified lawyers, default sort by rating.
- Left filter panel: Practice Area (multi), City (dropdown), Language (multi), Fee Range slider (0–50,000 PKR), Years of Experience (Any / 1–5 / 6–10 / 11+), Rating (Any / 3+ / 4+ / 5 only).
- Search autocomplete (debounced 300ms) for names + practice areas.
- Lawyer card: photo | name | "Verified" badge (green tick) | up to 3 practice areas ("+N more") | city | star rating (decimal, e.g. 4.7) | review count | fee PKR | availability dot (green online / yellow busy / gray offline) | "View Profile".
- Sort dropdown: Most Relevant / Highest Rated / Lowest Fee / Highest Fee / Most Experienced / Most Reviews.
- Pagination 12/page. Zero results → "No lawyers match your filters." + "Clear all filters".

### 8.4 Lawyer profile (`/user/lawyer/[id]`)
- Left column: large photo, name, "Verified by Lawyerly" badge, availability indicator, large star rating, total reviews, fee PKR (prominent), **"Start Consultation"** primary CTA.
- Right top: About (full bio), Practice Areas (colored tags), Languages (tags), Years of Experience, Bar Council Number (masked, e.g. "BC-XXXX-****").
- Right middle: Win/Loss stats (only if lawyer opted in) — Total / Won / Lost / Ongoing mini-table.
- Right bottom: Client Reviews — star rating, text, date, case-type label. 5/page. Sort: Most Recent / Highest / Lowest.
- "Report this profile" link (subtle, bottom) → modal with reason selection.

### 8.5 Starting a consultation
1. "Start Consultation". If lawyer Offline: button reads "Request Consultation (Lawyer is Offline)" — request still allowed. If Online: "Start Consultation".
2. Modal: "Describe your case briefly" (≤500 chars, counter), Case Type dropdown (Civil/Criminal/Family/Property/Corporate/Other), "Send Request".
3. Create request record; realtime + email notify lawyer; confirmation screen "Your request has been sent to [Lawyer]. You'll be notified when they accept."
4. Pending request visible in `/user/my-consultations` → Pending tab.
5. Lawyer accepts within 24h → user notified, status → Active.
6. Lawyer declines or no response in 24h → user notified, request auto-expires, user may request another lawyer.

### 8.6 Consultation chat (user side) (`/user/consultation/[id]`)
- Header: lawyer name + photo, availability, "End Consultation" (top right).
- Messages: user right (blue bubbles), lawyer left (white). Each: text, timestamp, delivery ticks (single = sent, double = delivered, blue double = read).
- Input bar with paperclip — **only documents already in `/user/my-documents` can be attached**; appear as downloadable cards.
- Padlock + "End-to-end encrypted" label in header (permanent trust signal).
- "Lawyer is typing..." indicator.
- "End Consultation" → confirm modal ("...you will be asked to leave a review.") → status Closed, chat read-only, review modal shown.
- Review modal: star rating (1–5, required), written review (optional ≤500 chars), case-type confirmation, "Submit Review" / "Skip for now".
- On submit: save review, recalc lawyer avg rating, add to public profile, "Thank you for your feedback!".
- "Report" option in three-dot menu at any time.

### 8.7 Document upload & analysis (`/user/my-documents`)
1. "Upload New Document" + grid/list (File Name | Upload Date | Type | Status | Actions).
2. Upload panel: drag-and-drop zone + browse button.
3. Accept PDF/JPG/PNG/JPEG, **max 10MB**. Invalid/oversized → inline error before upload. Multiple files queue, processed one at a time.
4. Progress bar 0→100%; on complete → status "Processing".
5. **Stage 1 — OCR:** convert image/scanned PDF to text. Label: "Scanning document...".
6. **Stage 2 — NLP:** BERT-style model extracts Person Names, Organizations, Dates, Monetary Amounts, Legal Section References (e.g. PPC 302, CPC Order VII), Locations; classifies case type (Civil/Criminal/Family/Property/Corporate/Constitutional/Other); generates 150–300 word plain-English summary. Label: "Analyzing content...".
7. On completion: status "Analysis Complete", card shows "View Analysis".
8. "View Analysis" → split screen: **left** document preview with highlighted entities (names yellow, dates blue, law sections green); **right** analysis panel — case type, summary, entities by category, confidence score per entity.
9. Bottom of panel: "Share with Lawyer" → dropdown of active consultations → "Send" → appears in that chat as attachment.
10. Poor OCR (handwritten/low-res) → warning badge "Low confidence scan. Manual review recommended." Analysis still shown with disclaimer.
11. Delete any document → confirm modal ("permanently delete... cannot be undone"); removed from storage within 24h.

> **Privacy rule:** after analysis, the **raw extracted text is deleted** — only the analysis results are retained.

### 8.8 My Consultations (`/user/my-consultations`)
- **Active:** in-progress (lawyer name/photo, case type, last message time, unread badge) → chat.
- **Pending:** awaiting lawyer response (sent time, 24h expiry countdown, Cancel button).
- **Closed:** completed (lawyer name, date closed, rating given or "Leave Review") → read-only history.

### 8.9 Profile & settings (`/user/profile`, `/user/settings`)
- **Profile:** edit Full Name, Phone, profile photo (crop tool). **Email read-only** (cannot change post-registration).
- **Security:** Change Password (current → new → confirm); 2FA enable/disable (scan QR → confirm first TOTP → save 8 backup codes shown once); Active Sessions list (device, browser, city, last active) with "Log out of this device" per row + "Log out of all other devices".
- **Notifications:** Email toggles (new message, consultation accepted, request expired; account-security alerts always on). SMS toggle (new message — requires phone verification). In-app always on.
- **Privacy & data:** "Download my data" (ZIP of chat history, documents, profile; up to 24h; email link). "Delete account" (warning modal: permanent deletion after a **30-day grace** deactivation; type "DELETE" to confirm).

---

## 9. AI components (detailed spec)

### 9.1 Chatbot — LLM-based, NO RAG
- The chatbot is a **direct chat-completions API call**. There is **no vector database, no embeddings, and no law-corpus retrieval step.**
- Implementation: maintain conversation history per session and send it to the LLM with a **system prompt** that instructs the model to act as a Pakistani legal assistant, answer in plain English, stay within preliminary-guidance scope, and append section-reference labels where relevant.
- The model's section references (e.g. "PPC Section 302") are rendered as **non-clickable label chips** — they are model-generated text, not retrieved citations.
- Always store and display the **disclaimer**; record thumbs-up/down feedback for later model-quality review.
- Because there is no retrieval grounding, **prompt design + the disclaimer are the primary accuracy safeguards.** Label all output as preliminary.
- The chatbot also classifies the query topic (which practice area it relates to) so the "Connect with a lawyer" CTA can pre-filter search. This can be a lightweight classification done by the same LLM call.

### 9.2 Document Analyzer — OCR + NLP (this stays; it is not RAG)
- **OCR stage:** image/scanned PDF → text (Tesseract or cloud OCR).
- **NLP stage (BERT-style):**
  - **NER:** Person Names, Organizations, Dates, Monetary Amounts, Legal Section References, Geographic Locations.
  - **Classification:** case type ∈ {Civil, Criminal, Family, Property, Corporate, Constitutional, Other}.
  - **Summarization:** 150–300 word plain-English summary.
  - Each extracted entity carries a **confidence score**; surface low overall confidence as a warning.
- Output is the `DocumentAnalysis` record; raw OCR text is **deleted after analysis**.

---

## 10. Lawyer portal

### 10.1 Pending verification (`/lawyer/pending`)
- Shown on every login until an admin acts. Status badge ("Under Review"), submission date/time, per-document status icons (Pending/Verified/Issue Found), estimated review time ("within 48 hours").
- Document with "Issue Found" shows the admin's message + a "Re-upload" button.
- "Update Professional Details" always available (edit bio and non-document fields while pending).
- FAQ section.

### 10.2 Dashboard (`/lawyer/dashboard`)
- Left sidebar: Dashboard | Consultation Requests | Active Cases | My Profile | Documents | Earnings | Settings.
- Top navbar: logo | notifications bell | **availability toggle** (Online/Busy/Offline, click to cycle) | avatar dropdown.
- Four metric cards: Consultations This Week, Total Earnings (PKR, all time), Profile Views (30 days), Average Rating.
- Pending Requests panel (up to 3 newest, inline Accept/Decline, "View all requests").
- Active Cases panel (ongoing, last message time, unread count, "Open chat").
- Recent Reviews (last 2, star + snippet).

### 10.3 Consultation request management (`/lawyer/requests`)
1. Tabs: Pending / Declined / Expired (default Pending).
2. Request card: user first name (last name hidden) | case type | description (truncated 200 chars, "Read more") | time since sent | time-remaining countdown (if < 6h) | Accept | Decline.
3. Accept → confirm modal ("...fee is PKR [amount]. User notified immediately.") → "Confirm Accept".
4. On confirm: status → Active, user notified, chat thread created, lawyer redirected to chat.
5. Decline → modal with **mandatory** reason dropdown ("Not my area of expertise" / "Currently at capacity" / "Insufficient case details" / "Other") + optional message (≤200 chars) → "Confirm Decline".
6. On decline: user notified with reason; request → Declined tab.
7. Auto-expiry: no response in 24h → Expired tab, user notified, **lawyer response-rate metric updated** (unanswered counts against it).
8. Max active consultations cap (Settings, default 10) — when reached, profile button becomes "Currently Unavailable".

### 10.4 Active case / consultation chat (lawyer side) (`/lawyer/consultation/[id]`)
1. Mirrors the user chat (client left, lawyer right).
2. Collapsible Case Info panel (right on desktop): user first name, case type, request description, start date, documents shared by user (download each).
3. **Private Case Notes** field (lawyer-only, auto-saves every 30s, never sent to user).
4. File attachment: lawyer can upload new files (PDF/images ≤10MB) to share — downloadable cards.
5. "Close Consultation" → confirm modal → status Closed, user gets review prompt, case moves to Closed tab, **case notes preserved (lawyer-only)**.
6. "Report Client" (three-dot menu) → report modal → admin moderation queue.

### 10.5 Profile management (`/lawyer/profile/edit`)
- **Editable (save on "Save Changes"):** profile photo (circular crop, immediately public), Bio (rich text, min 200 chars), Practice Areas (multi), Languages (multi), Consultation Fee PKR (applies to **new** requests only, not retroactive), Availability toggle, "Show Win/Loss Statistics" toggle.
- **Read-only post-verification:** Full Legal Name, CNIC, Bar Council Number, Law Degree Certificate (change requires contacting admin support).
- "Preview My Profile" → modal showing exactly the public view with a "You are viewing a preview" watermark.

### 10.6 Earnings & payouts (`/lawyer/earnings`)
- Summary cards: This Month, Last Month, All-Time Total, Pending Payout (all PKR).
- Monthly earnings bar chart (last 12 months, hover totals).
- Transaction log: Consultation ID | Date | Client (anonymized "Client #XX") | Fee PKR | Platform Fee % | Net Earned PKR | Status (Paid/Pending). "Download CSV".
- Payout settings: add method (Bank IBAN+title / Easypaisa / JazzCash), default selector, "Request Payout" (enabled only when pending ≥ PKR 1,000, "processed within 3–5 business days"), payout history.

### 10.7 Settings (`/lawyer/settings`)
- Change Password (same as user), 2FA enable/disable (same as user).
- Notification preferences: new request, request auto-expired, new review, payout processed, security alerts.
- Max active consultations cap (1–50; when reached → profile "Currently Unavailable").
- "Auto-decline when Offline" toggle: if ON, requests received while Offline are auto-declined with reason "Currently unavailable".

---

## 11. Security architecture & rules

### Transport & data
- HTTPS enforced (HTTP → 301 → HTTPS). TLS 1.2 minimum on all API endpoints.
- Passwords hashed with **bcrypt (cost 12)** or **Argon2id** — never plaintext.
- JWT access tokens **15-min** expiry; refresh tokens **30-day**, **rotated on each use**.
- Documents in **encrypted object storage (AES-256 at rest)**.
- Document access URLs **pre-signed, expire after 1 hour** — not externally shareable.

### Auth & sessions
- **RBAC:** every API route verifies the caller's role before processing.
- Session auto-logout after **30 min** inactivity (configurable per role).
- Concurrent session limit: **max 3** per user; oldest invalidated when exceeded.
- Account lockout: **5** failed logins → **15-min** lockout → email to owner.
- Admin accounts: **mandatory 2FA (TOTP)**, **30-min** timeout, **no concurrent sessions**.

### API security
- Rate limiting: **60 req/min per IP** (public), **300/min** (authenticated).
- All text inputs **sanitized server-side** (XSS, SQL injection).
- File uploads: MIME type validated **server-side** (not just extension), **malware-scanned before storage**.
- CORS: allow only the official frontend domain.
- CSRF tokens on all state-changing form submissions.

### Data privacy
- User emails **never shown** to other users/lawyers (only first name in chats).
- CNIC stored **encrypted**, partially masked in all admin views (first 5 digits shown, rest masked).
- Chat messages encrypted at rest — not readable by staff except through the moderation workflow, which **writes an audit-log entry every time a thread is accessed**.
- Document contents processed by AI then raw extracted text **deleted**; only analysis results retained.
- **PECA 2016** compliance for data handling, breach notification, and law-enforcement cooperation.

---

## 12. Admin panel

### 12.1 Login & security (`/admin/login`)
- Separate subdomain, never linked publicly.
- 2FA **mandatory** (TOTP only — no SMS for admins).
- After password: always prompt for TOTP.
- Failed admin login → immediate email alert to super admin.
- Sessions expire after **30 min** inactivity; no "Remember me".

### 12.2 Dashboard (`/admin/dashboard`)
- Top metric cards: Total Registered Users, Total Verified Lawyers, Pending Lawyer Verifications (orange if > 0), Active Consultations Right Now.
- Today's activity: New User Signups, New Lawyer Applications, Documents Processed, AI Chatbot Sessions.
- Charts: User & Lawyer Growth (dual-line, 30 days), Consultation Volume by Case Type (horizontal bar, 7 days), AI Chatbot Feedback (donut, thumbs up % vs down %).
- Right column alerts: Unreviewed Reports (count + "Review Now"), Overdue Verifications (> 48h, list), System Health (API Uptime %, Avg Response ms, Storage Used/Total, OCR Pipeline Status green/red dot).

### 12.3 Lawyer verification workflow (`/admin/verifications`)
1. Queue of pending applications, default sort **oldest first (FIFO)**. Tabs: Pending / Approved / Rejected / Resubmitted.
2. Row: Lawyer Name | Bar Council # | Province | Submission date/time | Time since submission (red if > 48h) | Documents count | "Review".
3. "Review" → full-page panel: left = profile details (name, CNIC, BC#, city, areas, bio, fee); right = document viewer (PDF inline, images full-size).
4. Per-document toggle: "Mark as Verified" (green) / "Mark as Issue Found" (red → text input for the specific issue).
5. Two main actions: "Approve Lawyer" (green) / "Reject Application" (red).
6. Approve → confirm modal → status Verified, congratulations email, lawyer gains full dashboard.
7. Reject → modal with mandatory reason (free text, min 50 chars) + "Allow resubmission" checkbox → rejection email with full reason; if resubmission allowed, lawyer's pending screen shows "Resubmit Application".
8. Resubmission → "Resubmitted" tab with comparison view (old rejected docs left, new docs right) + original rejection reason at top.
9. **All actions logged** to audit log (admin username, timestamp, action, notes).

### 12.4 Account management (`/admin/users`)
1. Search by name/email/CNIC/phone. Filters: Role (User/Lawyer/All), Status (Active/Suspended/Banned/Pending), Registration date range.
2. Table: Name | Email | Role | Status badge | Registration Date | Last Login | Total Consultations | Actions.
3. Click row → full detail: all profile fields, status history, all consultation records (with lawyer names), all uploaded documents, all reports against and by this user.
4. Actions: **Suspend** (1d/7d/30d/Custom, mandatory reason), **Permanently Ban** (irreversible, type the user's email to confirm), **Lift Suspension**, **Reset Password** (OTP email), **View Audit Log** for this account.
5. On suspension: email "suspended until [date]. Reason: [reason]..."; user cannot log in; existing session invalidated immediately.
6. Every action written to audit log.

### 12.5 Content moderation — reports queue (`/admin/reports`)
1. All unresolved reports. Table: Reporter | Reported Party | Type (Conversation/Profile/Review) | Reason Category | Date | Priority badge (auto High/Medium/Low by detected keywords).
2. Click row → detail: full reason text, reporter info, reported-party info. Conversation reports show the message thread with a moderation banner. Profile reports highlight the reported section. Review reports show the flagged review.
3. Actions: Dismiss (mandatory note), Warn User (automated warning email), Suspend (uses §12.4 flow), Permanently Ban, Remove Content (for reviews — delete the review, notify reviewer with explanation).
4. After action: mandatory resolution note (min 20 chars), status → Resolved, reporter emailed "We reviewed your report and took appropriate action."
5. Repeat offenders: 3+ resolved reports in 30 days → auto "High Risk" badge (admin-only); next report auto-elevated to High priority.

### 12.6 Review management (`/admin/reviews`)
- View all reviews. Search by lawyer/reviewer/rating/date/flagged status.
- Flagged reviews (reported by lawyers as fake/abusive) shown with orange "Flagged" badge.
- Actions: Approve Flagged Review (remove flag), Remove Review (permanent, mandatory reason, notify both reviewer and lawyer).
- Lawyer profile shows "X reviews removed by moderators" — transparent but not punitive.

### 12.7 Analytics (`/admin/analytics`)
All charts have a date-range selector (7/30/90/Custom) + CSV export.
- **User Growth:** daily signups (users vs lawyers), cumulative totals, WoW % change.
- **Consultation Analytics:** started/completed/abandoned, avg duration, breakdown by case type, lawyer acceptance-rate distribution.
- **AI Chatbot Analytics:** sessions/day, avg messages/session, thumbs-up %, top 10 query topics, error rate (failed AI responses).
- **Document Analyzer:** documents/day, OCR success rate %, NLP confidence distribution, common case types.
- **Geographic distribution:** choropleth of Pakistan by province user density.
- **Lawyer Performance:** top 10 by consultations / rating / response rate, avg response time, inactivity flag (0 consultations in 30 days).

### 12.8 System configuration (`/admin/settings`, super admin)
- **Practice Areas Management:** add/rename/disable (disabling removes from filters, not retroactive to profiles).
- **Chatbot Disclaimer Text:** edit without code deploy.
- **Platform Fee:** set % taken per consultation (shown to lawyers at registration + on earnings).
- **Email Templates:** edit verification/rejection/welcome/suspension/password-reset emails via template editor.
- **Maintenance Mode:** banner on public pages while keeping admin panel accessible.
- **Admin Account Management:** create admins, assign role (Super Admin / Moderator / Analyst), deactivate. Analyst = read-only; Moderator = reports + verifications; Super Admin = full incl. system settings.

### 12.9 Audit log (`/admin/audit-log`)
- Records every admin action: username | action type | target (user/lawyer/report id) | details | timestamp.
- **Append-only — no one (incl. super admin) can delete entries.**
- Searchable by username/action/date/target. CSV export (filtered or full). Retain ≥ 2 years.

---

## 13. Notifications system

### In-app bell
- Bell with red unread badge (max "99+"). Dropdown = last 20 (icon, text, time-ago, read state; unread = blue left border). Each clickable → relevant page. "Mark all as read" + "View all notifications" → `/notifications`.

### Email — User
Registration OTP; email verified; consultation request accepted; new message from lawyer (**max 1/hour per conversation**, batched); consultation closed (leave review); request expired (24h); document analysis complete; account suspended; new login from unrecognized device; password changed.

### Email — Lawyer
Application received; application approved; application rejected (with reason); new consultation request (respond within 24h); request auto-expired (response rate updated); new review received; payout processed.

### Email — Admin
New lawyer application (digest every 4h if queue non-empty); verification overdue (individual email > 48h); new high-priority report (immediate); admin login from new IP (immediate).

---

## 14. Error handling & edge cases

### Form validation (universal)
- Errors shown **inline below the field**, never only at the top. Specific messages ("Email is already registered", not "Invalid input"). Passing fields show a green check. Multi-step forms block "Next" if current step is invalid. On submission failure (network), show retry and **preserve field data**.

### API & network
- Async operations show a spinner. API error → red toast (top-right, auto-dismiss 5s) with a human-readable message. Slow (> 5s) → "This is taking longer than expected..." + cancel. Full failure → offline banner + Retry.

### Specific edge cases
- Chat with a since-suspended lawyer → read-only, banner "This lawyer is currently unavailable on Lawyerly."
- Lawyer at consultation cap → "Start Consultation" replaced with "This lawyer is currently at capacity..."
- OCR completely fails (corrupt file) → status "Processing Failed", prompt to re-upload / higher-quality scan.
- Chatbot model unavailable → "Our AI assistant is temporarily unavailable. Your message has been saved..." — **do not lose the typed message**.
- Session expired mid-use → modal "Your session has expired. Please log in again." Login redirects back to the prior page.
- Admin approving a lawyer whose Bar Council number already exists on another approved profile → block + "This Bar Council number is already registered to another verified lawyer account."

### Custom error pages
- **404:** friendly message, link home, search bar. **403:** "You do not have permission..." + link to dashboard. **500:** "Something went wrong on our end..." + reference code. **503:** the admin-set maintenance page.

---

## 15. Suggested build order (milestones)

1. **Foundation:** repo, stack scaffolding, DB schema (§4), env config, HTTPS, base layout + theming.
2. **Auth & RBAC:** user + lawyer registration (incl. OTP and 3-step lawyer flow), login with role redirect + lockout/CAPTCHA, forgot-password, 2FA, sessions. Security rules from §11 baked in.
3. **Public pages:** homepage, about, terms, privacy, disclaimer banners.
4. **User core:** dashboard, profile & settings.
5. **Marketplace:** lawyer search/filter/sort, lawyer public profile.
6. **Consultations:** request flow → realtime chat (WebSockets, delivery/read ticks, typing, attachments) → end/close → reviews.
7. **AI Chatbot:** session management + **LLM API integration (no RAG)**, disclaimer, feedback, topic classification + "Connect with a lawyer" CTA.
8. **Document Analyzer:** upload → OCR → NLP (NER + classification + summary) → split-screen results → share-to-consultation. Delete raw text post-analysis.
9. **Lawyer portal:** pending screen, dashboard, requests, active cases (+ private notes), profile edit, earnings & payouts, settings.
10. **Admin panel:** login (2FA), dashboard, verification workflow, account management, reports/moderation, review management, analytics, system config, audit log.
11. **Notifications:** in-app bell + all email templates with batching rules.
12. **Hardening:** error pages, edge cases, rate limiting, malware scanning, audit-log coverage, accessibility & responsive passes.

---

## 16. Definition of done (acceptance criteria)

- All routes in §5 exist and enforce the correct role (RBAC verified server-side).
- A citizen can register (OTP), log in, chat with the AI (with disclaimer + feedback), search lawyers, request and hold a real-time consultation, upload and view a document analysis, and leave a review.
- A lawyer can register (3-step + 5 docs), wait in Pending, be approved by an admin, then manage requests, run consultations with private notes, edit their profile, and view earnings.
- An admin can log in with mandatory 2FA, verify/reject lawyers (FIFO), manage accounts, resolve reports, manage reviews, view analytics, edit system config, and the audit log is append-only and complete.
- Security rules in §11 are implemented; documents are encrypted with expiring URLs; raw OCR text is deleted after analysis.
- Every AI surface shows the disclaimer. **No RAG / vector store exists anywhere in the codebase.**
- Error handling and the specific edge cases in §14 behave as described.

---

*Confidential — FYP Project: Lawyerly App · University of Management and Technology (UMT) · Fall 2025*
*Team: Ahmad Sajjad · Bilal Khan · Ubada Aleem · Hafiz Muhammad Abdullah Mazhar Bhatti*
