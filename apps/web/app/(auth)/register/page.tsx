"use client";

import Link from "next/link";
import { useState } from "react";
import { CitizenRegister } from "@/components/auth/CitizenRegister";
import { LawyerRegister } from "@/components/auth/LawyerRegister";

type Role = "citizen" | "lawyer" | null;

const ROLES = [
  {
    key: "citizen" as const,
    title: "I am a Citizen",
    desc: "Get instant AI legal guidance and consult verified lawyers.",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  },
  {
    key: "lawyer" as const,
    title: "I am a Lawyer",
    desc: "Join the marketplace, take consultations, and grow your practice.",
    icon: "M3 21h18M6 21V8l6-4 6 4v13M9 21v-5h6v5",
  },
];

export default function RegisterPage() {
  const [role, setRole] = useState<Role>(null);

  if (role === "citizen") return <CitizenRegister onBack={() => setRole(null)} />;
  if (role === "lawyer") return <LawyerRegister onBack={() => setRole(null)} />;

  return (
    <div className="w-full max-w-2xl">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-navy-900">Create your account</h1>
        <p className="mt-2 text-navy-500">How will you be using Lawyerly?</p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {ROLES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRole(r.key)}
            className="group rounded-2xl border border-navy-100 bg-white p-7 text-left shadow-card transition hover:-translate-y-1 hover:border-navy-300 hover:shadow-card-lg"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy-900 text-gold-400 transition group-hover:bg-navy-800">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={r.icon} />
              </svg>
            </span>
            <h2 className="mt-5 text-xl font-bold text-navy-900">{r.title}</h2>
            <p className="mt-2 text-sm text-navy-500">{r.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy-700 group-hover:text-navy-900">
              Continue
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-navy-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy-900 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
