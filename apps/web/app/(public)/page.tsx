import Link from "next/link";
import { HomeCtas } from "@/components/HomeCtas";

const FEATURES = [
  {
    title: "AI Legal Chatbot",
    desc: "Ask questions in plain English and get instant preliminary guidance on Pakistani law, 24/7.",
    icon: "M8 10h8M8 14h5M21 12a9 9 0 1 1-3.5-7.1L21 4v5h-5",
  },
  {
    title: "Document Analysis",
    desc: "Upload a legal document and get an OCR + AI summary with key parties, dates, and sections highlighted.",
    icon: "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6M9 17h6",
  },
  {
    title: "Secure Chat",
    desc: "Consult lawyers over end-to-end encrypted, in-app messaging with delivery and read receipts.",
    icon: "M12 3a9 9 0 0 0-9 9 9 9 0 0 0 1.3 4.6L3 21l4.6-1.3A9 9 0 1 0 12 3Z",
  },
  {
    title: "Verified Lawyers",
    desc: "Every lawyer is checked against Bar Council enrollment and CNIC before they can take cases.",
    icon: "m9 12 2 2 4-4M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z",
  },
];

const STEPS = [
  { n: "01", title: "Register", desc: "Create a free citizen account in under a minute and verify your email." },
  { n: "02", title: "Find a Lawyer", desc: "Search verified lawyers by practice area, city, language, fee, and rating." },
  { n: "03", title: "Get Guidance", desc: "Chat with the AI for instant help, or consult a lawyer securely in-app." },
];

const TESTIMONIALS = [
  {
    quote:
      "I understood my tenancy rights in minutes with the AI, then booked a property lawyer the same day. The whole process felt safe and clear.",
    name: "Ayesha R.",
    role: "Citizen · Karachi",
  },
  {
    quote:
      "Verification was thorough and fast. Lawyerly sends me serious clients and the in-app chat keeps everything in one professional place.",
    name: "Adv. Bilal Ahmed",
    role: "Family Lawyer · Lahore",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="container-page relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-300">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Bar Council–verified lawyers
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Get Legal Guidance <span className="text-gold-400">Instantly</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-200">
              Lawyerly connects you with verified Pakistani lawyers and instant AI guidance — so you
              always know your next step, whatever your legal question.
            </p>
            <div className="mt-8">
              <HomeCtas />
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-card-lg backdrop-blur">
              <div className="rounded-xl bg-white p-5 text-navy-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">AI Assistant</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-navy-900 px-4 py-2 text-white">
                    What are my tenant rights in Punjab?
                  </div>
                  <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-sm bg-navy-50 px-4 py-2">
                    Under the Punjab Rented Premises Act 2009, a landlord must provide notice before
                    eviction…
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded bg-navy-900/5 px-2 py-0.5 text-xs font-medium text-navy-600">Punjab Rented Premises Act 2009</span>
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 px-1 text-center text-xs text-navy-300">
                This is not legal advice. Consult a licensed lawyer for your specific case.
              </p>
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="border-t border-white/10 bg-navy-950">
          <div className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-5 text-sm font-medium text-navy-200">
            <span><b className="text-gold-400">500+</b> Verified Lawyers</span>
            <span className="hidden text-navy-700 sm:inline">·</span>
            <span><b className="text-gold-400">10,000+</b> Cases Helped</span>
            <span className="hidden text-navy-700 sm:inline">·</span>
            <span><b className="text-gold-400">Bar Council</b> Certified</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl">Everything you need to act with confidence</h2>
          <p className="mt-4 text-navy-500">Four tools, one platform — built for the Pakistani legal context.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-navy-100 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-card-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-gold-400 transition group-hover:bg-navy-800">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.icon} />
                </svg>
              </span>
              <h3 className="mt-5 text-lg font-semibold text-navy-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-navy-50 py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl">How It Works</h2>
            <p className="mt-4 text-navy-500">From question to qualified help in three steps.</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="rounded-2xl border border-navy-100 bg-white p-7 shadow-card">
                  <span className="font-serif text-4xl font-bold text-gold-400">{s.n}</span>
                  <h3 className="mt-3 text-xl font-semibold text-navy-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-navy-500">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-navy-300 md:block">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-page py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl">Trusted by clients and lawyers</h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-navy-100 bg-white p-7 shadow-card">
              <div className="text-gold-400" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor"><path d="M7 7h4v4c0 3-1.5 5-4 6v-2c1.2-.6 2-1.7 2-3H7V7Zm8 0h4v4c0 3-1.5 5-4 6v-2c1.2-.6 2-1.7 2-3h-2V7Z" /></svg>
              </div>
              <blockquote className="mt-3 text-navy-700">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-navy-900">{t.name}</span>
                <span className="block text-navy-400">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-navy-900">
        <div className="container-page flex flex-col items-center gap-6 py-16 text-center">
          <h2 className="max-w-2xl text-3xl font-bold text-white sm:text-4xl">Your legal question deserves a clear answer.</h2>
          <Link href="/register" className="btn-gold px-7 py-3 text-base">Get Started — It’s Free</Link>
        </div>
      </section>
    </>
  );
}
