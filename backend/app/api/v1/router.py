from fastapi import APIRouter
from app.schemas.base import ResponseEnvelope

api_v1_router = APIRouter()


@api_v1_router.get("/status", response_model=ResponseEnvelope[dict], tags=["System"])
async def api_v1_status() -> ResponseEnvelope[dict]:
    """Lightweight handshake endpoint confirming API v1 subsystem status."""
    return ResponseEnvelope(
        success=True,
        message="AdaptivEd API v1 subsystem operational.",
        data={"version": "1.0.0", "subsystems": ["telemetry", "scoring", "agents", "arena"]},
    )

