"use client";

import { useEffect, useState } from "react";
import { accountApi, usersApi, ApiRequestError, type SessionInfo } from "@/lib/api";
import { PasswordInput, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, PasswordMeter, Spinner } from "@/components/ui/Feedback";
import { scorePassword } from "@/lib/validation";
import { timeAgo } from "@/components/user/widgets";

export function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      {desc && <p className="mt-1 text-sm text-navy-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const strength = scorePassword(next);
  const ok = cur && strength.valid && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setDone(false); setLoading(true);
    try {
      await accountApi.changePassword({ currentPassword: cur, newPassword: next, confirmPassword: confirm });
      setDone(true); setCur(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not change password.");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {done && <Alert variant="success">Password updated. Other devices have been logged out.</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <PasswordInput label="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      <div>
        <PasswordInput label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        {next && <PasswordMeter strength={strength} />}
      </div>
      <PasswordInput label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" error={confirm && next !== confirm ? "Passwords do not match." : undefined} />
      <div className="flex justify-end"><Button type="submit" loading={loading} disabled={!ok}>Update password</Button></div>
    </form>
  );
}

function TwoFactor({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSetup() { setError(""); setLoading(true); try { const r = await accountApi.twofaSetup(); setSetup({ qrDataUrl: r.qrDataUrl, secret: r.secret }); } catch { setError("Could not start 2FA setup."); } finally { setLoading(false); } }
  async function enable() { setError(""); setLoading(true); try { const r = await accountApi.twofaEnable(code); setBackupCodes(r.backupCodes); setSetup(null); setCode(""); onChanged(); } catch (err) { setError(err instanceof ApiRequestError ? err.message : "Invalid code."); } finally { setLoading(false); } }
  async function disable() { setError(""); setLoading(true); try { await accountApi.twofaDisable(password); setPassword(""); onChanged(); } catch (err) { setError(err instanceof ApiRequestError ? err.message : "Incorrect password."); } finally { setLoading(false); } }

  if (backupCodes) {
    return (
      <div className="space-y-3">
        <Alert variant="success">Two-factor authentication is enabled. Save these backup codes — shown only once.</Alert>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-navy-50 p-4 font-mono text-sm text-navy-800 sm:grid-cols-4">{backupCodes.map((c) => <span key={c}>{c}</span>)}</div>
        <Button variant="outline" onClick={() => setBackupCodes(null)}>Done</Button>
      </div>
    );
  }
  if (enabled) {
    return (
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-green-700"><span className="h-2 w-2 rounded-full bg-green-500" /> 2FA is currently enabled.</p>
        {error && <Alert variant="error">{error}</Alert>}
        <PasswordInput label="Enter your password to disable" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button variant="outline" onClick={disable} loading={loading} disabled={!password}>Disable 2FA</Button>
      </div>
    );
  }
  if (setup) {
    return (
      <div className="space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-navy-600">Scan this QR code in your authenticator app, then enter the 6-digit code.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrDataUrl} alt="2FA QR code" className="h-44 w-44 rounded-lg border border-navy-100" />
        <p className="text-xs text-navy-400">Secret: <span className="font-mono text-navy-700">{setup.secret}</span></p>
        <Input label="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-40 text-center tracking-[0.3em]" />
        <div className="flex gap-2"><Button onClick={enable} loading={loading} disabled={code.length !== 6}>Confirm &amp; Enable</Button><Button variant="outline" onClick={() => setSetup(null)}>Cancel</Button></div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <p className="text-sm text-navy-600">Add an extra layer of security with an authenticator app (TOTP).</p>
      <Button onClick={startSetup} loading={loading}>Enable 2FA</Button>
    </div>
  );
}

function Sessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  function load() { accountApi.sessions().then((r) => setSessions(r.sessions)).finally(() => setLoading(false)); }
  useEffect(load, []);
  if (loading) return <div className="py-4"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-navy-100">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-navy-800">{s.browser ?? "Unknown"} {s.current && <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">This device</span>}</p>
              <p className="text-xs text-navy-400">{s.ip ?? "—"} · {s.city ?? "Unknown"} · active {timeAgo(s.lastActiveAt)}</p>
            </div>
            {!s.current && <button onClick={async () => { await accountApi.revokeSession(s.id); load(); }} className="text-sm font-semibold text-red-600 hover:underline">Log out</button>}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && <Button variant="outline" onClick={async () => { await accountApi.logoutOthers(); load(); }}>Log out of all other devices</Button>}
    </div>
  );
}

/** Shared security cards (password, 2FA, sessions) used by user and lawyer settings. */
export function SecuritySection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  function loadProfile() { usersApi.me().then(({ profile }) => setEnabled(profile.twoFactorEnabled)).finally(() => setLoading(false)); }
  useEffect(loadProfile, []);
  if (loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  return (
    <>
      <Card title="Change Password"><ChangePassword /></Card>
      <Card title="Two-Factor Authentication"><TwoFactor enabled={enabled} onChanged={loadProfile} /></Card>
      <Card title="Active Sessions" desc="Devices currently signed in to your account."><Sessions /></Card>
    </>
  );
}
