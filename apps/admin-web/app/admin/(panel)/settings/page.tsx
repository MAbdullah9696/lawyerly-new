"use client";

import { useEffect, useState } from "react";
import { adminApi, ApiRequestError } from "@/lib/api";
import { useAdmin, can } from "@/lib/auth-context";
import { Spinner, Alert, Field, Select, Textarea, Modal, Chip } from "@/components/ui";

interface Settings {
  chatbotDisclaimerText: string; platformFeePercent: number; maintenanceMode: boolean;
  practiceAreas: { id: string; name: string; enabled: boolean }[];
  admins: { id: string; username: string; role: string; isActive: boolean; lastLoginAt: string | null }[];
  emailTemplates?: Record<string, string>;
}

const EMAIL_TEMPLATE_KEYS = [
  { key: "verification-approved", label: "Verification Approved", placeholder: "Congratulations {{name}}! Your application has been approved..." },
  { key: "verification-rejected", label: "Verification Rejected", placeholder: "Hi {{name}}, unfortunately your application was not approved. Reason: {{reason}}..." },
  { key: "account-suspended", label: "Account Suspended", placeholder: "Hi {{name}}, your account has been suspended until {{until}}. Reason: {{reason}}..." },
  { key: "password-reset", label: "Password Reset", placeholder: "Hi {{name}}, click the link to reset your password: {{link}}..." },
  { key: "welcome", label: "Welcome Email", placeholder: "Welcome to Lawyerly, {{name}}! Get started by..." },
] as const;

