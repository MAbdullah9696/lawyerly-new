"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Spinner, Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { lawyerApi } from "@/lib/api";
import type { LawyerOwnProfile } from "@/lib/types";

const DOC_LABELS: Record<string, string> = {
  bar_council_cert: "Bar Council Certificate",
  cnic_front: "CNIC (Front)",
  cnic_back: "CNIC (Back)",
  law_degree: "Law Degree Certificate",
  profile_photo: "Profile Photo",
};

const DOC_STATUS = {
  submitted: { label: "Submitted", cls: "text-navy-500 bg-navy-50", icon: "M12 8v4l3 2" },
  verified: { label: "Verified", cls: "text-green-700 bg-green-50", icon: "M5 12l4 4L19 7" },
  issue_found: { label: "Issue Found", cls: "text-red-700 bg-red-50", icon: "M12 9v4m0 4h.01" },
};

const FAQ = [
  { q: "How long does verification take?", a: "Our team typically reviews applications within 48 hours of submission." },
  { q: "What happens if a document has an issue?", a: "You'll see an “Issue Found” note explaining what to fix, and you can re-upload that document." },
  { q: "Can I edit my details while pending?", a: "Yes — you can update your professional details (bio, practice areas, fee) any time before approval." },
  { q: "Will I be notified of the decision?", a: "Yes, we email you as soon as your application is approved or if we need anything further." },
];

export default function LawyerPendingPage() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<LawyerOwnProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lawyerApi.profile().then((r) => setProfile(r.profile)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-navy-50">
      <header className="border-b border-navy-100 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <button onClick={() => logout()} className="text-sm font-semibold text-navy-600 hover:text-navy-900">Log Out</button>
        </div>
      </header>

      <main className="container-page max-w-3xl flex-1 py-10">
        {loading || !profile ? (
          <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-navy-900">Application Under Review</h1>
                  <p className="mt-1 text-sm text-navy-600">
                    Submitted {new Date(profile.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gold-800">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gold-500" /> Under Review
                </span>
              </div>
              <p className="mt-3 text-sm text-navy-700">
                Thank you for applying to Lawyerly. Our team reviews applications within <b>48 hours</b>. We'll email you as soon as a decision is made.
              </p>
            </div>

            <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
              <h2 className="font-semibold text-navy-900">Your Documents</h2>
              <ul className="mt-4 space-y-3">
                {profile.documents.map((d) => {
                  const s = DOC_STATUS[d.status];
                  return (
                    <li key={d.id} className="rounded-xl border border-navy-100 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-navy-800">{DOC_LABELS[d.docType] ?? d.docType}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d={s.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
                          {s.label}
                        </span>
                      </div>
                      {d.status === "issue_found" && d.issueNote && (
                        <div className="mt-3">
                          <Alert variant="error">{d.issueNote}</Alert>
                          <label className="btn-outline mt-3 inline-flex cursor-pointer text-xs">
                            Re-upload document
                            <input type="file" className="hidden" />
                          </label>
                          <p className="mt-1 text-xs text-navy-400">Document re-upload is finalised in the storage milestone.</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="flex justify-center">
              <Button variant="outline" onClick={() => alert("Editing professional details while pending is available in the profile editor (coming in this milestone's portal).")}>
                Update Professional Details
              </Button>
            </div>

            <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
              <h2 className="font-semibold text-navy-900">Frequently Asked Questions</h2>
              <dl className="mt-4 space-y-4">
                {FAQ.map((f) => (
                  <div key={f.q}>
                    <dt className="text-sm font-semibold text-navy-800">{f.q}</dt>
                    <dd className="mt-1 text-sm text-navy-600">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
