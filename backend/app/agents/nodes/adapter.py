import json
import logging
from typing import Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

from app.agents.state import LearnerAgentState
from app.core.config import get_settings
from app.models.content import ContentAdaptation, SemanticChunk

logger = logging.getLogger("adaptived.agents.adapter")


class LLMAdaptationResponse(BaseModel):
    """Structured Pydantic schema requested from Groq LLaMA-3.3-70B."""

    simplified_markdown: str = Field(
        description="Simplified bullet-point explanation utilizing an intuitive real-world analogy."
    )
    mermaid_diagram: str = Field(
        description="Valid Mermaid.js flowchart (graph TD or flowchart TD) depicting the concept."
    )
    code_annotations: List[str] = Field(
        default_factory=list,
        description="Key line-by-line annotations pointing out tricky syntax or pitfalls.",
    )


def _generate_fallback_adaptation(content: str, title: Optional[str]) -> ContentAdaptation:
    """Deterministic offline fallback ensuring zero crashes in offline or keyless environments."""
    concept_title = title or "Core Concept"
    return ContentAdaptation(
        adaptation_type="OVERLOAD_SIMPLIFIED",
        simplified_markdown=(
            f"### Simplified Analogy: {concept_title}\n\n"
            f"- **The Mental Model:** Think of this like a factory conveyor belt with quality checks.\n"
            f"- **What's Happening Under The Hood:** Instead of processing everything at once, data is validated in sequential stages.\n"
            f"- **Key Takeaway:** {content[:180]}...\n\n"
            f"> [!TIP] Focus on the direction of data flow before worrying about exact syntax details."
        ),
        mermaid_diagram=(
            "graph TD\n"
            "  A[Input Trigger / Request] --> B[Validation Check]\n"
            "  B --> C{State Valid?}\n"
            "  C -->|Yes| D[Execute Operation & Update State]\n"
            "  C -->|No| E[Graceful Error Boundary]\n"
        ),
        code_annotations=[
            "Step 1: Always verify incoming parameters before invoking state mutations.",
            "Step 2: Isolate side-effects so unexpected errors do not crash the reader.",
        ],
    )


async def content_adapter_node(state: LearnerAgentState) -> Dict[str, object]:
    """
    ContentAdapterNode (Fourth node in LangGraph loop).
    Morphed content generator for learners suffering from cognitive overload.
    Checks MongoDB's semantic cache first (<15ms hit), falling back to Groq LLaMA-3.3-70B.
    """
    node_name = "ContentAdapterNode"
    trace = list(state.get("node_trace", []))

    chunk_id = state.get("chunk_id")
    chunk_content = state.get("chunk_content", "")
    chunk_title = state.get("chunk_title")
    cache_key = "OVERLOAD_SIMPLIFIED"

    # Step 1: High-Speed MongoDB Semantic Cache Check (<15ms)
    chunk_doc: Optional[SemanticChunk] = None
    if chunk_id:
        try:
            chunk_doc = await SemanticChunk.get(chunk_id)
            if chunk_doc and cache_key in chunk_doc.cached_adaptations:
                cached = chunk_doc.cached_adaptations[cache_key]
                logger.info(f"Fast-path Cache HIT (<15ms) for chunk {chunk_id}")
                trace.append(f"{node_name}:CacheHit")
                return {
                    "adaptation_result": cached.model_dump(mode="json"),
                    "node_trace": trace,
                }
        except Exception as exc:
            logger.warning(f"Semantic cache lookup failed for chunk {chunk_id}: {exc}")

    # Step 2: Cache Miss -> Invoke Groq LLaMA-3.3-70B
    trace.append(f"{node_name}:GroqInference")
    settings = get_settings()
    api_key = settings.GROQ_API_KEY.get_secret_value()

    # If running with placeholder key or offline, use deterministic fallback
    if not api_key or api_key.startswith("gsk_placeholder"):
        logger.info("Using deterministic fallback adaptation (placeholder Groq key detected).")
        fallback = _generate_fallback_adaptation(chunk_content, chunk_title)
        return {
            "adaptation_result": fallback.model_dump(mode="json"),
            "node_trace": trace,
        }

    system_prompt = (
        "You are an expert pedagogical compiler and senior computer science educator. "
        "The learner is experiencing severe cognitive overload on the provided technical concept. "
        "Your task is to decompose the concept into: "
        "1. A simplified bullet-point explanation utilizing an intuitive real-world analogy. "
        "2. A clean, valid Mermaid.js diagram (using 'graph TD' or 'sequenceDiagram'). "
        "3. Concrete code annotations highlighting subtle traps. "
        "Respond ONLY with a valid JSON object matching the requested schema."
    )

    user_prompt = (
        f"Topic: {chunk_title or 'Computer Science Concept'}\n\n"
        f"Original Technical Content:\n{chunk_content}\n\n"
        f"Schema Requirements:\n"
        f"JSON format with keys: 'simplified_markdown', 'mermaid_diagram', 'code_annotations'."
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
                    "temperature": settings.GROQ_TEMPERATURE,
                    "max_tokens": settings.GROQ_MAX_TOKENS,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            res_data = response.json()
            raw_content = res_data["choices"][0]["message"]["content"]
            parsed_data = json.loads(raw_content)
            validated_llm = LLMAdaptationResponse.model_validate(parsed_data)

            adaptation = ContentAdaptation(
                adaptation_type=cache_key,
                simplified_markdown=validated_llm.simplified_markdown,
                mermaid_diagram=validated_llm.mermaid_diagram,
                code_annotations=validated_llm.code_annotations,
            )

            # Step 3: Write back to MongoDB cache for subsequent learners (<15ms future reads)
            if chunk_doc is not None:
                try:
                    chunk_doc.cached_adaptations[cache_key] = adaptation
                    await chunk_doc.save()
                    logger.info(f"Persisted new adaptation to semantic cache for chunk {chunk_id}")
                except Exception as save_err:
                    logger.warning(f"Could not persist adaptation cache: {save_err}")

            return {
                "adaptation_result": adaptation.model_dump(mode="json"),
                "node_trace": trace,
            }

    except Exception as exc:
        logger.error(f"Groq API inference failed: {exc}. Falling back to deterministic adaptation.")
        fallback = _generate_fallback_adaptation(chunk_content, chunk_title)
        return {
            "adaptation_result": fallback.model_dump(mode="json"),
            "node_trace": trace,
        }

