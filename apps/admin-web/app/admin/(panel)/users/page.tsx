"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, ApiRequestError } from "@/lib/api";
import { useAdmin, can } from "@/lib/auth-context";
import { Spinner, Modal, Chip, StatTone, Alert, Field, Select, Textarea } from "@/components/ui";

interface Row { id: string; fullName: string; email: string; role: string; status: string; createdAt: string; lastLoginAt: string | null; suspendedUntil: string | null; consultations: number }
interface Detail {
  user: { id: string; fullName: string; email: string; phone: string | null; role: string; status: string; province: string | null; createdAt: string; lastLoginAt: string | null; suspendedUntil: string | null; lawyer: { verificationStatus: string; barCouncilNumber: string; cnicLast4: string } | null };
  consultations: { id: string; status: string; caseType: string; with: string; startedAt: string }[];
  documents: { id: string; fileName: string; status: string }[];
  reportsAgainst: number; reportsBy: number;
}

export default function UsersPage() {
  const { admin } = useAdmin();
  const writable = can.write(admin?.role);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [action, setAction] = useState<"" | "suspend" | "ban" | "reset">("");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ q, role, status });
    adminApi.get<{ items: Row[] }>(`users?${p}`).then((r) => setRows(r.items)).finally(() => setLoading(false));
  }, [q, role, status]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function open(id: string) { setAction(""); setErr(""); setMsg(""); setDetail(await adminApi.get<Detail>(`users/${id}`)); }
  function refresh() { if (detail) open(detail.user.id); load(); }

  async function run() {
    if (!detail) return;
    setErr("");
    try {
      if (action === "suspend") { await adminApi.post(`users/${detail.user.id}/suspend`, { days: days === "custom" ? null : Number(days), reason }); setMsg("User suspended."); }
      else if (action === "ban") { await adminApi.post(`users/${detail.user.id}/ban`, { confirmEmail }); setMsg("User banned."); }
      else if (action === "reset") { await adminApi.post(`users/${detail.user.id}/reset-password`); setMsg("Password reset email sent."); }
      setAction(""); setReason(""); setConfirmEmail(""); refresh();
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Action failed."); }
  }
  async function lift() { if (!detail) return; await adminApi.post(`users/${detail.user.id}/lift-suspension`); setMsg("Suspension lifted."); refresh(); }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900">Users</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field placeholder="Search name / email / phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={role} onChange={(e) => setRole(e.target.value)} options={[{ value: "all", label: "All roles" }, { value: "citizen", label: "Citizens" }, { value: "lawyer", label: "Lawyers" }]} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "banned", label: "Banned" }, { value: "pending", label: "Pending" }]} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="mt-4 overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400"><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Joined</th><th className="p-3">Consults</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-navy-50 hover:bg-navy-50/50" onClick={() => open(r.id)}>
                  <td className="p-3 font-medium text-navy-900">{r.fullName}</td>
                  <td className="p-3 text-navy-600">{r.email}</td>
                  <td className="p-3 capitalize text-navy-600">{r.role}</td>
                  <td className="p-3"><Chip tone={StatTone(r.status)}>{r.status}</Chip></td>
                  <td className="p-3 text-navy-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-navy-600">{r.consultations}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-navy-400">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal title={detail.user.fullName} wide onClose={() => setDetail(null)}>
          {msg && <div className="mb-3"><Alert variant="success">{msg}</Alert></div>}
          {err && <div className="mb-3"><Alert variant="error">{err}</Alert></div>}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p><span className="text-navy-400">Email:</span> {detail.user.email}</p>
              <p><span className="text-navy-400">Phone:</span> {detail.user.phone ?? "—"}</p>
              <p><span className="text-navy-400">Role:</span> {detail.user.role}</p>
              <p><span className="text-navy-400">Status:</span> <Chip tone={StatTone(detail.user.status)}>{detail.user.status}</Chip>{detail.user.suspendedUntil && <span className="ml-1 text-xs text-navy-400">until {new Date(detail.user.suspendedUntil).toLocaleDateString()}</span>}</p>
              <p><span className="text-navy-400">Province:</span> {detail.user.province ?? "—"}</p>
              {detail.user.lawyer && <p><span className="text-navy-400">Bar Council #:</span> {detail.user.lawyer.barCouncilNumber} ({detail.user.lawyer.verificationStatus})</p>}
              <p><span className="text-navy-400">Reports:</span> {detail.reportsAgainst} against · {detail.reportsBy} by</p>
            </div>
            <div className="text-sm">
              <p className="mb-1 font-semibold text-navy-900">Consultations ({detail.consultations.length})</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {detail.consultations.map((c) => <li key={c.id} className="flex justify-between text-navy-600"><span>{c.caseType} · {c.with}</span><Chip tone={StatTone(c.status)}>{c.status}</Chip></li>)}
                {detail.consultations.length === 0 && <li className="text-navy-400">None</li>}
              </ul>
            </div>
          </div>

          {writable && (
            <div className="mt-5 border-t border-navy-100 pt-4">
              {action === "" ? (
                <div className="flex flex-wrap gap-2">
                  {detail.user.status === "suspended" && <button onClick={lift} className="btn-outline">Lift suspension</button>}
                  {detail.user.status !== "banned" && <button onClick={() => setAction("suspend")} className="btn-outline !text-gold-700">Suspend</button>}
                  {detail.user.status !== "banned" && <button onClick={() => setAction("ban")} className="btn-outline !text-red-600">Permanently ban</button>}
                  <button onClick={() => setAction("reset")} className="btn-outline">Reset password</button>
                </div>
              ) : action === "suspend" ? (
                <div className="space-y-3">
                  <Select label="Duration" value={days} onChange={(e) => setDays(e.target.value)} options={[{ value: "1", label: "1 day" }, { value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "custom", label: "Indefinite" }]} />
                  <Textarea label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex justify-end gap-2"><button onClick={() => setAction("")} className="btn-outline">Cancel</button><button onClick={run} className="btn-danger" disabled={!reason.trim()}>Confirm Suspend</button></div>
                </div>
              ) : action === "ban" ? (
                <div className="space-y-3">
                  <Alert variant="warning">This is irreversible. Type the user's email to confirm.</Alert>
                  <Field label="Confirm email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={detail.user.email} />
                  <div className="flex justify-end gap-2"><button onClick={() => setAction("")} className="btn-outline">Cancel</button><button onClick={run} className="btn-danger" disabled={confirmEmail !== detail.user.email}>Permanently Ban</button></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert variant="info">An OTP password-reset email will be sent to {detail.user.email}.</Alert>
                  <div className="flex justify-end gap-2"><button onClick={() => setAction("")} className="btn-outline">Cancel</button><button onClick={run} className="btn-primary">Send Reset Email</button></div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
