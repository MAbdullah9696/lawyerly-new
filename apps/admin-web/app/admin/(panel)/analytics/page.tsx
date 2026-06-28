"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Spinner, Field } from "@/components/ui";

interface Analytics {
  range: { from: string; to: string };
  userGrowth: { totalSignups: number; citizens: number; lawyers: number };
  consultations: { started: number; completed: number; active: number; avgDurationMin: number; byCaseType: { caseType: string; count: number }[] };
  chatbot: { sessions: number; aiMessages: number; thumbsUpPercent: number | null };
  documents: { processed: number; ocrSuccessRate: number | null; note: string };
  geographic: { province: string; count: number }[];
  lawyerPerformance: { name: string; reviews: number; rating: number }[];
}

function preset(days: number) { const to = new Date(); const from = new Date(Date.now() - days * 86400000); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; }

export default function AnalyticsPage() {
  const [range, setRange] = useState(preset(30));
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<Analytics>(`analytics?from=${range.from}&to=${range.to}`).then(setA).finally(() => setLoading(false));
  }, [range]);
  useEffect(load, [load]);

  function exportCsv() {
    if (!a) return;
    const lines = [
      ["Metric", "Value"],
      ["Range", `${range.from} to ${range.to}`],
      ["Total signups", a.userGrowth.totalSignups], ["Citizens", a.userGrowth.citizens], ["Lawyers", a.userGrowth.lawyers],
      ["Consultations started", a.consultations.started], ["Completed", a.consultations.completed], ["Active", a.consultations.active], ["Avg duration (min)", a.consultations.avgDurationMin],
      ["Chatbot sessions", a.chatbot.sessions], ["AI messages", a.chatbot.aiMessages], ["Thumbs up %", a.chatbot.thumbsUpPercent ?? "n/a"],
      ...a.consultations.byCaseType.map((c) => [`Case type: ${c.caseType}`, c.count]),
      ...a.geographic.map((g) => [`Province: ${g.province}`, g.count]),
      ...a.lawyerPerformance.map((l) => [`Lawyer: ${l.name}`, `${l.reviews} reviews, ${l.rating}★`]),
    ];
    const csv = lines.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "lawyerly-analytics.csv"; link.click(); URL.revokeObjectURL(url);
  }

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="card p-5"><h2 className="mb-3 font-semibold text-navy-900">{title}</h2>{children}</section>
  );
  const Stat = ({ l, v }: { l: string; v: React.ReactNode }) => (<div><p className="text-2xl font-bold text-navy-900">{v}</p><p className="text-xs text-navy-500">{l}</p></div>);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Analytics</h1>
        <div className="flex items-end gap-2">
          <div className="flex gap-1">{[7, 30, 90].map((d) => <button key={d} onClick={() => setRange(preset(d))} className="btn-outline !py-1 !text-xs">{d}d</button>)}</div>
          <Field type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Field type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          <button onClick={exportCsv} className="btn-primary !py-1.5 !text-xs" disabled={!a}>Export CSV</button>
        </div>
      </div>

      {loading || !a ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="User Growth"><div className="grid grid-cols-3 gap-4"><Stat l="Total signups" v={a.userGrowth.totalSignups} /><Stat l="Citizens" v={a.userGrowth.citizens} /><Stat l="Lawyers" v={a.userGrowth.lawyers} /></div></Card>
          <Card title="Consultations"><div className="grid grid-cols-4 gap-3"><Stat l="Started" v={a.consultations.started} /><Stat l="Completed" v={a.consultations.completed} /><Stat l="Active" v={a.consultations.active} /><Stat l="Avg min" v={a.consultations.avgDurationMin} /></div></Card>
          <Card title="Consultations by Case Type">
            {a.consultations.byCaseType.length === 0 ? <p className="text-sm text-navy-400">None.</p> : a.consultations.byCaseType.map((c) => <div key={c.caseType} className="flex justify-between border-b border-navy-50 py-1 text-sm"><span className="text-navy-600">{c.caseType}</span><span className="font-semibold">{c.count}</span></div>)}
          </Card>
          <Card title="AI Chatbot"><div className="grid grid-cols-3 gap-4"><Stat l="Sessions" v={a.chatbot.sessions} /><Stat l="AI messages" v={a.chatbot.aiMessages} /><Stat l="Thumbs up" v={a.chatbot.thumbsUpPercent === null ? "—" : `${a.chatbot.thumbsUpPercent}%`} /></div></Card>
          <Card title="Geographic Distribution">
            {a.geographic.length === 0 ? <p className="text-sm text-navy-400">No province data yet.</p> : a.geographic.map((g) => <div key={g.province} className="flex justify-between border-b border-navy-50 py-1 text-sm"><span className="text-navy-600">{g.province}</span><span className="font-semibold">{g.count}</span></div>)}
          </Card>
          <Card title="Document Analyzer"><p className="text-sm text-navy-400">{a.documents.note}</p></Card>
          <Card title="Top Lawyers (by reviews)">
            {a.lawyerPerformance.length === 0 ? <p className="text-sm text-navy-400">None.</p> : a.lawyerPerformance.map((l) => <div key={l.name} className="flex justify-between border-b border-navy-50 py-1 text-sm"><span className="text-navy-600">{l.name}</span><span className="font-semibold">{l.rating}★ · {l.reviews}</span></div>)}
          </Card>
        </div>
      )}
    </div>
  );
}
