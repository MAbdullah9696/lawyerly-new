from pydantic import BaseModel, HttpUrl


class OcrRequest(BaseModel):
    fileUrl: str


class OcrResponse(BaseModel):
    text: str
    confidence: float
    lowConfidence: bool
