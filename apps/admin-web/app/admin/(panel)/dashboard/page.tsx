"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Spinner } from "@/components/ui";

interface Dash {
  metrics: { totalUsers: number; totalVerifiedLawyers: number; pendingVerifications: number; activeConsultations: number };
  today: { newUsers: number; newLawyers: number; documentsProcessed: number; chatSessions: number };
  charts: { growth: { date: string; users: number; lawyers: number }[]; consultationsByCaseType: { caseType: string; count: number }[]; chatbotFeedback: { up: number; down: number } };
  alerts: { unreviewedReports: number; overdueVerifications: { userId: string; name: string; hoursWaiting: number }[]; systemHealth: { apiUptimePercent: number; apiUptimeSeconds: number; avgResponseMs: number | null; ocrPipeline: string } };
}

export default function DashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => { adminApi.get<Dash>("dashboard").then(setD).catch(() => {}); }, []);
  if (!d) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  const metricCards = [
    { label: "Registered Users", value: d.metrics.totalUsers },
    { label: "Verified Lawyers", value: d.metrics.totalVerifiedLawyers },
    { label: "Pending Verifications", value: d.metrics.pendingVerifications, alert: d.metrics.pendingVerifications > 0 },
    { label: "Active Consultations", value: d.metrics.activeConsultations },
  ];
  const fb = d.charts.chatbotFeedback;
  const fbTotal = fb.up + fb.down;
  const maxGrowth = Math.max(1, ...d.charts.growth.map((g) => g.users + g.lawyers));
  const maxCase = Math.max(1, ...d.charts.consultationsByCaseType.map((c) => c.count));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((m) => (
          <div key={m.label} className={`card p-5 ${m.alert ? "ring-2 ring-gold-300" : ""}`}>
            <p className="text-3xl font-bold text-navy-900">{m.value}</p>
            <p className="mt-1 text-sm text-navy-500">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Today's Activity</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[["New Users", d.today.newUsers], ["New Lawyers", d.today.newLawyers], ["Docs Processed", d.today.documentsProcessed], ["Chatbot Sessions", d.today.chatSessions]].map(([l, v]) => (
            <div key={l as string}><p className="text-2xl font-bold text-navy-900">{v as number}</p><p className="text-xs text-navy-500">{l as string}</p></div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-navy-900">User &amp; Lawyer Growth (30 days)</h2>
          <div className="flex h-40 items-end gap-0.5">
            {d.charts.growth.map((g, i) => (
              <div key={i} className="flex flex-1 flex-col justify-end gap-px" title={`${g.date}: ${g.users} users, ${g.lawyers} lawyers`}>
                <div className="w-full bg-gold-400" style={{ height: `${(g.lawyers / maxGrowth) * 100}%` }} />
                <div className="w-full bg-navy-700" style={{ height: `${(g.users / maxGrowth) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-navy-500"><span className="flex items-center gap-1"><span className="h-2 w-2 bg-navy-700" /> Users</span><span className="flex items-center gap-1"><span className="h-2 w-2 bg-gold-400" /> Lawyers</span></div>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-navy-900">AI Chatbot Feedback</h2>
          {fbTotal === 0 ? <p className="py-8 text-center text-sm text-navy-400">No feedback yet.</p> : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="text-green-700">👍 Thumbs up</span><span className="font-bold">{Math.round((fb.up / fbTotal) * 100)}%</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-navy-100"><div className="h-full bg-green-500" style={{ width: `${(fb.up / fbTotal) * 100}%` }} /></div>
              <div className="flex items-center justify-between text-sm"><span className="text-red-600">👎 Thumbs down</span><span className="font-bold">{Math.round((fb.down / fbTotal) * 100)}%</span></div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-navy-900">Consultation Volume by Case Type (7 days)</h2>
          {d.charts.consultationsByCaseType.length === 0 ? <p className="py-6 text-center text-sm text-navy-400">No consultations in range.</p> : (
            <div className="space-y-2">
              {d.charts.consultationsByCaseType.map((c) => (
                <div key={c.caseType} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-navy-600">{c.caseType}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-navy-100"><div className="h-full bg-navy-700" style={{ width: `${(c.count / maxCase) * 100}%` }} /></div>
                  <span className="w-6 text-right font-semibold">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-semibold text-navy-900">Alerts</h2>
            <Link href="/admin/reports" className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm">
              <span className="text-red-700">Unreviewed reports</span>
              <span className="font-bold text-red-700">{d.alerts.unreviewedReports}</span>
            </Link>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Overdue verifications (&gt;48h)</p>
            {d.alerts.overdueVerifications.length === 0 ? <p className="mt-1 text-sm text-navy-400">None.</p> : (
              <ul className="mt-1 space-y-1">
                {d.alerts.overdueVerifications.map((v) => (
                  <li key={v.userId}><Link href="/admin/verifications" className="flex justify-between text-sm hover:underline"><span className="text-navy-700">{v.name}</span><span className="text-red-600">{v.hoursWaiting}h</span></Link></li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">System Health</p>
            <ul className="mt-1 space-y-1 text-sm text-navy-600">
              <li className="flex justify-between"><span>API uptime</span><span className="text-green-600">{d.alerts.systemHealth.apiUptimePercent}% ({Math.floor(d.alerts.systemHealth.apiUptimeSeconds / 60)}m)</span></li>
              <li className="flex justify-between"><span>OCR pipeline</span><span className="text-navy-400">{d.alerts.systemHealth.ocrPipeline}</span></li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
