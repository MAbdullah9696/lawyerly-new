/** AI chatbot service (CLAUDE.md §8.2 / §9.1). Sessions + messages + LLM call. */
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { generateChatReply, type ChatTurn } from "../../lib/llm.js";

function titleFrom(message: string): string {
  return message.length > 60 ? message.slice(0, 57) + "…" : message;
}

export async function sendMessage(userId: string, message: string, sessionId?: string) {
  // Resolve or create the session.
  let session;
  if (sessionId) {
    session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new AppError(404, "session_not_found", "Chat session not found.");
    }
  } else {
    session = await prisma.chatSession.create({ data: { userId, title: titleFrom(message) } });
  }

  // Per-session message rate limit: 30 user messages per hour (H-5 fix).
  const recentUserMessages = await prisma.chatMessage.count({
    where: { sessionId: session.id, sender: "user", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recentUserMessages >= 30) {
    throw new AppError(429, "rate_limited", "You have reached the hourly message limit (30 messages per session). Please wait before sending more.");
  }

  // History (DB-derived for reliability) BEFORE saving the new user turn.
  const prior = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });
  const history: ChatTurn[] = prior.map((m) => ({ role: m.sender, text: m.text }));

  // Persist the user message first so it is never lost if the LLM fails (§14).
  const userMessage = await prisma.chatMessage.create({
    data: { sessionId: session.id, sender: "user", text: message },
  });

  let result;
  try {
    result = await generateChatReply(history, message);
  } catch (err) {
    console.error("LLM error:", err);
    throw new AppError(
      503,
      "chatbot_unavailable",
      "Our AI assistant is temporarily unavailable. Your message has been saved — please try again shortly.",
      { sessionId: session.id, userMessageId: userMessage.id },
    );
  }

  const aiMessage = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: "ai",
      text: result.reply,
      citations: result.citations,
    },
  });

  return {
    sessionId: session.id,
    title: session.title,
    userMessage: { id: userMessage.id, text: userMessage.text, createdAt: userMessage.createdAt },
    aiMessage: {
      id: aiMessage.id,
      text: aiMessage.text,
      citations: aiMessage.citations,
      createdAt: aiMessage.createdAt,
    },
    practiceArea: result.practiceArea,
  };
}

export async function listSessions(userId: string) {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return sessions.map((s) => ({
    id: s.id,
    title: s.title ?? "New chat",
    createdAt: s.createdAt,
    messageCount: s._count.messages,
  }));
}

export async function getMessages(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new AppError(404, "session_not_found", "Chat session not found.");
  }
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return {
    session: { id: session.id, title: session.title, createdAt: session.createdAt },
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      citations: m.citations,
      feedback: m.feedback,
      createdAt: m.createdAt,
    })),
  };
}

export async function setFeedback(userId: string, messageId: string, feedback: "up" | "down" | null) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    include: { session: true },
  });
  if (!message || message.session.userId !== userId) {
    throw new AppError(404, "message_not_found", "Message not found.");
  }
  if (message.sender !== "ai") {
    throw new AppError(400, "invalid_target", "Feedback can only be left on AI responses.");
  }
  await prisma.chatMessage.update({ where: { id: messageId }, data: { feedback } });
}
