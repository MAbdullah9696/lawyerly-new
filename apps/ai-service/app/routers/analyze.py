import os
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import verify_api_key
from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse
from app.nlp import analyze_text

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("", response_model=AnalyzeResponse, dependencies=[Depends(verify_api_key)])
def run_analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """
    Run NER + case-type classification + Gemini summarization on OCR-extracted text.
    The raw text passed here is ephemeral — never written to the database by the caller.
    Requires X-API-Key header matching AI_SERVICE_API_KEY (C-1 fix).
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    try:
        result = analyze_text(req.text, gemini_key)
        return AnalyzeResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
