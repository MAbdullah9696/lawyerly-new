/**
 * Browser API client. All auth calls go to the SAME-ORIGIN Next BFF route
 * handlers under /api/auth/*, which proxy to core-api (localhost:4000) and
 * manage the httpOnly refresh-token cookie. The access token lives in memory
 * (see auth-context) and is attached here for authenticated requests.
 */
import type { ApiError, AuthSession, PublicUser } from "./types";

export class ApiRequestError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;
  constructor(status: number, err: ApiError) {
    super(err.message);
    this.status = status;
    this.code = err.code;
    this.fields = err.fields;
  }
}

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err: ApiError = data.error ?? { code: "error", message: "Request failed." };
    throw new ApiRequestError(res.status, err);
  }
  return data as T;
}

// ---- Auth endpoints ---------------------------------------------------------
export type LoginResponse =
  | AuthSession
  | { twoFactorRequired: true; twoFactorToken: string };

export const api = {
  registerUser: (body: unknown) =>
    request<{ message: string; userId: string; email: string }>("/api/auth/register/user", {
      method: "POST",
      body,
    }),

  verifyEmail: (body: unknown) =>
    request<AuthSession>("/api/auth/register/verify-email", { method: "POST", body }),

  resendOtp: (body: unknown) =>
    request<{ message: string; resendAvailableInSeconds: number }>(
      "/api/auth/register/resend-otp",
      { method: "POST", body },
    ),

  registerLawyer: (body: unknown) =>
    request<AuthSession>("/api/auth/register/lawyer", { method: "POST", body }),

  login: (body: unknown) => request<LoginResponse>("/api/auth/login", { method: "POST", body }),

  loginTwoFactor: (body: unknown) =>
    request<AuthSession>("/api/auth/login/2fa", { method: "POST", body }),

  refresh: () => request<{ accessToken: string }>("/api/auth/refresh", { method: "POST" }),

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST", auth: true }),

  me: () => request<{ user: PublicUser }>("/api/auth/me", { auth: true }),

  forgotPassword: (body: unknown) =>
    request<{ message: string }>("/api/auth/forgot-password", { method: "POST", body }),

  resetPassword: (body: unknown) =>
    request<{ message: string }>("/api/auth/reset-password", { method: "POST", body }),
};

// ---- Authenticated core-api client -----------------------------------------
// Calls core-api directly with the in-memory access token. On 401 it silently
// refreshes via the same-origin BFF (which holds the httpOnly cookie) and retries.
const CORE = process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4000";

async function coreFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const send = (token: string | null) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${CORE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res = await send(accessToken);
  if (res.status === 401) {
    const r = await fetch("/api/auth/refresh", { method: "POST" });
    if (r.ok) {
      const { accessToken: next } = await r.json();
      setAccessToken(next);
      res = await send(next);
    }
  }

  if (res.status === 401) {
    // Both the original request and the post-refresh retry returned 401 —
    // the session is fully expired. Signal the UI to show the expiry modal.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("session-expired", {
          detail: { returnTo: window.location.pathname },
        }),
      );
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err: ApiError = data.error ?? { code: "error", message: "Request failed." };
    throw new ApiRequestError(res.status, err);
  }
  return data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const chatApi = {
  send: (body: { sessionId?: string; message: string }) =>
    coreFetch<import("./types").ChatSendResult>("/api/chat/message", { method: "POST", body }),
  sessions: () => coreFetch<{ sessions: import("./types").ChatSessionSummary[] }>("/api/chat/sessions"),
  messages: (id: string) =>
    coreFetch<{ session: import("./types").ChatSessionSummary; messages: import("./types").ChatMessage[] }>(
      `/api/chat/sessions/${id}/messages`,
    ),
  feedback: (id: string, feedback: "up" | "down" | null) =>
    coreFetch<{ message: string }>(`/api/chat/messages/${id}/feedback`, { method: "PATCH", body: { feedback } }),
};