export default function SettingsPage() {
  const { admin } = useAdmin();
  const isSuper = can.super(admin?.role);
  const [s, setS] = useState<Settings | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [fee, setFee] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [areas, setAreas] = useState<{ id: string; name: string; enabled: boolean }[]>([]);
  const [newArea, setNewArea] = useState("");
  const [emailTemplates, setEmailTemplates] = useState<Record<string, string>>({});
  const [emailTemplatesOpen, setEmailTemplatesOpen] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ username: "", password: "", role: "analyst" });
  const [createdQr, setCreatedQr] = useState<{ username: string; qrDataUrl: string; secret: string } | null>(null);

  function hydrate(data: Settings) { setS(data); setDisclaimer(data.chatbotDisclaimerText); setFee(String(data.platformFeePercent)); setMaintenance(data.maintenanceMode); setAreas(data.practiceAreas); setEmailTemplates(data.emailTemplates ?? {}); }
  function load() { adminApi.get<Settings>("settings").then(hydrate); }
  useEffect(load, []);

  async function saveConfig() {
    setErr(""); setMsg("");
    try { const r = await adminApi.patch<Settings>("settings", { chatbotDisclaimerText: disclaimer, platformFeePercent: Number(fee), maintenanceMode: maintenance, practiceAreas: areas.map((a) => ({ name: a.name, enabled: a.enabled })), emailTemplates }); hydrate(r); setMsg("Settings saved."); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Save failed."); }
  }
  function addArea() { if (newArea.trim() && !areas.some((a) => a.name === newArea.trim())) { setAreas([...areas, { id: newArea, name: newArea.trim(), enabled: true }]); setNewArea(""); } }
  async function createAdmin() {
    setErr("");
    try { const r = await adminApi.post<{ username: string; qrDataUrl: string; twoFactorSecret: string }>("accounts", newAdmin); setCreatedQr({ username: r.username, qrDataUrl: r.qrDataUrl, secret: r.twoFactorSecret }); setCreateOpen(false); setNewAdmin({ username: "", password: "", role: "analyst" }); load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Create failed."); }
  }
  async function toggleAdmin(id: string, isActive: boolean) { await adminApi.patch(`accounts/${id}`, { isActive }); load(); }

  if (!s) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">System Settings</h1>
      {!isSuper && <Alert variant="info">Settings are read-only — only Super Admins can modify them.</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}
      {err && <Alert variant="error">{err}</Alert>}

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold text-navy-900">Platform Configuration</h2>
        <Textarea label="Chatbot disclaimer text" value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} disabled={!isSuper} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform fee (%)" type="number" value={fee} onChange={(e) => setFee(e.target.value)} disabled={!isSuper} />
          <label className="flex items-center gap-2 pt-7 text-sm text-navy-700"><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} disabled={!isSuper} /> Maintenance mode</label>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-900">Practice Areas</h2>
        <div className="flex flex-wrap gap-2">
          {areas.map((a, i) => (
            <button key={a.id} disabled={!isSuper} onClick={() => setAreas(areas.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))}
              className={`chip ${a.enabled ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-400 line-through"}`}>{a.name}</button>
          ))}
        </div>
        {isSuper && <div className="flex gap-2"><Field placeholder="Add practice area…" value={newArea} onChange={(e) => setNewArea(e.target.value)} /><button onClick={addArea} className="btn-outline">Add</button></div>}
      </section>

      <section className="card p-5">
        <button className="flex w-full items-center justify-between text-left" onClick={() => setEmailTemplatesOpen(!emailTemplatesOpen)}>
          <h2 className="font-semibold text-navy-900">Email Templates</h2>
          <span className="text-sm text-navy-500">{emailTemplatesOpen ? "▲ Collapse" : "▼ Expand"}</span>
        </button>
        {emailTemplatesOpen && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-navy-500">Override the default email body for key system emails. Use <code className="rounded bg-navy-100 px-1">{"{{variable}}"}</code> placeholders as shown. Leave blank to use the built-in default.</p>
            {EMAIL_TEMPLATE_KEYS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium text-navy-700">{label}</label>
                <textarea
                  rows={4}
                  disabled={!isSuper}
                  placeholder={placeholder}
                  value={emailTemplates[key] ?? ""}
                  onChange={(e) => setEmailTemplates({ ...emailTemplates, [key]: e.target.value })}
                  className="w-full rounded-xl border border-navy-200 px-3 py-2 text-sm text-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-400 disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {isSuper && <div className="flex justify-end"><button onClick={saveConfig} className="btn-primary">Save Settings</button></div>}

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Admin Accounts</h2>
          {isSuper && <button onClick={() => { setCreateOpen(true); setErr(""); }} className="btn-outline !py-1 !text-xs">Create admin</button>}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400"><th className="p-2">Username</th><th className="p-2">Role</th><th className="p-2">Status</th><th className="p-2">Last login</th><th className="p-2"></th></tr></thead>
          <tbody>
            {s.admins.map((a) => (
              <tr key={a.id} className="border-b border-navy-50">
                <td className="p-2 font-medium text-navy-900">{a.username}</td>
                <td className="p-2 text-navy-600">{a.role}</td>
                <td className="p-2"><Chip tone={a.isActive ? "green" : "gray"}>{a.isActive ? "active" : "disabled"}</Chip></td>
                <td className="p-2 text-navy-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : "—"}</td>
                <td className="p-2 text-right">{isSuper && a.id !== admin?.id && <button onClick={() => toggleAdmin(a.id, !a.isActive)} className="text-xs font-semibold text-navy-600 hover:underline">{a.isActive ? "Deactivate" : "Activate"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      {createOpen && (
        <Modal title="Create admin account" onClose={() => setCreateOpen(false)}>
          {err && <div className="mb-3"><Alert variant="error">{err}</Alert></div>}
          <div className="space-y-3">
            <Field label="Username" value={newAdmin.username} onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })} />
            <Field label="Temporary password" type="text" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
            <Select label="Role" value={newAdmin.role} onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })} options={[{ value: "analyst", label: "Analyst (read-only)" }, { value: "moderator", label: "Moderator" }, { value: "super_admin", label: "Super Admin" }]} />
            <div className="flex justify-end gap-2"><button onClick={() => setCreateOpen(false)} className="btn-outline">Cancel</button><button onClick={createAdmin} className="btn-primary" disabled={newAdmin.username.length < 3 || newAdmin.password.length < 8}>Create</button></div>
          </div>
        </Modal>
      )}

      {createdQr && (
        <Modal title="Admin created — share 2FA setup" onClose={() => setCreatedQr(null)}>
          <Alert variant="success">Account <b>{createdQr.username}</b> created. They must scan this QR in an authenticator app to log in.</Alert>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={createdQr.qrDataUrl} alt="2FA QR" className="mx-auto mt-3 h-44 w-44 rounded-lg border border-navy-100" />
          <p className="mt-2 text-center text-xs text-navy-500">Secret: <span className="font-mono">{createdQr.secret}</span></p>
          <div className="mt-3 flex justify-end"><button onClick={() => setCreatedQr(null)} className="btn-primary">Done</button></div>
        </Modal>
      )}
    </div>
  );
}
