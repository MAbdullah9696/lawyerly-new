"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, ApiRequestError } from "@/lib/api";
import { useAdmin } from "@/lib/auth-context";
import { Alert, Field, Spinner } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const { admin, loading, setAdmin } = useAdmin();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && admin) router.replace("/admin/dashboard"); }, [loading, admin, router]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await adminApi.login(username, password);
      setTwoFactorToken(r.twoFactorToken);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Login failed.");
    } finally { setBusy(false); }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const { admin } = await adminApi.verify2fa(twoFactorToken, code);
      setAdmin(admin);
      router.replace("/admin/dashboard");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Verification failed.");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-gold-400">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M5 21h14M7 6l-3 6a3 3 0 0 0 6 0L7 6Zm10 0-3 6a3 3 0 0 0 6 0l-3-6ZM5 6h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h1 className="mt-3 font-serif text-2xl font-bold text-white">Lawyerly Admin</h1>
          <p className="text-xs uppercase tracking-widest text-gold-400">Restricted access</p>
        </div>

        <div className="card p-6">
          {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}
          {step === 1 ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
              <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Continue"}</button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-4">
              <p className="text-sm text-navy-600">Enter the 6-digit code from your authenticator app. <span className="font-medium">2FA is mandatory for admins.</span></p>
              <Field label="Authentication code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" className="field text-center text-lg tracking-[0.3em]" autoFocus required />
              <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "…" : "Verify & Sign In"}</button>
              <button type="button" onClick={() => { setStep(1); setCode(""); setError(""); }} className="w-full text-sm font-medium text-navy-500 hover:text-navy-800">← Back</button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-[11px] text-navy-500">Failed login attempts are logged and alert the super admin.</p>
      </div>
    </div>
  );
}
