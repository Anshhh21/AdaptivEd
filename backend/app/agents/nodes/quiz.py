import json
import logging
from typing import Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

from app.agents.state import LearnerAgentState
from app.core.config import get_settings
from app.models.content import SemanticChunk, SpeedCheckQuestion

logger = logging.getLogger("adaptived.agents.quiz")


class LLMQuizResponse(BaseModel):
    """Structured Pydantic schema for Groq LLaMA-3.3-70B speed-check generation."""

    question: str = Field(description="A concise conceptual question testing genuine comprehension.")
    options: List[str] = Field(description="Exactly 4 distinct multiple-choice options.", min_length=4, max_length=4)
    correct_option_index: int = Field(ge=0, le=3, description="0-indexed pointer to the correct option.")
    explanation: str = Field(description="Brief 1-2 sentence explanation of why the answer is correct.")


def _generate_fallback_quiz(title: Optional[str]) -> SpeedCheckQuestion:
    """Deterministic offline fallback speed-check question."""
    concept = title or "this technical concept"
    return SpeedCheckQuestion(
        question=f"Which statement best characterizes the core operational pattern of {concept}?",
        options=[
            "It executes side-effects synchronously before verifying incoming state invariants.",
            "It isolates state mutations and validates contracts to ensure deterministic transitions.",
            "It bypasses the event loop entirely to execute raw kernel instructions directly.",
            "It caches all mutable objects indefinitely in global uncollected memory.",
        ],
        correct_option_index=1,
        explanation="Robust systems isolate side-effects and validate invariants to preserve deterministic state transitions.",
    )


async def micro_quiz_node(state: LearnerAgentState) -> Dict[str, object]:
    """
    MicroQuizNode (Alternative terminal node in LangGraph loop).
    Triggered when sustained SKIMMING is detected.
    Injects a mandatory 1-question conceptual speed-check before unlocking the next chunk.
    """
    node_name = "MicroQuizNode"
    trace = list(state.get("node_trace", []))

    chunk_id = state.get("chunk_id")
    chunk_content = state.get("chunk_content", "")
    chunk_title = state.get("chunk_title")

    # Step 1: Pre-computed or Cached Speed-Check Check (<15ms)
    chunk_doc: Optional[SemanticChunk] = None
    if chunk_id:
        try:
            chunk_doc = await SemanticChunk.get(chunk_id)
            if chunk_doc and chunk_doc.speed_check is not None:
                logger.info(f"Speed-check pre-calibrated cache HIT for chunk {chunk_id}")
                trace.append(f"{node_name}:CacheHit")
                return {
                    "speed_check_result": chunk_doc.speed_check.model_dump(mode="json"),
                    "node_trace": trace,
                }
        except Exception as exc:
            logger.warning(f"Speed-check lookup failed for chunk {chunk_id}: {exc}")

    # Step 2: Cache Miss -> Invoke Groq LLaMA-3.3-70B
    trace.append(f"{node_name}:GroqInference")
    settings = get_settings()
    api_key = settings.GROQ_API_KEY.get_secret_value()

    if not api_key or api_key.startswith("gsk_placeholder"):
        logger.info("Using deterministic fallback quiz (placeholder Groq key detected).")
        fallback = _generate_fallback_quiz(chunk_title)
        return {
            "speed_check_result": fallback.model_dump(mode="json"),
            "node_trace": trace,
        }

    system_prompt = (
        "You are an expert pedagogical auditor and technical exam author. "
        "The learner is skimming through the educational material without adequate dwell time. "
        "Generate a targeted 1-question conceptual multiple-choice speed check based strictly on the text. "
        "Requirements:\n"
        "- Exactly 4 options.\n"
        "- Exactly 1 unambiguous correct answer.\n"
        "- Avoid trivial trivia; test deep conceptual comprehension.\n"
        "- Respond ONLY with a valid JSON object matching the requested schema."
    )

    user_prompt = (
        f"Topic: {chunk_title or 'Concept'}\n\n"
        f"Source Chunk Content:\n{chunk_content}\n\n"
        f"Output JSON with keys: 'question', 'options' (list of 4 strings), 'correct_option_index' (int 0-3), 'explanation'."
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1024,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            res_data = response.json()
            raw_content = res_data["choices"][0]["message"]["content"]
            parsed_data = json.loads(raw_content)
            validated_quiz = LLMQuizResponse.model_validate(parsed_data)

            quiz = SpeedCheckQuestion(
                question=validated_quiz.question,
                options=validated_quiz.options,
                correct_option_index=validated_quiz.correct_option_index,
                explanation=validated_quiz.explanation,
            )

            # Persist to chunk document so subsequent skimming students hit the fast path
            if chunk_doc is not None:
                try:
                    chunk_doc.speed_check = quiz
                    await chunk_doc.save()
                    logger.info(f"Persisted new speed-check to MongoDB for chunk {chunk_id}")
                except Exception as save_err:
                    logger.warning(f"Could not persist speed-check: {save_err}")

            return {
                "speed_check_result": quiz.model_dump(mode="json"),
                "node_trace": trace,
            }

    except Exception as exc:
        logger.error(f"Groq API speed-check generation failed: {exc}. Using fallback.")
        fallback = _generate_fallback_quiz(chunk_title)
        return {
            "speed_check_result": fallback.model_dump(mode="json"),
            "node_trace": trace,
        }

