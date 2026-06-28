import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

const SECTIONS = [
  {
    h: "1. Data We Collect",
    p: "Account details (name, email, phone), and for lawyers, professional information and verification documents (Bar Council certificate, CNIC, law degree). We also store consultation messages, AI chat history, uploaded documents, and reviews you create.",
  },
  {
    h: "2. How We Use Your Data",
    p: "To operate the platform: authenticate you, verify lawyers, deliver consultations and notifications, analyse documents, and improve service quality. We never sell your personal data.",
  },
  {
    h: "3. Sensitive Data & Encryption",
    p: "Passwords are hashed (bcrypt). CNIC numbers are stored encrypted and shown only in masked form to administrators. Documents are stored in encrypted object storage and served through short-lived, expiring links. Chat messages are encrypted at rest.",
  },
  {
    h: "4. Document Processing",
    p: "When you upload a document for analysis, it is processed by OCR and AI to extract a summary and key entities. The raw extracted text is deleted after analysis — only the structured results are retained.",
  },
  {
    h: "5. Data Retention & Your Rights",
    p: "You may download your data (chat history, documents, profile) or delete your account. Account deletion is permanent after a 30-day grace period. Administrative audit logs are retained for at least two years.",
  },
  {
    h: "6. Third-Party Sharing",
    p: "We share data only as needed to run the service (e.g. email delivery, payment/payout processing) and as required by law. Your email is never shown to other users or lawyers — only your first name appears in chats.",
  },
];

export default function PrivacyPage() {
  return (
    <article>
      <header className="bg-navy-950 py-16 text-white">
        <div className="container-page max-w-3xl">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-navy-300">Last updated: {new Date().getFullYear()}</p>
        </div>
      </header>
      <div className="container-page max-w-3xl space-y-8 py-16">
        {/* PECA 2016 compliance note */}
        <aside className="rounded-xl border border-gold-200 bg-gold-50 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-gold-800">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor"><path d="M10 1 3 4v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V4l-7-3Z" /></svg>
            PECA 2016 Compliance
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gold-900">
            Lawyerly handles personal data in line with the Prevention of Electronic Crimes Act 2016 (PECA).
            We apply lawful data-handling practices, maintain breach-notification procedures, and cooperate
            with law-enforcement requests where legally required, while protecting your data against
            unauthorised access.
          </p>
        </aside>

        {SECTIONS.map((s) => (
          <section key={s.h} className="space-y-2">
            <h2 className="text-xl font-bold text-navy-900">{s.h}</h2>
            <p className="leading-relaxed text-navy-700">{s.p}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
