"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, ApiRequestError } from "@/lib/api";
import { useAdmin, can } from "@/lib/auth-context";
import { Spinner, Modal, Chip, StatTone, Alert, Select, Textarea } from "@/components/ui";

interface Row { id: string; reporter: string; reportedParty: string; type: string; reasonCategory: string; priority: string; status: string; createdAt: string }
interface Detail { id: string; type: string; reasonCategory: string; reasonText: string; priority: string; status: string; resolutionNote: string | null; createdAt: string; reporter: { fullName: string; email: string }; reportedParty: { id: string; fullName: string; email: string; status: string } }

export default function ReportsPage() {
  const { admin } = useAdmin();
  const writable = can.write(admin?.role);
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [action, setAction] = useState("dismiss");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ status, priority, type });
    adminApi.get<{ items: Row[] }>(`reports?${p}`).then((r) => setRows(r.items)).finally(() => setLoading(false));
  }, [status, priority, type]);
  useEffect(load, [load]);

  async function open(id: string) { setErr(""); setAction("dismiss"); setNote(""); setDetail(await adminApi.get<Detail>(`reports/${id}`)); }
  async function resolve() {
    if (!detail) return;
    setErr("");
    try { await adminApi.post(`reports/${detail.id}/resolve`, { action, resolutionNote: note }); setDetail(null); load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed."); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900">Reports &amp; Moderation</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "all", label: "All" }]} />
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} options={[{ value: "all", label: "All priorities" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
        <Select value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "all", label: "All types" }, { value: "conversation", label: "Conversation" }, { value: "profile", label: "Profile" }, { value: "review", label: "Review" }]} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="mt-4 overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400"><th className="p-3">Reporter</th><th className="p-3">Reported</th><th className="p-3">Type</th><th className="p-3">Reason</th><th className="p-3">Priority</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-navy-50 hover:bg-navy-50/50" onClick={() => open(r.id)}>
                  <td className="p-3 text-navy-700">{r.reporter}</td>
                  <td className="p-3 font-medium text-navy-900">{r.reportedParty}</td>
                  <td className="p-3 capitalize text-navy-600">{r.type}</td>
                  <td className="p-3 text-navy-600">{r.reasonCategory}</td>
                  <td className="p-3"><Chip tone={StatTone(r.priority)}>{r.priority}</Chip></td>
                  <td className="p-3"><Chip tone={StatTone(r.status)}>{r.status}</Chip></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-navy-400">No reports.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal title="Report detail" onClose={() => setDetail(null)}>
          {err && <div className="mb-3"><Alert variant="error">{err}</Alert></div>}
          <div className="space-y-2 text-sm">
            <p><span className="text-navy-400">Type:</span> {detail.type} · <Chip tone={StatTone(detail.priority)}>{detail.priority}</Chip></p>
            <p><span className="text-navy-400">Reporter:</span> {detail.reporter.fullName}</p>
            <p><span className="text-navy-400">Reported:</span> {detail.reportedParty.fullName} (<Chip tone={StatTone(detail.reportedParty.status)}>{detail.reportedParty.status}</Chip>)</p>
            <p><span className="text-navy-400">Category:</span> {detail.reasonCategory}</p>
            <div className="rounded-lg bg-navy-50 p-3 text-navy-700">{detail.reasonText}</div>
          </div>

          {detail.status === "resolved" ? (
            <div className="mt-4"><Alert variant="success">Resolved. {detail.resolutionNote}</Alert></div>
          ) : writable ? (
            <div className="mt-4 space-y-3 border-t border-navy-100 pt-4">
              <Select label="Action" value={action} onChange={(e) => setAction(e.target.value)} options={[
                { value: "dismiss", label: "Dismiss" }, { value: "warn", label: "Warn user" },
                { value: "suspend", label: "Suspend reported party (7d)" }, { value: "ban", label: "Permanently ban" }, { value: "remove_content", label: "Remove content" },
              ]} />
              <Textarea label="Resolution note (min 20 chars)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex justify-end gap-2"><button onClick={() => setDetail(null)} className="btn-outline">Cancel</button><button onClick={resolve} className="btn-primary" disabled={note.trim().length < 20}>Resolve</button></div>
            </div>
          ) : <p className="mt-4 text-sm text-navy-400">Analysts have read-only access.</p>}
        </Modal>
      )}
    </div>
  );
}
