import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

const TEAM = [
  "Ahmad Sajjad",
  "Bilal Khan",
  "Ubada Aleem",
  "Hafiz Muhammad Abdullah Mazhar Bhatti",
];

export default function AboutPage() {
  return (
    <article>
      <header className="bg-navy-950 py-16 text-white">
        <div className="container-page max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-400">About Lawyerly</p>
          <h1 className="mt-2 text-4xl font-bold">Access to legal help, for everyone in Pakistan</h1>
        </div>
      </header>

      <div className="container-page max-w-3xl space-y-12 py-16 text-navy-700">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-navy-900">Our Mission</h2>
          <p>
            Legal help in Pakistan is often hard to find, hard to afford, and hard to understand. Lawyerly
            exists to change that. We combine instant AI-powered preliminary guidance with a marketplace of
            verified, Bar Council–certified lawyers, so every citizen can understand their situation and
            connect with the right professional — all in plain English.
          </p>
          <p>
            We are clear about one thing above all: our AI provides preliminary information, never legal
            advice. For your specific case, a licensed lawyer is always the right next step.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-navy-900">Bar Council Partnership &amp; Verification</h2>
          <p>
            Trust is the foundation of legal services. Before any lawyer can take a case on Lawyerly, our team
            verifies their Bar Council enrollment number, CNIC, and law degree against their submitted
            documents. Lawyers display a “Verified by Lawyerly” badge only after this review is complete, and
            every Bar Council number is unique to a single verified account.
          </p>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-bold text-navy-900">The Team</h2>
          <p>
            Lawyerly is a Final Year Project at the University of Management and Technology (UMT), built by:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEAM.map((name) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 font-serif text-gold-400">
                  {name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <span className="font-medium text-navy-900">{name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
