"""
Health check endpoints.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Basic health check."""
    return {"status": "healthy"}


@router.get("/healthz")
async def healthz():
    """Kubernetes-style health check."""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz():
    """Readiness check - verifies service is ready to accept requests."""
    # In production, this would check model loading status
    return {"status": "ready"}
