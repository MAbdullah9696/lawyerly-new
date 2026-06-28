"""
OCR module — downloads a file from a presigned MinIO URL and extracts text via Tesseract.

Supports PDF (converted to images via pdf2image) and raster images (JPG/PNG).
Returns extracted text, mean word confidence, and a low_confidence flag.
Raw text is returned to the caller (core-api pipeline) which immediately discards it
after the NLP step — never written to the database (privacy rule §8.7/§9.2).
"""
import os
import tempfile
from pathlib import Path

import httpx
import pytesseract
from pdf2image import convert_from_path
from PIL import Image

# Detect OS to pick the right default Tesseract binary path.
import platform as _platform
_DEFAULT_TESS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if _platform.system() == "Windows"
    else "tesseract"
)
_TESS_CMD = os.environ.get("TESSERACT_CMD") or _DEFAULT_TESS
# Only override pytesseract if the path actually resolves (covers Windows installs;
# on Linux 'tesseract' is already on PATH so the override is a no-op).
if os.path.exists(_TESS_CMD) or _platform.system() != "Windows":
    pytesseract.pytesseract.tesseract_cmd = _TESS_CMD

# Optional poppler binary path for pdf2image on Windows.
_POPPLER_PATH = os.environ.get("POPPLER_PATH") or None

# Tesseract config: OEM 3 (LSTM + legacy), PSM 3 (fully automatic page segmentation)
_TESS_CONFIG = "--oem 3 --psm 3"

# Content-type → suffix mapping
_PDF_TYPES = {"application/pdf", "binary/octet-stream"}


def extract_text(file_url: str) -> dict:
    """
    Download `file_url` and run OCR.

    Returns:
        {
          text: str,          # concatenated OCR output
          confidence: float,  # mean word-level Tesseract confidence (0–100)
          lowConfidence: bool # True when confidence < 60 or very little text extracted
        }
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        raw_bytes, content_type = _download(file_url)
        suffix = _detect_suffix(file_url, content_type)
        file_path = Path(tmp_dir) / f"doc{suffix}"
        file_path.write_bytes(raw_bytes)

        images = _to_images(file_path, suffix)
        text, mean_conf = _ocr_images(images)

    low = mean_conf < 60.0 or len(text.strip()) < 30
    return {
        "text": text,
        "confidence": round(mean_conf, 2),
        "lowConfidence": low,
    }


# ─── private helpers ──────────────────────────────────────────────────────────

def _download(url: str) -> tuple[bytes, str]:
    resp = httpx.get(url, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    ct = resp.headers.get("content-type", "").split(";")[0].strip().lower()
    return resp.content, ct


def _detect_suffix(url: str, content_type: str) -> str:
    url_lower = url.lower().split("?")[0]  # strip query params
    if url_lower.endswith(".pdf") or content_type in _PDF_TYPES:
        return ".pdf"
    if url_lower.endswith(".png"):
        return ".png"
    return ".jpg"


def _to_images(file_path: Path, suffix: str) -> list:
    if suffix == ".pdf":
        try:
            # 200 DPI is sufficient for most scanned legal documents
            return convert_from_path(str(file_path), dpi=200, poppler_path=_POPPLER_PATH)
        except Exception as exc:
            raise RuntimeError(
                "PDF processing failed. Ensure poppler is installed and POPPLER_PATH is set correctly."
            ) from exc
    return [Image.open(file_path).convert("RGB")]


def _ocr_images(images: list) -> tuple[str, float]:
    all_text: list[str] = []
    all_confs: list[float] = []

    for img in images:
        data = pytesseract.image_to_data(
            img, config=_TESS_CONFIG, output_type=pytesseract.Output.DICT
        )
        words = [
            (w, c)
            for w, c in zip(data["text"], data["conf"])
            if isinstance(w, str) and w.strip() and isinstance(c, (int, float)) and c >= 0
        ]
        if words:
            page_words, page_confs = zip(*words)
            all_text.append(" ".join(page_words))
            all_confs.extend(page_confs)

    text = "\n".join(all_text).strip()
    mean_conf = (sum(all_confs) / len(all_confs)) if all_confs else 0.0
    return text, mean_conf
