import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

const SECTIONS = [
  {
    h: "1. Acceptance of Terms",
    p: "By creating an account or using Lawyerly, you agree to these Terms of Service and our Privacy Policy. If you do not agree, you may not use the platform.",
  },
  {
    h: "2. Nature of the Service",
    p: "Lawyerly provides (a) AI-generated preliminary legal information, (b) document analysis tools, and (c) a marketplace to discover and consult verified lawyers. AI output is for informational purposes only and does not constitute legal advice or create a lawyer–client relationship.",
  },
  {
    h: "3. Eligibility & Accounts",
    p: "You must provide accurate information and keep your credentials secure. Lawyers must submit valid Bar Council enrollment, CNIC, and degree documents and remain in “Pending Verification” until approved by an administrator.",
  },
  {
    h: "4. Consultations & Fees",
    p: "Consultation fees are set by individual lawyers in PKR and shown before you begin. Lawyerly may deduct a platform fee from lawyer earnings, disclosed at registration and on the earnings dashboard.",
  },
  {
    h: "5. Acceptable Use",
    p: "You agree not to misuse the platform, submit unlawful content, impersonate others, or attempt to circumvent verification, security, or rate-limiting controls. Reported violations may lead to suspension or a permanent ban.",
  },
  {
    h: "6. Reviews & Content",
    p: "Reviews must reflect genuine experiences. Lawyerly may remove reviews that are fraudulent, abusive, or violate these terms, and will note when reviews are removed by moderators.",
  },
  {
    h: "7. Disclaimers & Limitation of Liability",
    p: "The platform is provided “as is.” Lawyerly is not liable for the outcome of any matter, for AI-generated information, or for the conduct of independent lawyers using the marketplace.",
  },
  {
    h: "8. Changes to These Terms",
    p: "We may update these Terms from time to time. Continued use after changes take effect constitutes acceptance of the revised Terms.",
  },
];

export default function TermsPage() {
  return (
    <article>
      <header className="bg-navy-950 py-16 text-white">
        <div className="container-page max-w-3xl">
          <h1 className="text-4xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-navy-300">Last updated: {new Date().getFullYear()}</p>
        </div>
      </header>
      <div className="container-page max-w-3xl space-y-8 py-16">
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
