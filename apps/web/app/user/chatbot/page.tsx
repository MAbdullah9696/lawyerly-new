"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { chatApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { timeAgo } from "@/components/user/widgets";
import type { ChatMessage, ChatSessionSummary } from "@/lib/types";

const DISCLAIMER = "This is not legal advice. Consult a licensed lawyer for your specific case.";
const STARTERS = [
  "What are my tenant rights?",
  "How do I file for divorce in Pakistan?",
  "What is Section 302 PPC?",
];

interface UiMessage extends Omit<ChatMessage, "createdAt"> {
  createdAt: string;
  practiceArea?: string;
}

function groupSessions(sessions: ChatSessionSummary[]) {
  const now = Date.now();
  const buckets: Record<string, ChatSessionSummary[]> = { Today: [], Yesterday: [], "Last 7 Days": [], Older: [] };
  for (const s of sessions) {
    const days = Math.floor((now - new Date(s.createdAt).getTime()) / 86400000);
    if (days < 1) buckets["Today"].push(s);
    else if (days < 2) buckets["Yesterday"].push(s);
    else if (days < 7) buckets["Last 7 Days"].push(s);
    else buckets["Older"].push(s);
  }
  return Object.entries(buckets).filter(([, v]) => v.length > 0);
}

function ChatbotInner() {
  const params = useSearchParams();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatApi.sessions().then((r) => setSessions(r.sessions)).catch(() => {});
    const sid = params.get("session");
    if (sid) openSession(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function openSession(id: string) {
    setSessionId(id);
    setError("");
    try {
      const r = await chatApi.messages(id);
      setMessages(r.messages.map((m) => ({ ...m })));
    } catch {
      setError("Could not load this conversation.");
    }
  }

  function newChat() {
    setSessionId(null);
    setMessages([]);
    setError("");
    setInput("");
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setError("");
    setInput("");
    // Optimistic user bubble
    const tempId = `temp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, sender: "user", text: message, citations: [], createdAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await chatApi.send({ sessionId: sessionId ?? undefined, message });
      setSessionId(res.sessionId);
      setMessages((m) => [
        ...m.filter((x) => x.id !== tempId),
        { id: res.userMessage.id, sender: "user", text: res.userMessage.text, citations: [], createdAt: res.userMessage.createdAt },
        { id: res.aiMessage.id, sender: "ai", text: res.aiMessage.text, citations: res.aiMessage.citations, createdAt: res.aiMessage.createdAt, practiceArea: res.practiceArea },
      ]);
      // refresh session list (new session / title)
      chatApi.sessions().then((r) => setSessions(r.sessions)).catch(() => {});
    } catch (e) {
      // Keep the user's typed message visible; show a non-destructive error (§14).
      setError("Our AI assistant is temporarily unavailable. Your message was saved — please try again.");
    } finally {
      setSending(false);
    }
  }

  async function setFeedback(id: string, feedback: "up" | "down") {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, feedback: x.feedback === feedback ? null : feedback } : x)));
    try {
      await chatApi.feedback(id, feedback);
    } catch {
      /* ignore */
    }
  }

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const grouped = groupSessions(sessions);

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-6xl gap-4">
      {/* Session list */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-navy-100 bg-white md:flex">
        <div className="p-3">
          <button onClick={newChat} className="btn-primary w-full">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {grouped.length === 0 ? (
            <p className="px-2 py-4 text-xs text-navy-400">No conversations yet.</p>
          ) : (
            grouped.map(([label, items]) => (
              <div key={label} className="mb-3">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-navy-400">{label}</p>
                {items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSession(s.id)}
                    className={clsx(
                      "block w-full truncate rounded-lg px-2 py-2 text-left text-sm",
                      s.id === sessionId ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-navy-50",
                    )}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-navy-100 bg-white">
        <div className="border-b border-navy-100 px-5 py-3">
          <h1 className="font-semibold text-navy-900">AI Legal Assistant</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gold-700">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 5a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V7Zm-1 7.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" /></svg>
            {DISCLAIMER}
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 && !sending ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900 text-gold-400">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10h8M8 14h5M21 12a9 9 0 0 1-13 8l-4 1 1-4a9 9 0 1 1 16-5Z" /></svg>
              </span>
              <h2 className="mt-4 text-lg font-semibold text-navy-900">How can I help with your legal question?</h2>
              <p className="mt-1 max-w-sm text-sm text-navy-500">Ask in plain English. I provide preliminary information, not legal advice.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-sm text-navy-700 hover:border-navy-400">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) =>
              m.sender === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-navy-900 px-4 py-2.5 text-sm text-white">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-navy-50 px-4 py-2.5 text-sm text-navy-800">{m.text}</div>
                    {m.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.citations.map((c) => (
                          <span key={c} className="rounded bg-navy-900/5 px-2 py-0.5 text-xs font-medium text-navy-600">{c}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-navy-400">
                      <button onClick={() => setFeedback(m.id, "up")} className={clsx("hover:text-navy-700", m.feedback === "up" && "text-green-600")} aria-label="Helpful">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 11v9H4v-9h3Zm0 0 4-8a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.4l-1.5 6A2 2 0 0 1 16.5 20H7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button onClick={() => setFeedback(m.id, "down")} className={clsx("hover:text-navy-700", m.feedback === "down" && "text-red-600")} aria-label="Not helpful">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 11v9H4v-9h3Zm0 0 4-8a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.4l-1.5 6A2 2 0 0 1 16.5 20H7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <button onClick={() => copy(m.id, m.text)} className="hover:text-navy-700" aria-label="Copy">
                        {copied === m.id ? (
                          <span className="text-xs font-medium text-green-600">Copied</span>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 9h10v10H9V9Zm0 0V5h10M5 5v10h2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                      </button>
                    </div>
                    <Link
                      href={`/user/find-lawyer${m.practiceArea && m.practiceArea !== "General" ? `?practiceArea=${encodeURIComponent(m.practiceArea)}` : ""}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-navy-900"
                    >
                      Connect with a lawyer about this
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  </div>
                </div>
              ),
            )
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-navy-50 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-typing-dot rounded-full bg-navy-400" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <div className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-navy-100 p-3"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={1}
                placeholder="Ask a legal question…"
                className="field-input max-h-32 min-h-[44px] resize-none"
              />
              <div className="mt-1 text-right text-xs text-navy-400">{input.length}/1000</div>
            </div>
            <button type="submit" disabled={!input.trim() || sending} className="btn-primary mb-6 h-11 w-11 !px-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <ChatbotInner />
    </Suspense>
  );
}
