import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import verify_api_key
from app.schemas.ocr import OcrRequest, OcrResponse
from app.ocr import extract_text

router = APIRouter(prefix="/ocr", tags=["ocr"])


def _validate_file_url(url: str) -> None:
    """Allow only URLs whose host matches ALLOWED_STORAGE_HOST (C-1 / SSRF fix)."""
    allowed_host = os.getenv("ALLOWED_STORAGE_HOST", "localhost:9000")
    parsed = urlparse(url)
    host_with_port = parsed.netloc  # includes port, e.g. "localhost:9000"
    if parsed.scheme not in ("http", "https") or host_with_port != allowed_host:
        raise HTTPException(
            status_code=400,
            detail=f"fileUrl host '{host_with_port}' is not allowed. Expected '{allowed_host}'.",
        )


@router.post("", response_model=OcrResponse, dependencies=[Depends(verify_api_key)])
def run_ocr(req: OcrRequest) -> OcrResponse:
    """
    Download the file at `fileUrl` (a presigned MinIO GET URL) and run Tesseract OCR.
    Returns extracted text + confidence score. The text is never stored by this service.
    Requires X-API-Key header matching AI_SERVICE_API_KEY (C-1 fix).
    """
    _validate_file_url(req.fileUrl)
    try:
        result = extract_text(req.fileUrl)
        return OcrResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
