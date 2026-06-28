"""
Lawyerly AI service — OCR + NLP microservice (Milestone 8).

Endpoints:
  GET  /health        — liveness probe
  POST /ocr           — Tesseract OCR on a presigned MinIO file URL
  POST /analyze       — NER + case-type + Gemini summarization

There is NO RAG, no vector store, no embeddings anywhere in this service.
Raw OCR text is returned to core-api which discards it after analysis (§8.7/§9.2).
"""
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from app.routers import ocr as ocr_router
from app.routers import analyze as analyze_router
from app.nlp import get_nlp

app = FastAPI(
    title="Lawyerly AI Service",
    version="0.8.0",
    description="OCR + NLP pipeline for legal document analysis. No RAG.",
)

app.include_router(ocr_router.router)
app.include_router(analyze_router.router)


@app.on_event("startup")
def preload_models() -> None:
    """Load the spaCy model at startup to avoid cold-start latency on first request."""
    get_nlp()


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "service": "ai-service", "version": "0.8.0"}
