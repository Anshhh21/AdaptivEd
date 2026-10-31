import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError

from app.ml.scoring import (
    BCSEngine,
    BCSEvaluation,
    ChunkContext,
    ChunkTelemetryTick,
    CognitiveState,
    LearnerContext,
)
from app.models.content import SemanticChunk
from app.models.learner import LearnerProfile
from app.schemas.base import ResponseEnvelope

logger = logging.getLogger("adaptived.telemetry")
router = APIRouter()


class TelemetryConnectionManager:
    """Manages active WebSocket telemetry streaming sessions."""

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, learner_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[learner_id] = websocket
        logger.info(f"Learner {learner_id} connected to real-time telemetry stream.")

    def disconnect(self, learner_id: str) -> None:
        if learner_id in self.active_connections:
            del self.active_connections[learner_id]
            logger.info(f"Learner {learner_id} disconnected from telemetry stream.")

    async def send_evaluation(self, learner_id: str, evaluation: BCSEvaluation) -> None:
        ws = self.active_connections.get(learner_id)
        if ws is not None:
            await ws.send_text(json.dumps(evaluation.model_dump(mode="json")))


manager = TelemetryConnectionManager()


async def _resolve_learner_context(learner_id: str) -> LearnerContext:
    """Fetches calibrated learner baseline from MongoDB with fallback to defaults."""
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.user_id == learner_id)
        if profile and profile.baseline:
            return LearnerContext(
                wpm=profile.baseline.wpm,
                regression_tolerance_ratio=profile.baseline.regression_tolerance_ratio,
                attention_stability_index=profile.baseline.attention_stability_index,
            )
    except Exception as exc:
        logger.warning(f"Could not load LearnerProfile for {learner_id}: {exc}")
    return LearnerContext()


async def _resolve_chunk_context(chunk_id: str) -> ChunkContext:
    """Fetches chunk complexity parameters from MongoDB with fallback to heuristic defaults."""
    try:
        chunk = await SemanticChunk.get(chunk_id)
        if chunk:
            return ChunkContext(
                target_dwell_ms=chunk.target_dwell_ms,
                flesch_kincaid_grade=chunk.flesch_kincaid_grade,
                word_count=chunk.word_count,
            )
    except Exception as exc:
        logger.warning(f"Could not load SemanticChunk {chunk_id}: {exc}")
    # Safe default: ~100 words at 220 WPM (~27.2 seconds target dwell)
    return ChunkContext(target_dwell_ms=27272, flesch_kincaid_grade=8.0, word_count=100)


@router.websocket("/ws/telemetry/{learner_id}")
async def telemetry_websocket_stream(websocket: WebSocket, learner_id: str) -> None:
    """
    Bi-directional high-frequency telemetry WebSocket endpoint.
    Client streams 1-second ChunkTelemetryTick payloads;
    Server responds immediately (<1ms) with computed BCSEvaluation.
    """
    await manager.connect(learner_id, websocket)
    cached_learner = await _resolve_learner_context(learner_id)
    cached_chunk_id: Optional[str] = None
    cached_chunk: Optional[ChunkContext] = None

    try:
        while True:
            raw_text = await websocket.receive_text()

            # Fast ping-pong keepalive
            if raw_text == "ping":
                await websocket.send_text("pong")
                continue

            try:
                data = json.loads(raw_text)
                tick = ChunkTelemetryTick.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as err:
                await websocket.send_text(
                    json.dumps({"error": "INVALID_TELEMETRY_PAYLOAD", "detail": str(err)})
                )
                continue

            # Refresh chunk context only when student transitions to a different chunk
            if cached_chunk is None or cached_chunk_id != tick.chunk_id:
                cached_chunk = await _resolve_chunk_context(tick.chunk_id)
                cached_chunk_id = tick.chunk_id

            # Execute sub-millisecond mathematical BCS scoring
            evaluation = BCSEngine.evaluate(
                telemetry=tick,
                chunk=cached_chunk,
                learner=cached_learner,
            )

            # Stream evaluation response back to client
            await websocket.send_text(json.dumps(evaluation.model_dump(mode="json")))

    except WebSocketDisconnect:
        manager.disconnect(learner_id)
    except Exception as exc:
        logger.error(f"Error in telemetry stream for {learner_id}: {exc}", exc_info=True)
        manager.disconnect(learner_id)


@router.post("/telemetry/tick", response_model=ResponseEnvelope[BCSEvaluation], tags=["Telemetry"])
async def evaluate_telemetry_http_fallback(
    tick: ChunkTelemetryTick, learner_id: str = "anonymous"
) -> ResponseEnvelope[BCSEvaluation]:
    """
    HTTP POST fallback for environments where WebSockets are blocked by corporate firewalls.
    """
    learner = await _resolve_learner_context(learner_id)
    chunk = await _resolve_chunk_context(tick.chunk_id)
    evaluation = BCSEngine.evaluate(telemetry=tick, chunk=chunk, learner=learner)
    return ResponseEnvelope(
        success=True,
        data=evaluation,
        message=f"Evaluated state: {evaluation.cognitive_state.value}",
    )

