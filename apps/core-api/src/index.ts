/**
 * Lawyerly core API — server entry.
 *
 * Milestone 2 (Auth & RBAC): security middleware + the auth router. Feature
 * modules (marketplace, consultations, chatbot, etc.) arrive in later milestones.
 */
import http from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { publicLimiter, authedLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { lawyersRouter } from "./modules/lawyers/lawyers.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.module.js";
import { usersRouter } from "./modules/users/users.module.js";
import { lawyerRouter } from "./modules/lawyer/lawyer.routes.js";
import { consultationsRouter } from "./modules/consultations/consultations.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { storageRouter } from "./modules/storage/storage.routes.js";
import { systemRouter } from "./modules/system/system.routes.js";
import { createSocketServer } from "./realtime/socket.js";
import { expirePendingRequests } from "./modules/consultations/consultations.service.js";
import { ensureBucket } from "./lib/storage.js";

const app = express();

// Behind a reverse proxy in production; trust the first hop for correct client IPs.
app.set("trust proxy", 1);

app.use(helmet());
const allowedOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "core-api", time: new Date().toISOString() });
});

// Public system status (maintenance mode check for Next.js middleware).
app.use("/api/system", publicLimiter, systemRouter);

// Public/unauthenticated rate limit applies to all auth endpoints (§11).
app.use("/api/auth", publicLimiter, authRouter);

// Authenticated feature endpoints (higher rate limit, §11).
app.use("/api/chat", authedLimiter, chatRouter);
app.use("/api/lawyers", authedLimiter, lawyersRouter);
app.use("/api/notifications", authedLimiter, notificationsRouter);
app.use("/api/users", authedLimiter, usersRouter);
app.use("/api/lawyer", authedLimiter, lawyerRouter);
app.use("/api/consultations", authedLimiter, consultationsRouter);
app.use("/api/admin", authedLimiter, adminRouter);
app.use("/api/documents", authedLimiter, documentsRouter);
app.use("/api/storage", authedLimiter, storageRouter);

app.use(notFound);
app.use(errorHandler);

// HTTP server + Socket.IO gateway (realtime consultation chat).
const server = http.createServer(app);
createSocketServer(server);

// Auto-expiry sweep: expire pending requests past their 24h window (§8.5).
setInterval(() => {
  expirePendingRequests()
    .then((n) => { if (n > 0) console.log(`[auto-expiry] expired ${n} pending request(s)`); })
    .catch((e) => console.error("[auto-expiry] error:", e));
}, env.CONSULTATION_EXPIRY_INTERVAL_MS);

// Ensure MinIO bucket exists before accepting requests (§8.7).
ensureBucket()
  .then(() => console.log(`[storage] bucket ready: ${env.S3_BUCKET}`))
  .catch((e) => console.warn("[storage] bucket check failed (non-fatal):", e));

server.listen(env.CORE_API_PORT, () => {
  console.log(`core-api listening on http://localhost:${env.CORE_API_PORT} (HTTP + Socket.IO)`);
});
