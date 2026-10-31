from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Union
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from app.schemas.base import AppBaseModel


class TrackTier(str, Enum):
    GOLD = "GOLD"  # Pre-calibrated high-precision engineering track
    BYOC_SANDBOX = "BYOC_SANDBOX"  # Dynamically chunked user upload


class ContentAdaptation(AppBaseModel):
    """
    Cached output of LangGraph ContentAdapterNode for a specific cognitive condition.
    Enables instant (<15ms) retrieval when subsequent learners experience similar overload.
    """

    adaptation_type: str = Field(
        description="Type of transformation: 'OVERLOAD_SIMPLIFIED', 'ANALOGY_DIAGRAM', etc."
    )
    simplified_markdown: str
    mermaid_diagram: Optional[str] = None
    code_annotations: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SpeedCheckQuestion(AppBaseModel):
    """
    Inline single-question conceptual speed-check injected if skimming behavior is triggered.
    """

    question: str
    options: List[str]
    correct_option_index: int = Field(ge=0, le=3)
    explanation: str


class SemanticChunk(Document):
    """
    Atomic pedagogical unit derived from our 3-sentence sliding window chunker.
    Stores lexical complexity metrics and cached dynamic morphing outputs.
    """

    id: Optional[Union[PydanticObjectId, str]] = None
    chunk_id: Optional[str] = None
    lesson_id: Indexed(str)
    chunk_index: int = Field(ge=0, description="0-indexed position within the lesson.")
    title: Optional[str] = None
    content: str = Field(description="Raw markdown content of the chunk.")
    sentence_count: int = Field(ge=1, description="Number of sentences in this chunk.")
    word_count: int = Field(ge=1, description="Total word count.")

    # Complexity & Read-Time Baselines
    flesch_kincaid_grade: float = Field(
        default=8.0, description="Readability grade level used for mathematical dwell calibration."
    )
    target_dwell_ms: int = Field(
        description="Target reading time in milliseconds based on standard 220 WPM baseline."
    )

    # Chunker Ablation Metadata
    boundary_cosine_drop: Optional[float] = Field(
        default=None, description="Similarity drop magnitude that triggered this chunk boundary."
    )

    # Skimming speed-check fallback
    speed_check: Optional[SpeedCheckQuestion] = None

    # Cached adaptations keyed by condition hash (e.g., 'OVERLOADED_V1')
    cached_adaptations: Dict[str, ContentAdaptation] = Field(default_factory=dict)

    class Settings:
        name = "semantic_chunks"
        indexes = [
            [("lesson_id", 1), ("chunk_index", 1)],
        ]


class Lesson(Document):
    """
    Educational module comprising ordered semantic chunks.
    Supports verified Gold Tracks and dynamic Bring Your Own Content (BYOC) sandboxes.
    """

    track_id: Indexed(str)
    track_tier: TrackTier = Field(default=TrackTier.GOLD)
    slug: Indexed(str, unique=True)
    title: str
    description: str
    order: int = Field(ge=0)
    estimated_duration_minutes: int = Field(ge=1)
    prerequisites: List[str] = Field(default_factory=list)

    # Pre-computed chunk summary metadata
    total_chunks: int = Field(default=0, ge=0)
    total_words: int = Field(default=0, ge=0)
    average_complexity: float = Field(default=8.0)

    # BYOC source traceability
    source_filename: Optional[str] = None
    source_checksum: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "lessons"
        indexes = [
            "track_id",
            "slug",
            "track_tier",
            [("track_id", 1), ("order", 1)],
        ]

