"""
NLP module — Named Entity Recognition, case-type classification, Gemini summarization.

Pipeline:
  1. spaCy en_core_web_sm  → PERSON, ORG, GPE/LOC, DATE, MONEY entities
  2. Regex                  → Pakistani legal section references (PPC, CPC, …)
  3. Regex                  → PKR/Rs monetary amounts missed by spaCy
  4. Keyword classifier     → case type (Criminal / Family / Property / …)
  5. Gemini API             → 150–300 word plain-English summary

Raw text is NEVER stored — the caller (core-api) discards it immediately after
receiving the analysis result (privacy rule §8.7/§9.2).
"""
import re
from typing import Optional

import spacy
import google.generativeai as genai

# ─── Lazy-loaded spaCy model ──────────────────────────────────────────────────
_nlp: Optional[spacy.language.Language] = None

SPACY_MODEL = "en_core_web_sm"


def get_nlp() -> spacy.language.Language:
    global _nlp
    if _nlp is None:
        _nlp = spacy.load(SPACY_MODEL)
    return _nlp


# ─── Entity type mapping ──────────────────────────────────────────────────────
_SPACY_TO_TYPE: dict[str, str] = {
    "PERSON": "Person",
    "ORG": "Organization",
    "GPE": "Location",
    "LOC": "Location",
    "DATE": "Date",
    "MONEY": "MonetaryAmount",
}

# ─── Legal section regex ──────────────────────────────────────────────────────
# Matches: "PPC Section 302", "CPC Order VII Rule 11", "Art. 25", "Article 10-A"
_LEGAL_RE = re.compile(
    r"\b(PPC|CPC|CRPC|CrPC|MPC|BNSS|PECA|PPRA|Constitution|Art\.?|Article)\s*"
    r"(?:Section|S\.|s\.|Order|Rule|Schedule|Clause)?\s*"
    r"(\d+[\w\-]*(?:\([a-zA-Z0-9]+\))*)",
    re.IGNORECASE,
)

# ─── PKR / Rs monetary regex ─────────────────────────────────────────────────
_MONEY_RE = re.compile(
    r"(?:PKR|Rs\.?|Rupees?)\s*[\d,]+(?:\.\d+)?(?:\s*(?:lakh|lac|crore|million|billion))?",
    re.IGNORECASE,
)

# ─── Case-type keyword classifier ────────────────────────────────────────────
# Ordered by specificity — first category that wins is used.
_CASE_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Criminal", [
        "murder", "qatl", "theft", "robbery", "assault", "rape", "kidnapping",
        "fraud", "forgery", "FIR", "bail", "accused", "arrest", "PPC", "PECA",
        "crime", "criminal", "prosecution", "convict", "sentence", "acquittal",
    ]),
    ("Family", [
        "divorce", "khula", "custody", "maintenance", "nafqa", "nikah",
        "marriage", "talaq", "dower", "mehr", "guardianship", "succession",
        "inheritance", "family", "MFLO", "dowry",
    ]),
    ("Property", [
        "property", "land", "lease", "rent", "tenant", "landlord", "possession",
        "title deed", "registry", "transfer", "mutation", "fard", "allotment",
        "easement", "sale deed", "mortgage",
    ]),
    ("Corporate", [
        "company", "corporation", "shareholder", "director", "contract",
        "business", "partnership", "liability", "SECP", "incorporation",
        "memorandum", "articles of association", "trademark", "franchise",
    ]),
    ("Constitutional", [
        "fundamental rights", "constitutional", "high court", "supreme court",
        "petition", "writ", "article 25", "article 10", "habeas corpus",
        "mandamus", "prohibition", "certiorari",
    ]),
    ("Civil", [
        "plaintiff", "defendant", "suit", "decree", "injunction", "civil",
        "damages", "compensation", "CPC", "appeal", "revision", "review",
        "trespass", "nuisance", "tort",
    ]),
]


def classify_case_type(text: str) -> str:
    text_lower = text.lower()
    best_type = "Other"
    best_hits = 0
    for case_type, keywords in _CASE_KEYWORDS:
        hits = sum(1 for kw in keywords if kw.lower() in text_lower)
        if hits > best_hits:
            best_hits = hits
            best_type = case_type
    return best_type


# ─── Main analysis function ───────────────────────────────────────────────────

def analyze_text(text: str, gemini_key: str) -> dict:
    """
    Run NER + classification + summarization on OCR-extracted text.

    Returns:
        {
          caseType: str,
          summary: str,
          entities: list[{type, value, confidence}],
          overallConfidence: float,
        }
    """
    text = text.strip()
    if not text:
        return {
            "caseType": "Other",
            "summary": "No readable text could be extracted from this document.",
            "entities": [],
            "overallConfidence": 0.0,
        }

    nlp = get_nlp()
    # spaCy has a default max_length — guard against very large documents
    doc = nlp(text[:100_000])

    entities: list[dict] = []
    seen: set[tuple[str, str]] = set()

    # 1. spaCy NER
    for ent in doc.ents:
        etype = _SPACY_TO_TYPE.get(ent.label_)
        if not etype:
            continue
        value = ent.text.strip()
        key = (etype, value.lower())
        if key in seen:
            continue
        seen.add(key)
        entities.append({"type": etype, "value": value, "confidence": 0.85})

    # 2. Legal section regex
    for m in _LEGAL_RE.finditer(text):
        value = m.group(0).strip()
        key = ("LegalSection", value.lower())
        if key in seen:
            continue
        seen.add(key)
        entities.append({"type": "LegalSection", "value": value, "confidence": 0.95})

    # 3. PKR/Rs monetary regex (captures amounts spaCy misses)
    for m in _MONEY_RE.finditer(text):
        value = m.group(0).strip()
        key = ("MonetaryAmount", value.lower())
        if key in seen:
            continue
        seen.add(key)
        entities.append({"type": "MonetaryAmount", "value": value, "confidence": 0.90})

    # 4. Case type
    case_type = classify_case_type(text)

    # 5. Gemini summarization
    summary = _gemini_summarize(text, gemini_key)

    # Overall confidence = mean entity confidence (default 0.5 if no entities)
    overall = (
        round(sum(e["confidence"] for e in entities) / len(entities), 3)
        if entities
        else 0.5
    )

    return {
        "caseType": case_type,
        "summary": summary,
        "entities": entities,
        "overallConfidence": overall,
    }


# ─── Gemini summarization ─────────────────────────────────────────────────────

def _gemini_summarize(text: str, api_key: str) -> str:
    if not api_key:
        return _fallback_summary()
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = (
            "You are a Pakistani legal assistant helping citizens understand legal documents. "
            "Summarize the following legal document in 150 to 300 plain English words. "
            "Identify: the document type, the key parties involved, the main legal issue or purpose, "
            "and any important dates or monetary amounts. "
            "Write clearly for a non-lawyer audience. "
            "Do NOT give legal advice — this is a factual summary only.\n\n"
            f"DOCUMENT TEXT:\n{text[:10_000]}"
        )
        resp = model.generate_content(prompt)
        return resp.text.strip()
    except Exception:
        return _fallback_summary()


def _fallback_summary() -> str:
    """Generic message used when Gemini is unavailable. Must NOT contain OCR-derived text (§8.7/§9.2)."""
    return (
        "Summary generation is temporarily unavailable. "
        "The document has been analysed; entities and case type are available below."
    )
