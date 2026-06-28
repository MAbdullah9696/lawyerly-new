"use client";

import { useEffect, useState } from "react";
import { lawyerApi } from "@/lib/api";
import { Spinner, Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import type { LawyerEarnings } from "@/lib/types";

const METHOD_TYPES = ["bank", "easypaisa", "jazzcash"];

export default function LawyerEarningsPage() {
  const [data, setData] = useState<LawyerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // add-method form
  const [mtype, setMtype] = useState("easypaisa");
  const [iban, setIban] = useState("");
  const [title, setTitle] = useState("");
  const [mobile, setMobile] = useState("");

  function load() {
    setLoading(true);
    lawyerApi.earnings().then(setData).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addMethod(e: React.FormEvent) {
    e.preventDefault();
    const details: Record<string, string> = mtype === "bank" ? { iban, title } : { mobile };
    await lawyerApi.addMethod({ type: mtype, details, isDefault: true });
    setAddOpen(false); setIban(""); setTitle(""); setMobile("");
    load();
  }

  async function requestPayout() {
    setErr(""); setMsg("");
    try {
      const r = await lawyerApi.requestPayout();
      setMsg(`Payout of PKR ${r.amountPkr.toLocaleString()} requested. Processed within 3–5 business days.`);
      load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not request payout.");
    }
  }

  function downloadCsv() {
    if (!data) return;
    const rows = [
      ["Consultation ID", "Date", "Client", "Fee PKR", "Platform Fee %", "Net Earned PKR", "Status"],
      ...data.transactions.map((t) => [t.consultationId, new Date(t.date).toLocaleDateString(), t.client, t.feePkr, t.platformFeePercent, t.netEarnedPkr, t.status]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "lawyerly-transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !data) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  const s = data.summary;
  const maxBar = Math.max(1, ...data.chart.map((c) => c.total));
  const cards = [
    { label: "This Month", v: s.thisMonth },
    { label: "Last Month", v: s.lastMonth },
    { label: "All-Time Total", v: s.allTime },
    { label: "Pending Payout", v: s.pendingPayout },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold text-navy-900">Earnings</h1>

      {msg && <Alert variant="success">{msg}</Alert>}
      {err && <Alert variant="error">{err}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
            <p className="text-sm text-navy-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-navy-900">PKR {c.v.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
        <h2 className="font-semibold text-navy-900">Last 12 Months</h2>
        <div className="mt-5 flex h-44 items-end gap-2">
          {data.chart.map((c) => (
            <div key={c.month} className="group flex flex-1 flex-col items-center gap-1.5">
              <div className="relative flex w-full flex-1 items-end">
                <div className="w-full rounded-t bg-navy-900 transition group-hover:bg-gold-500" style={{ height: `${(c.total / maxBar) * 100}%`, minHeight: c.total > 0 ? "4px" : "0" }} title={`PKR ${c.total.toLocaleString()}`} />
              </div>
              <span className="text-[10px] text-navy-400">{c.month.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Transactions */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Transaction Log</h2>
          <Button variant="outline" className="!py-1.5 !text-sm" onClick={downloadCsv} disabled={data.transactions.length === 0}>Download CSV</Button>
        </div>
        {data.transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-navy-400">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
                  <th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Client</th><th className="py-2 pr-4">Fee</th><th className="py-2 pr-4">Platform %</th><th className="py-2 pr-4">Net</th><th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-navy-50">
                    <td className="py-2.5 pr-4 text-navy-600">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 text-navy-600">{t.client}</td>
                    <td className="py-2.5 pr-4 text-navy-800">PKR {t.feePkr.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-navy-600">{t.platformFeePercent}%</td>
                    <td className="py-2.5 pr-4 font-semibold text-navy-900">PKR {t.netEarnedPkr.toLocaleString()}</td>
                    <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.status === "paid" ? "bg-green-50 text-green-700" : "bg-gold-50 text-gold-800"}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payouts */}
      <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
        <h2 className="font-semibold text-navy-900">Payout Settings</h2>
        <div className="mt-4 space-y-2">
          {data.methods.length === 0 ? (
            <p className="text-sm text-navy-400">No payout method added yet.</p>
          ) : (
            data.methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-navy-100 px-3 py-2 text-sm">
                <span className="capitalize text-navy-800">{m.type} · {Object.values(m.details).join(" · ")}</span>
                {m.isDefault && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">Default</span>}
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddOpen((o) => !o)}>{addOpen ? "Cancel" : "Add payout method"}</Button>
          <Button onClick={requestPayout} disabled={s.pendingPayout < 1000 || data.methods.length === 0}>
            Request Payout {s.pendingPayout < 1000 && "(min PKR 1,000)"}
          </Button>
        </div>

        {addOpen && (
          <form onSubmit={addMethod} className="mt-4 space-y-3 rounded-xl border border-navy-100 p-4">
            <Select label="Method type" options={METHOD_TYPES} value={mtype} onChange={(e) => setMtype(e.target.value)} />
            {mtype === "bank" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} required />
                <Input label="Account title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
            ) : (
              <Input label="Mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="03XXXXXXXXX" required />
            )}
            <Button type="submit" className="!py-1.5 !text-sm">Save method</Button>
          </form>
        )}

        {data.payouts.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Payout history</p>
            <ul className="mt-2 divide-y divide-navy-100">
              {data.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-navy-700">PKR {p.amountPkr.toLocaleString()} · {p.method ?? "—"}</span>
                  <span className="text-xs text-navy-400">{p.status} · {new Date(p.requestedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
