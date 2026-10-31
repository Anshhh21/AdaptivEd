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


class DynamicAdaptationRequest(AppBaseModel):
    topic_title: str
    content: str
    misconception: Optional[str] = None
    reason: str = "QUIZ_FAILURE_OR_OVERLOAD"


class DynamicAdaptationResponse(AppBaseModel):
    simplified_analogy: str
    real_world_metaphor: str
    step_by_step_walkthrough: list[str]
    simplified_code_example: Optional[str] = None
    mermaid_diagram: Optional[str] = None


@router.post("/telemetry/adapt", response_model=ResponseEnvelope[DynamicAdaptationResponse], tags=["Telemetry"])
async def generate_dynamic_adaptation(payload: DynamicAdaptationRequest) -> ResponseEnvelope[DynamicAdaptationResponse]:
    """
    Dynamic Behavioral Adaptation Endpoint:
    When a learner struggles on a concept or answers incorrectly in a quiz,
    invokes Gemini to synthesize a real-life everyday metaphor and simplified step-by-step model.
    """
    from app.core.config import get_settings
    import httpx

    settings = get_settings()
    gemini_key = settings.GEMINI_API_KEY.get_secret_value()

    system_instruction = (
        "You are the Adaptive Pedagogical Simplifier for AdaptivEd, an advanced adaptive learning engine.\n"
        "The learner is currently experiencing cognitive overload or answered the conceptual quiz incorrectly.\n"
        "Your task is to re-explain this technical topic using a CRYSTAL-CLEAR, REAL-LIFE EVERYDAY METAPHOR "
        "(e.g., cooking in a kitchen, a restaurant order ticket, a classroom whiteboard, traffic lights, or postal mail).\n\n"
        "STRICT REQUIREMENTS:\n"
        "1. Real-World Metaphor: Explain the concept entirely through the metaphor without dense jargon.\n"
        "2. Step-by-Step Walkthrough: Exactly 3 simple, numbered steps in plain English.\n"
        "3. Simplified Code Example: Provide a tiny 4-6 line minimal code example inside triple backticks.\n"
        "4. Mermaid Diagram: A simple 3-node flowchart diagram.\n\n"
        "Return STRICTLY a JSON object with this schema:\n"
        "{\n"
        '  "real_world_metaphor": "string (The story/analogy)",\n'
        '  "simplified_analogy": "string (Why this maps directly to the code/concept)",\n'
        '  "step_by_step_walkthrough": ["Step 1 explanation", "Step 2 explanation", "Step 3 explanation"],\n'
        '  "simplified_code_example": "string (code inside markdown backticks)",\n'
        '  "mermaid_diagram": "string (graph TD\\n  A --> B --> C)"\n'
        "}"
    )

    prompt = (
        f"{system_instruction}\n\n"
        f"TOPIC TITLE: {payload.topic_title}\n"
        f"ORIGINAL CONTENT:\n\"\"\"{payload.content[:3000]}\"\"\"\n"
        f"USER MISCONCEPTION / REASON: {payload.misconception or payload.reason}\n"
    )

    if gemini_key and len(gemini_key) > 10:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={gemini_key}"
        gemini_payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(api_url, json=gemini_payload)
                if resp.status_code == 200:
                    cand = (
                        resp.json()
                        .get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                    )
                    if cand:
                        data = json.loads(cand)
                        return ResponseEnvelope(
                            success=True,
                            data=DynamicAdaptationResponse(
                                real_world_metaphor=data.get("real_world_metaphor", "Real-world analogy"),
                                simplified_analogy=data.get("simplified_analogy", "Simplified mapping"),
                                step_by_step_walkthrough=data.get(
                                    "step_by_step_walkthrough",
                                    ["Observe initial state", "Apply mutation cleanly", "UI updates smoothly"],
                                ),
                                simplified_code_example=data.get("simplified_code_example"),
                                mermaid_diagram=data.get("mermaid_diagram"),
                            ),
                            message="Adaptive real-world analogy synthesized successfully.",
                        )
        except Exception as e:
            logger.warning(f"Gemini dynamic adaptation failed ({e}). Using heuristic fallback.")

    # Rule-based fallback
    return ResponseEnvelope(
        success=True,
        data=DynamicAdaptationResponse(
            real_world_metaphor=(
                f"Think of {payload.topic_title} like a restaurant kitchen order ticket: "
                "instead of cooking food randomly on the spot, you write down an order (state), and the kitchen prepares exactly what's on the ticket."
            ),
            simplified_analogy="When you request an update, the system records your request and batches the preparation so nothing spills over.",
            step_by_step_walkthrough=[
                "Step 1: Set up the initial starting condition.",
                "Step 2: Trigger an action when an event occurs.",
                "Step 3: The system renders the new view automatically without manual repainting.",
            ],
            simplified_code_example=None,
            mermaid_diagram="graph TD\n  Action[User Click / Trigger] --> State[Update Memory]\n  State --> View[Re-render Screen Cleanly]",
        ),
        message="Heuristic adaptation delivered.",
    )


