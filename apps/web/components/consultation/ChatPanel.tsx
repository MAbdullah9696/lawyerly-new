"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { consultationsApi, getAccessToken, setAccessToken } from "@/lib/api";
import type { ChatMessageDTO } from "@/lib/types";

const CORE = process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4000";

function time(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Ticks({ status }: { status: ChatMessageDTO["deliveryStatus"] }) {
  // single = sent, double = delivered, blue double = read
  if (status === "sent") {
    return <svg viewBox="0 0 16 11" className="h-3.5 w-3.5 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 6l3.5 3.5L11 3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }
  const color = status === "read" ? "text-sky-300" : "text-white/70";
  return (
    <svg viewBox="0 0 18 11" className={`h-3.5 w-3.5 ${color}`} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 6l3 3L9.5 3M7 9l.5.5L14 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatPanel({
  consultationId,
  currentUserId,
  status,
  otherPartyName,
  onAttach,
  onClosedRemotely,
}: {
  consultationId: string;
  currentUserId: string;
  status: "active" | "closed";
  otherPartyName: string;
  onAttach?: () => void;
  onClosedRemotely?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [input, setInput] = useState("");
  const [typingOther, setTypingOther] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const socket = io(CORE, {
      auth: (cb) => cb({ token: getAccessToken() ?? "" }),
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_consultation", { consultationId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", async (err: Error) => {
      if (err.message === "unauthorized" && !refreshedOnce.current) {
        refreshedOnce.current = true;
        try {
          const r = await fetch("/api/auth/refresh", { method: "POST" });
          if (r.ok) { const { accessToken } = await r.json(); setAccessToken(accessToken); socket.connect(); }
        } catch { /* ignore */ }
      }
    });
    socket.on("message", (m: ChatMessageDTO) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.senderId !== currentUserId && document.hasFocus()) socket.emit("message_read", { consultationId });
    });
    socket.on("receipt", ({ messageIds, status }: { messageIds: string[]; status: ChatMessageDTO["deliveryStatus"] }) => {
      setMessages((prev) => prev.map((x) => (messageIds.includes(x.id) ? { ...x, deliveryStatus: status } : x)));
    });
    socket.on("typing", ({ userId, typing }: { userId: string; typing: boolean }) => {
      if (userId !== currentUserId) setTypingOther(typing);
    });
    socket.on("consultation_closed", () => onClosedRemotely?.());

    consultationsApi
      .messages(consultationId)
      .then((r) => { if (!cancelled) { setMessages(r.messages); socket.emit("message_read", { consultationId }); } })
      .catch(() => {});

    return () => {
      cancelled = true;
      socket.emit("leave_consultation", { consultationId });
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, currentUserId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingOther]);

  function emitTyping() {
    const s = socketRef.current;
    if (!s) return;
    s.emit("typing_start", { consultationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => s.emit("typing_stop", { consultationId }), 1500);
  }

  async function send() {
    const text = input.trim();
    if (!text || status !== "active") return;
    setInput("");
    const s = socketRef.current;
    s?.emit("typing_stop", { consultationId });
    if (s?.connected) {
      s.emit("send_message", { consultationId, text });
    } else {
      const m = await consultationsApi.sendMessage(consultationId, text);
      setMessages((prev) => [...prev, m]);
    }
  }

  return (
    <div className="flex h-full min-h-[400px] flex-col">
      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-navy-400">No messages yet. Say hello 👋</p>
        )}
        {messages.map((m) => {
          const own = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${own ? "rounded-br-sm bg-navy-900 text-white" : "rounded-bl-sm border border-navy-100 bg-white text-navy-800"}`}>
                {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                {m.attachments?.map((a) => (
                  <div key={a.documentId} className={`mt-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${own ? "bg-white/10" : "bg-navy-50"}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 3h7l5 5v13H7V3Zm7 0v5h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="truncate">{a.fileName}</span>
                  </div>
                ))}
                <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-white/60" : "text-navy-400"}`}>
                  {time(m.createdAt)}
                  {own && <Ticks status={m.deliveryStatus} />}
                </div>
              </div>
            </div>
          );
        })}
        {typingOther && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-navy-100 bg-white px-3 py-2 text-xs text-navy-500">
              <span className="font-medium">{otherPartyName.split(" ")[0]} is typing</span>
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-navy-400" style={{ animationDelay: `${i * 0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* input */}
      {status === "closed" ? (
        <div className="border-t border-navy-100 px-4 py-3 text-center text-sm text-navy-400">This consultation is closed (read-only).</div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-navy-100 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {onAttach && (
            <button type="button" onClick={onAttach} className="rounded-lg p-2.5 text-navy-500 hover:bg-navy-50" aria-label="Attach document">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 11.5 12 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); emitTyping(); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Type a message…"
            className="field-input max-h-28 min-h-[44px] flex-1 resize-none"
          />
          <button type="submit" disabled={!input.trim()} className="btn-primary h-11 w-11 !px-0" aria-label="Send">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      )}
      {!connected && status === "active" && (
        <p className="px-4 pb-2 text-center text-[11px] text-navy-400">Reconnecting…</p>
      )}
    </div>
  );
}