export const lawyersApi = {
  list: (params: Record<string, string | number | undefined>) =>
    coreFetch<import("./types").LawyerListResult>(`/api/lawyers${qs(params)}`),
  get: (id: string, params: Record<string, string | number | undefined> = {}) =>
    coreFetch<import("./types").LawyerDetailResult>(`/api/lawyers/${id}${qs(params)}`),
};

export const notificationsApi = {
  list: (page = 1) => coreFetch<import("./types").NotificationListResult>(`/api/notifications?page=${page}`),
  markRead: (id: string) => coreFetch<{ message: string }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => coreFetch<{ message: string }>("/api/notifications/read-all", { method: "PATCH" }),
};

export const usersApi = {
  me: () => coreFetch<{ profile: import("./types").FullProfile }>("/api/users/me"),
  update: (body: Partial<{ fullName: string; phone: string | null; province: string | null; profilePhotoUrl: string | null }>) =>
    coreFetch<{ message: string; profile: import("./types").FullProfile }>("/api/users/me", {
      method: "PATCH",
      body,
    }),
};

export interface SessionInfo {
  id: string;
  device: string | null;
  browser: string | null;
  ip: string | null;
  city: string | null;
  lastActiveAt: string;
  current: boolean;
}

export const consultationsApi = {
  request: (body: { lawyerId: string; caseType: string; description: string }) =>
    coreFetch<{ requestId: string }>("/api/consultations/request", { method: "POST", body }),
  requests: () => coreFetch<{ requests: import("./types").MyRequestItem[] }>("/api/consultations/requests"),
  cancelRequest: (id: string) => coreFetch<{ ok: boolean }>(`/api/consultations/requests/${id}`, { method: "DELETE" }),
  list: (tab: "active" | "pending" | "closed") =>
    coreFetch<{ items: import("./types").MyConsultationItem[] | import("./types").MyRequestItem[] }>(
      `/api/consultations?tab=${tab}`,
    ),
  header: (id: string) => coreFetch<import("./types").ConsultationHeader>(`/api/consultations/${id}`),
  messages: (id: string, page = 1) =>
    coreFetch<{ messages: import("./types").ChatMessageDTO[]; total: number; page: number; pageSize: number }>(
      `/api/consultations/${id}/messages?page=${page}`,
    ),
  sendMessage: (id: string, text: string) =>
    coreFetch<import("./types").ChatMessageDTO>(`/api/consultations/${id}/messages`, { method: "POST", body: { text } }),
  attach: (id: string, documentId: string) =>
    coreFetch<import("./types").ChatMessageDTO>(`/api/consultations/${id}/attachments`, { method: "POST", body: { documentId } }),
  close: (id: string) => coreFetch<{ ok: boolean }>(`/api/consultations/${id}/close`, { method: "POST" }),
  review: (id: string, body: { rating: number; text?: string; caseType?: string }) =>
    coreFetch<{ ok: boolean }>(`/api/consultations/${id}/review`, { method: "POST", body }),
};

