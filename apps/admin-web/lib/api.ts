export interface ApiError { code: string; message: string; fields?: Record<string, string[]> }

export class ApiRequestError extends Error {
  code: string; status: number; fields?: Record<string, string[]>;
  constructor(status: number, err: ApiError) { super(err.message); this.status = status; this.code = err.code; this.fields = err.fields; }
}

async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiRequestError(res.status, data.error ?? { code: "error", message: "Request failed." });
  return data as T;
}

export type AdminProfile = { id: string; username: string; role: "super_admin" | "moderator" | "analyst" };

export const adminApi = {
  login: (username: string, password: string) =>
    request<{ twoFactorRequired: boolean; twoFactorToken: string }>("/api/admin/auth/login", { method: "POST", body: { username, password } }),
  verify2fa: (twoFactorToken: string, code: string) =>
    request<{ admin: AdminProfile }>("/api/admin/auth/2fa", { method: "POST", body: { twoFactorToken, code } }),
  logout: () => request<{ ok: boolean }>("/api/admin/auth/logout", { method: "POST" }),
  me: () => request<AdminProfile>("/api/admin/auth/me"),
  get: <T>(p: string) => request<T>(`/api/admin/${p}`),
  post: <T>(p: string, body?: unknown) => request<T>(`/api/admin/${p}`, { method: "POST", body }),
  patch: <T>(p: string, body?: unknown) => request<T>(`/api/admin/${p}`, { method: "PATCH", body }),
};
