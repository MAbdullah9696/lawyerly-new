"use client";

import { useEffect, useState } from "react";
import { accountApi, usersApi, type SessionInfo } from "@/lib/api";
import { ApiRequestError } from "@/lib/api";
import { PasswordInput, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, PasswordMeter, Spinner } from "@/components/ui/Feedback";
import { scorePassword } from "@/lib/validation";
import { timeAgo } from "@/components/user/widgets";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      {desc && <p className="mt-1 text-sm text-navy-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-navy-900" : "bg-navy-200"} ${disabled ? "opacity-50" : ""}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
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

  async function startSetup() {
    setError(""); setLoading(true);
    try { const r = await accountApi.twofaSetup(); setSetup({ qrDataUrl: r.qrDataUrl, secret: r.secret }); }
    catch { setError("Could not start 2FA setup."); }
    finally { setLoading(false); }
  }
  async function enable() {
    setError(""); setLoading(true);
    try { const r = await accountApi.twofaEnable(code); setBackupCodes(r.backupCodes); setSetup(null); setCode(""); onChanged(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.message : "Invalid code."); }
    finally { setLoading(false); }
  }
  async function disable() {
    setError(""); setLoading(true);
    try { await accountApi.twofaDisable(password); setPassword(""); onChanged(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.message : "Incorrect password."); }
    finally { setLoading(false); }
  }

  if (backupCodes) {
    return (
      <div className="space-y-3">
        <Alert variant="success">Two-factor authentication is enabled. Save these backup codes — they are shown only once.</Alert>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-navy-50 p-4 font-mono text-sm text-navy-800 sm:grid-cols-4">
          {backupCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <Button variant="outline" onClick={() => setBackupCodes(null)}>Done</Button>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500" /> 2FA is currently enabled.
        </p>
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
        <p className="text-sm text-navy-600">Scan this QR code in your authenticator app, then enter the 6-digit code to confirm.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrDataUrl} alt="2FA QR code" className="h-44 w-44 rounded-lg border border-navy-100" />
        <p className="text-xs text-navy-400">Or enter this secret manually: <span className="font-mono text-navy-700">{setup.secret}</span></p>
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

  async function revoke(id: string) { await accountApi.revokeSession(id); load(); }
  async function others() { await accountApi.logoutOthers(); load(); }

  if (loading) return <div className="py-4"><Spinner /></div>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-navy-100">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-navy-800">
                {s.browser ?? "Unknown"} {s.current && <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700">This device</span>}
              </p>
              <p className="text-xs text-navy-400">{s.ip ?? "—"} · {s.city ?? "Unknown"} · active {timeAgo(s.lastActiveAt)}</p>
            </div>
            {!s.current && <button onClick={() => revoke(s.id)} className="text-sm font-semibold text-red-600 hover:underline">Log out</button>}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && <Button variant="outline" onClick={others}>Log out of all other devices</Button>}
    </div>
  );
}

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailPrefs, setEmailPrefs] = useState({ message: true, accepted: true, expired: true });
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [dataRequested, setDataRequested] = useState(false);

  function loadProfile() { usersApi.me().then(({ profile }) => setEnabled(profile.twoFactorEnabled)).finally(() => setLoading(false)); }
  useEffect(loadProfile, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="mt-1 text-navy-500">Manage security, notifications, and your data.</p>
      </div>

      <Card title="Change Password"><ChangePassword /></Card>
      <Card title="Two-Factor Authentication"><TwoFactor enabled={enabled} onChanged={loadProfile} /></Card>
      <Card title="Active Sessions" desc="Devices currently signed in to your account."><Sessions /></Card>

      <Card title="Notification Preferences" desc="Choose which emails you receive. Account-security alerts are always on.">
        <ul className="space-y-3">
          {[
            { key: "message" as const, label: "New message from a lawyer" },
            { key: "accepted" as const, label: "Consultation request accepted" },
            { key: "expired" as const, label: "Consultation request expired" },
          ].map((p) => (
            <li key={p.key} className="flex items-center justify-between">
              <span className="text-sm text-navy-700">{p.label}</span>
              <Toggle checked={emailPrefs[p.key]} onChange={(v) => setEmailPrefs((s) => ({ ...s, [p.key]: v }))} />
            </li>
          ))}
          <li className="flex items-center justify-between">
            <span className="text-sm text-navy-400">Account security alerts (always on)</span>
            <Toggle checked disabled />
          </li>
        </ul>
        <p className="mt-3 text-xs text-navy-400">Preference persistence is finalised in the notifications milestone.</p>
      </Card>

      <Card title="Privacy &amp; Data">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-navy-800">Download my data</p>
              <p className="text-xs text-navy-400">A ZIP of your chats, documents, and profile.</p>
            </div>
            <Button variant="outline" onClick={() => setDataRequested(true)}>Request</Button>
          </div>
          {dataRequested && <Alert variant="info">If available, we'll email you a download link within 24 hours. (Export pipeline lands in a later milestone.)</Alert>}
          <hr className="border-navy-100" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-600">Delete account</p>
              <p className="text-xs text-navy-400">Permanent deletion after a 30-day grace period.</p>
            </div>
            <Button variant="outline" className="!border-red-300 !text-red-600 hover:!bg-red-50" onClick={() => setDeleteModal(true)}>Delete</Button>
          </div>
        </div>
      </Card>

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setDeleteModal(false)} />
          <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="text-lg font-bold text-red-600">Delete account</h3>
            <p className="text-sm text-navy-600">This deactivates your account immediately and permanently deletes it after 30 days. Type <b>DELETE</b> to confirm.</p>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
            <Alert variant="warning">Account deletion is wired in a later milestone — this is a preview of the flow.</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteModal(false); setDeleteConfirm(""); }}>Cancel</Button>
              <Button className="!bg-red-600 hover:!bg-red-500" disabled={deleteConfirm !== "DELETE"}>Delete account</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
