from typing import Annotated, Any, Dict, List, Literal, Optional
from typing_extensions import TypedDict
from pydantic import Field

from app.ml.scoring import BCSEvaluation, ChunkTelemetryTick, CognitiveState
from app.models.content import ContentAdaptation, SpeedCheckQuestion
from app.schemas.base import AppBaseModel

PedagogicalDecision = Literal[
    "CONTINUE",
    "ADAPT_OVERLOAD",
    "TRIGGER_SPEED_CHECK",
    "UPDATE_BASELINE",
]


class AgentCognitiveState(AppBaseModel):
    """Pydantic representation of the agent's internal cognitive assessment."""

    learner_id: str
    chunk_id: str
    lesson_id: str
    chunk_content: str
    chunk_title: Optional[str] = None
    flesch_kincaid_grade: float = 8.0
    target_dwell_ms: int = 25000

    current_tick: ChunkTelemetryTick
    current_evaluation: BCSEvaluation
    telemetry_history: List[BCSEvaluation] = Field(default_factory=list)

    # Longitudinal Trend Analysis
    window_mean_bcs: float = 0.0
    comprehension_drift: float = 0.0
    sustained_overload_seconds: int = 0
    sustained_skimming_seconds: int = 0

    # Decision & Output Artifacts
    decision: PedagogicalDecision = "CONTINUE"
    adaptation_result: Optional[ContentAdaptation] = None
    speed_check_result: Optional[SpeedCheckQuestion] = None
    node_trace: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class LearnerAgentState(TypedDict):
    """
    LangGraph-compatible state container.
    Passed sequentially across nodes in the multi-agent orchestration loop.
    """

    learner_id: str
    chunk_id: str
    lesson_id: str
    chunk_content: str
    chunk_title: Optional[str]
    flesch_kincaid_grade: float
    target_dwell_ms: int

    current_tick: Dict[str, Any]
    current_evaluation: Dict[str, Any]
    telemetry_history: List[Dict[str, Any]]

    window_mean_bcs: float
    comprehension_drift: float
    sustained_overload_seconds: int
    sustained_skimming_seconds: int

    decision: PedagogicalDecision
    adaptation_result: Optional[Dict[str, Any]]
    speed_check_result: Optional[Dict[str, Any]]
    node_trace: List[str]
    error: Optional[str]

