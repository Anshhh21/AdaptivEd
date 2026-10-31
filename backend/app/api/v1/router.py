from fastapi import APIRouter
from app.api.v1.endpoints.arena import router as arena_router
from app.api.v1.endpoints.byoc import router as byoc_router
from app.api.v1.endpoints.lessons import router as lessons_router
from app.api.v1.endpoints.telemetry import router as telemetry_router
from app.schemas.base import ResponseEnvelope

api_v1_router = APIRouter()

# Mount Telemetry Streaming & Scoring Subsystem
api_v1_router.include_router(telemetry_router, prefix="", tags=["Telemetry"])

# Mount Curriculum & Lessons Subsystem
api_v1_router.include_router(lessons_router, prefix="", tags=["Lessons"])

# Mount Bring Your Own Content (BYOC) Ingestion Subsystem
api_v1_router.include_router(byoc_router, prefix="", tags=["BYOC"])

# Mount Multi-Tactic Proof-of-Work Arena Subsystem
api_v1_router.include_router(arena_router, prefix="", tags=["Arena"])


@api_v1_router.get("/status", response_model=ResponseEnvelope[dict], tags=["System"])
async def api_v1_status() -> ResponseEnvelope[dict]:
    """Lightweight handshake endpoint confirming API v1 subsystem status."""
    return ResponseEnvelope(
        success=True,
        message="AdaptivEd API v1 subsystem operational.",
        data={"version": "1.0.0", "subsystems": ["telemetry", "scoring", "agents", "arena"]},
    )

