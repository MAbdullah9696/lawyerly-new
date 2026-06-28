"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/** Hero CTAs: route to the real destination when logged in, else to /register (§6). */
export function HomeCtas() {
  const { user } = useAuth();
  const findHref = user ? "/user/find-lawyer" : "/register";
  const chatHref = user ? "/user/chatbot" : "/register";
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href={findHref} className="btn-gold px-6 py-3 text-base">
        Find a Lawyer
      </Link>
      <Link
        href={chatHref}
        className="btn px-6 py-3 text-base border border-white/30 bg-white/5 text-white hover:bg-white/10 focus:ring-white/40"
      >
        Ask the AI Chatbot
      </Link>
    </div>
  );
}