export const lawyerApi = {
  dashboard: () => coreFetch<import("./types").LawyerDashboard>("/api/lawyer/dashboard"),
  requests: (tab: "pending" | "declined" | "expired") =>
    coreFetch<{ requests: import("./types").LawyerRequest[] }>(`/api/lawyer/requests?tab=${tab}`),
  accept: (id: string) => coreFetch<{ consultationId: string }>(`/api/lawyer/requests/${id}/accept`, { method: "POST" }),
  decline: (id: string, reason: string, message?: string) =>
    coreFetch<{ ok: boolean }>(`/api/lawyer/requests/${id}/decline`, { method: "POST", body: { reason, message } }),
  cases: (tab: "active" | "closed") =>
    coreFetch<{ cases: import("./types").LawyerCaseItem[] }>(`/api/lawyer/cases?tab=${tab}`),
  consultation: (id: string) => coreFetch<import("./types").LawyerConsultation>(`/api/lawyer/consultations/${id}`),
  saveNotes: (id: string, caseNotes: string) =>
    coreFetch<{ ok: boolean }>(`/api/lawyer/consultations/${id}/notes`, { method: "PATCH", body: { caseNotes } }),
  closeCase: (id: string) => coreFetch<{ ok: boolean }>(`/api/lawyer/consultations/${id}/close`, { method: "POST" }),
  earnings: () => coreFetch<import("./types").LawyerEarnings>("/api/lawyer/earnings"),
  addMethod: (body: { type: string; details: Record<string, string>; isDefault?: boolean }) =>
    coreFetch<{ id: string }>("/api/lawyer/payouts/methods", { method: "POST", body }),
  requestPayout: () => coreFetch<{ payoutId: string; amountPkr: number }>("/api/lawyer/payouts/request", { method: "POST" }),
  profile: () => coreFetch<{ profile: import("./types").LawyerOwnProfile }>("/api/lawyer/profile"),
  updateProfile: (body: Record<string, unknown>) =>
    coreFetch<{ message: string; profile: import("./types").LawyerOwnProfile }>("/api/lawyer/profile", { method: "PATCH", body }),
  setAvailability: (availability: "online" | "busy" | "offline") =>
    coreFetch<{ availability: string }>("/api/lawyer/availability", { method: "PATCH", body: { availability } }),
  settings: (body: { maxActiveConsultations?: number; autoDeclineWhenOffline?: boolean }) =>
    coreFetch<{ ok: boolean }>("/api/lawyer/settings", { method: "PATCH", body }),
};

// ---- Storage helpers --------------------------------------------------------

/**
 * Presign → PUT a file directly to MinIO → return the objectKey.
 * Call this before registering the upload with core-api.
 */
export async function presignAndUpload(
  file: File,
  type: "document" | "profile" | "lawyer-doc",
): Promise<string> {
  const { putUrl, objectKey } = await coreFetch<{ putUrl: string; objectKey: string }>(
    `/api/storage/presign?type=${type}&filename=${encodeURIComponent(file.name)}`,
  );
  const res = await fetch(putUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`);
  return objectKey;
}

export const documentsApi = {
  list: () =>
    coreFetch<{ documents: import("./types").DocumentDTO[] }>("/api/documents"),
  get: (id: string) =>
    coreFetch<{ document: import("./types").DocumentDTO }>(`/api/documents/${id}`),
  upload: (body: { objectKey: string; fileName: string; fileType: string }) =>
    coreFetch<{ documentId: string; status: string }>("/api/documents/upload", {
      method: "POST",
      body,
    }),
  delete: (id: string) =>
    coreFetch<{ ok: boolean }>(`/api/documents/${id}`, { method: "DELETE" }),
  serveUrl: (id: string) =>
    coreFetch<{ url: string }>(`/api/documents/${id}/url`),
};

export const accountApi = {
  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    coreFetch<{ message: string }>("/api/auth/change-password", { method: "POST", body }),
  twofaSetup: () =>
    coreFetch<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/api/auth/2fa/setup", { method: "POST" }),
  twofaEnable: (code: string) =>
    coreFetch<{ message: string; backupCodes: string[] }>("/api/auth/2fa/enable", { method: "POST", body: { code } }),
  twofaDisable: (password: string) =>
    coreFetch<{ message: string }>("/api/auth/2fa/disable", { method: "POST", body: { password } }),
  sessions: () => coreFetch<{ sessions: SessionInfo[] }>("/api/auth/sessions"),
  revokeSession: (id: string) => coreFetch<{ message: string }>(`/api/auth/sessions/${id}`, { method: "DELETE" }),
  logoutOthers: () => coreFetch<{ message: string }>("/api/auth/sessions/logout-others", { method: "POST" }),
};
