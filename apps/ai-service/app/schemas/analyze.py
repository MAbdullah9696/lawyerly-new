from pydantic import BaseModel
from typing import List, Optional


class AnalyzeRequest(BaseModel):
    text: str


class Entity(BaseModel):
    type: str   # Person | Organization | Date | MonetaryAmount | LegalSection | Location
    value: str
    confidence: float


class AnalyzeResponse(BaseModel):
    caseType: str
    summary: str
    entities: List[Entity]
    overallConfidence: float
