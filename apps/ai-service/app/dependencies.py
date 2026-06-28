"""
Shared FastAPI dependencies.

verify_api_key: Enforces X-API-Key header authentication on ai-service endpoints.
Core-api sends the key configured in AI_SERVICE_API_KEY (C-1 security fix).
"""
import os
from fastapi import Header, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(x_api_key: str | None = Security(_api_key_header)) -> None:
    expected = os.getenv("AI_SERVICE_API_KEY", "")
    if not expected:
        # Key not configured — deny all requests to prevent silent open access.
        raise HTTPException(status_code=500, detail="AI_SERVICE_API_KEY not configured on server.")
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
