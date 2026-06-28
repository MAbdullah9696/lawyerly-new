"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Spinner, Field } from "@/components/ui";

interface Entry { id: string; adminUsername: string; actionType: string; targetId: string | null; details: unknown; createdAt: string }
interface Result { items: Entry[]; total: number; page: number; totalPages: number }

export default function AuditLogPage() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (q) p.set("q", q); if (from) p.set("from", from); if (to) p.set("to", to);
    adminApi.get<Result>(`audit-log?${p}`).then(setData).finally(() => setLoading(false));
  }, [q, from, to, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => setPage(1), [q, from, to]);

  function exportCsv() {
    if (!data) return;
    const lines = [["Timestamp", "Admin", "Action", "Target", "Details"], ...data.items.map((e) => [new Date(e.createdAt).toISOString(), e.adminUsername, e.actionType, e.targetId ?? "", JSON.stringify(e.details).replace(/,/g, ";")])];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "lawyerly-audit-log.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Audit Log</h1>
          <p className="text-sm text-navy-500">Append-only · {data?.total ?? 0} entries</p>
        </div>
        <button onClick={exportCsv} className="btn-primary !py-1.5 !text-xs" disabled={!data}>Export CSV</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field placeholder="Search admin / action / target…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Field type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : !data || data.items.length === 0 ? <p className="py-16 text-center text-sm text-navy-400">No audit entries.</p> : (
        <>
          <div className="mt-4 overflow-x-auto card">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400"><th className="p-3">Time</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr></thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-b border-navy-50">
                    <td className="whitespace-nowrap p-3 text-navy-500">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium text-navy-900">{e.adminUsername}</td>
                    <td className="p-3"><span className="chip bg-navy-50 text-navy-700">{e.actionType}</span></td>
                    <td className="p-3 font-mono text-xs text-navy-500">{e.targetId ? e.targetId.slice(0, 8) + "…" : "—"}</td>
                    <td className="max-w-xs truncate p-3 text-xs text-navy-500">{JSON.stringify(e.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-outline disabled:opacity-40">Prev</button>
              <span className="text-sm text-navy-500">Page {data.page} of {data.totalPages}</span>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-outline disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
