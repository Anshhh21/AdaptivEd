from datetime import datetime, timezone
from typing import Dict, List, Optional
from beanie import Document, Indexed
from pydantic import Field
from app.schemas.base import AppBaseModel


class CognitiveBaseline(AppBaseModel):
    """
    Mathematical behavioral baselines dynamically tuned for each learner.
    Used by scoring.py to normalize dwell times and comprehension thresholds.
    """

    wpm: float = Field(default=220.0, ge=80.0, le=600.0, description="Calibrated Words-Per-Minute.")
    average_dwell_per_token_ms: float = Field(
        default=272.7,
        description="Average millisecond dwell time per token (derived: (60,000 / WPM) / 1.3).",
    )
    attention_stability_index: float = Field(
        default=0.85, ge=0.0, le=1.0, description="Historical gaze/focus stability coefficient."
    )
    regression_tolerance_ratio: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        description="Normal expected upward re-reading frequency before penalty kicks in.",
    )


class TrackProgress(AppBaseModel):
    """Progress tracker per educational track (e.g. 'react-gold', 'nextjs-gold', 'byoc-sandbox')."""

    track_id: str
    completed_lesson_ids: List[str] = Field(default_factory=list)
    average_bcs: float = Field(default=0.0, ge=0.0, le=1.0)
    total_time_spent_seconds: int = Field(default=0, ge=0)
    current_lesson_id: Optional[str] = None
    last_accessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LearnerProfile(Document):
    """
    Primary MongoDB document representing a student's cognitive state,
    gamification markers, and longitudinal comprehension profile.
    """

    user_id: Indexed(str, unique=True)
    email: Indexed(str, unique=True)
    display_name: str
    password_hash: Optional[str] = None
    auth_provider: str = Field(default="email", description="'email' | 'google'")

    # Cognitive & Behavioral Calibration
    baseline: CognitiveBaseline = Field(default_factory=CognitiveBaseline)

    # Gamification, Velocity & Comprehension Level
    total_xp: int = Field(default=0, ge=0)
    current_streak_days: int = Field(default=0, ge=0)
    longest_streak_days: int = Field(default=0, ge=0)
    effective_learning_velocity: float = Field(
        default=1.0,
        description="Dynamic multiplier combining average BCS, consistency, and arena audits.",
    )
    percentile_rank: float = Field(
        default=50.0, ge=0.0, le=100.0, description="Cognitive Velocity League percentile rank."
    )

    # 1.0 - 10.0 Comprehension Rating & Adaptive Strategy
    comprehension_score: float = Field(
        default=6.5,
        ge=1.0,
        le=10.0,
        description="Dynamic cognitive comprehension score on 1.0 to 10.0 scale updated after each learning session.",
    )
    learning_strategy: str = Field(
        default="DIFFICULTY_FIRST",
        description="'DIFFICULTY_FIRST' (deep conceptual mastery) or 'TIME_FIRST' (rapid high-yield crash course).",
    )
    total_topics_learned: int = Field(default=0, ge=0)
    comprehension_history: List[dict] = Field(
        default_factory=list,
        description="Audit log of score deltas, dwell times, and accuracy per learned topic.",
    )

    # Learning Track Progressions
    tracks: Dict[str, TrackProgress] = Field(default_factory=dict)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "learner_profiles"
        indexes = [
            "user_id",
            "email",
            "percentile_rank",
            [("total_xp", -1)],
        ]

