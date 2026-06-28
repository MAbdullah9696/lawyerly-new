/**
 * Chatbot LLM — a DIRECT chat-completions call (CLAUDE.md §9.1).
 *
 * Provider: Google Gemini (free tier), model gemini-2.5-flash. There is NO RAG,
 * no vector store, and no retrieval step anywhere — we send the conversation
 * history plus a system instruction and render the model's answer. Section
 * references (e.g. "PPC Section 302") are model-generated label chips.
 *
 * In development without a GEMINI_API_KEY, a deterministic fallback keeps the
 * chatbot testable. The real Gemini call activates as soon as a key is set.
 */
import { GoogleGenerativeAI, SchemaType, type Content, type Schema } from "@google/generative-ai";
import { env } from "../config/env.js";

const GEMINI_MODEL = "gemini-2.5-flash";

export const PRACTICE_AREAS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property & Real Estate",
  "Corporate & Business",
  "Constitutional Law",
  "Intellectual Property",
  "Labour Law",
  "Immigration",
  "Cyber Law",
] as const;

export type PracticeArea = (typeof PRACTICE_AREAS)[number] | "General";

export interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

export interface ChatResult {
  reply: string;
  citations: string[];
  practiceArea: PracticeArea;
}

const SYSTEM_PROMPT = `You are Lawyerly's AI legal assistant for Pakistan. Your role:
- Provide PRELIMINARY legal information in clear, plain English about Pakistani law (PPC, CrPC, CPC, family law, property, labour, constitutional, cyber/PECA, etc.).
- You are NOT a lawyer and you do NOT give legal advice. Never claim to be a licensed lawyer or to represent the user.
- Keep answers concise, practical, and easy to understand for an ordinary citizen.
- Where relevant, reference the specific statute or section by its label (e.g. "PPC Section 302", "Muslim Family Laws Ordinance 1961"). These are informational labels only.
- Encourage the user to consult a licensed lawyer for their specific situation.
- Stay within preliminary-guidance scope; do not draft court documents or guarantee outcomes.

Return JSON with:
- "reply": your plain-English answer.
- "citations": the section/statute labels you referenced (e.g. ["PPC Section 302"]); use [] if none.
- "practiceArea": the single most relevant practice area for this query (one of ${JSON.stringify([
  ...PRACTICE_AREAS,
  "General",
])}), so the user can be connected to the right kind of lawyer.`;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
    citations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    practiceArea: { type: SchemaType.STRING },
  },
  required: ["reply", "citations", "practiceArea"],
};

let genAI: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI | null {
  if (!env.GEMINI_API_KEY) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI;
}

export function isLlmConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

/** Validate/coerce an arbitrary parsed object into a ChatResult, or null. */
function coerce(obj: unknown): ChatResult | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.reply !== "string") return null;
  const citations = Array.isArray(o.citations) ? o.citations.filter((c): c is string => typeof c === "string") : [];
  const allowed = [...PRACTICE_AREAS, "General"] as readonly string[];
  const practiceArea = (allowed.includes(o.practiceArea as string) ? o.practiceArea : "General") as PracticeArea;
  return { reply: o.reply, citations, practiceArea };
}

/** Tolerant JSON extraction: handles bare objects and fenced code blocks. */
function parseModelJson(text: string): ChatResult | null {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return coerce(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return null;
  }
}

export async function generateChatReply(history: ChatTurn[], message: string): Promise<ChatResult> {
  const client = getClient();
  if (!client) return devFallback(message);

  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 1024,
    },
  });

  // Cap history at the last 20 turns to bound token cost (H-5 fix).
  const cappedHistory = history.slice(-20);

  // Gemini chat history: roles are "user" | "model".
  const geminiHistory: Content[] = cappedHistory.map((t) => ({
    role: t.role === "ai" ? "model" : "user",
    parts: [{ text: t.text }],
  }));

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);
  const text = result.response.text().trim();

  return (
    parseModelJson(text) ??
    coerce(text) ?? {
      reply: text || "I'm sorry, I couldn't process that. Please rephrase your question.",
      citations: [],
      practiceArea: "General",
    }
  );
}

// --- Deterministic dev fallback (no Gemini key) -----------------------------
const TOPIC_RULES: { area: PracticeArea; keywords: string[]; citation?: string }[] = [
  { area: "Criminal Law", keywords: ["murder", "qatl", "302", "fir", "bail", "police", "theft", "robbery", "crime"], citation: "PPC Section 302" },
  { area: "Family Law", keywords: ["divorce", "khula", "talaq", "custody", "marriage", "nikah", "dowry", "maintenance"], citation: "Muslim Family Laws Ordinance 1961" },
  { area: "Property & Real Estate", keywords: ["rent", "tenant", "landlord", "property", "land", "inheritance", "mutation", "lease"], citation: "Punjab Rented Premises Act 2009" },
  { area: "Cyber Law", keywords: ["cyber", "online", "hacking", "harass", "peca", "social media", "blackmail"], citation: "PECA 2016" },
  { area: "Corporate & Business", keywords: ["company", "business", "contract", "partnership", "cheque", "tax", "fraud"], citation: "PPC Section 489-F" },
  { area: "Labour Law", keywords: ["employment", "salary", "termination", "labour", "worker", "wages", "job"], citation: "Industrial Relations Act 2012" },
  { area: "Constitutional Law", keywords: ["fundamental right", "writ", "constitution", "petition", "article"], citation: "Constitution of Pakistan, Article 199" },
];

function classify(message: string): { area: PracticeArea; citation?: string } {
  const m = message.toLowerCase();
  for (const rule of TOPIC_RULES) {
    if (rule.keywords.some((k) => m.includes(k))) return { area: rule.area, citation: rule.citation };
  }
  return { area: "General" };
}

function devFallback(message: string): ChatResult {
  const { area, citation } = classify(message);
  const areaLine = area === "General" ? "your question" : `a matter that generally falls under ${area} in Pakistan`;
  const reply =
    `Here is some preliminary information about ${areaLine}. ` +
    `In general, the first steps are to gather any relevant documents, note key dates and the people involved, and understand which law or section applies to your situation. ` +
    (citation ? `A commonly relevant provision here is ${citation}. ` : "") +
    `This is general information to help you understand your options — it is not legal advice. ` +
    `For guidance on your specific case, consult a licensed lawyer through Lawyerly.\n\n` +
    `(Developer note: the Gemini API key is not configured, so this is a built-in preliminary response.)`;
  return { reply, citations: citation ? [citation] : [], practiceArea: area };
}
