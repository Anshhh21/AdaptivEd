from enum import Enum
import math
from typing import Optional
from pydantic import Field

from app.schemas.base import AppBaseModel


class CognitiveState(str, Enum):
    OPTIMAL = "OPTIMAL"          # High comprehension, healthy dwell, minimal regressions
    SKIMMING = "SKIMMING"        # Dangerously low dwell time relative to chunk word count
    OVERLOADED = "OVERLOADED"    # Excessive dwell + repeated upward re-reading regressions
    NEUTRAL = "NEUTRAL"          # Standard reading velocity within normal bounds


class ChunkTelemetryTick(AppBaseModel):
    """Real-time telemetric buffer sent from Next.js client for an active chunk."""

    chunk_id: str
    lesson_id: str
    dwell_time_ms: int = Field(ge=0, description="Total wall-clock duration on chunk.")
    active_dwell_time_ms: int = Field(
        ge=0, description="Active duration with fullscreen focus (excluding idle pauses)."
    )
    scroll_up_regressions: int = Field(
        default=0, ge=0, description="Count of upward scroll gestures (re-reading behavior)."
    )
    text_highlights_count: int = Field(
        default=0, ge=0, description="User text selection/highlight interactions."
    )
    code_copies_count: int = Field(
        default=0, ge=0, description="Code snippet copy events."
    )
    attention_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Local MediaPipe 2-FPS gaze/presence stability score (0.0 to 1.0).",
    )


class ChunkContext(AppBaseModel):
    """Pedagogical complexity metadata of the chunk under evaluation."""

    target_dwell_ms: int = Field(gt=0, description="Calibrated target dwell in milliseconds.")
    flesch_kincaid_grade: float = Field(default=8.0, ge=1.0, le=20.0)
    word_count: int = Field(gt=0)


class LearnerContext(AppBaseModel):
    """Personalized baseline characteristics of the active learner."""

    wpm: float = Field(default=220.0, ge=80.0, le=600.0)
    regression_tolerance_ratio: float = Field(default=0.15, ge=0.0, le=1.0)
    attention_stability_index: float = Field(default=0.85, ge=0.0, le=1.0)


class BCSEvaluation(AppBaseModel):
    """Full mathematical breakdown of the Behavioral Comprehension Score."""

    score: float = Field(ge=0.0, le=1.0, description="Final composite BCS (0.0 to 1.0).")
    dwell_ratio: float = Field(description="Ratio of active dwell to target dwell.")
    raw_comprehension: float = Field(ge=0.0, le=1.0)
    regression_penalty: float = Field(ge=0.0, le=1.0)
    attention_modifier: float = Field(ge=0.0, le=1.0)
    cognitive_state: CognitiveState
    requires_speed_check: bool = Field(
        default=False, description="True if skimming warrants an inline speed-check question."
    )
    requires_adaptation: bool = Field(
        default=False, description="True if overload warrants diagrammatic or bullet adaptation."
    )


class BCSEngine:
    """
    Mathematical Behavioral Comprehension Scoring Engine.
    Evaluates real-time DOM telemetry against readability baselines to diagnose cognitive states.
    """

    # Model Hyperparameters
    DWELL_SPREAD_SIGMA: float = 0.45
    BASE_REGRESSION_PENALTY_WEIGHT: float = 0.12
    SKIMMING_RATIO_CUTOFF: float = 0.42
    OVERLOAD_RATIO_CUTOFF: float = 2.10

    @classmethod
    def evaluate(
        cls,
        telemetry: ChunkTelemetryTick,
        chunk: ChunkContext,
        learner: LearnerContext,
    ) -> BCSEvaluation:
        """
        Calculates the Behavioral Comprehension Score (BCS):
        1. Normalizes dwell time against target dwell adjusted for Flesch-Kincaid complexity.
        2. Computes the log-normal reading comprehension curve.
        3. Penalizes upward scroll regressions beyond the learner's tolerance threshold.
        4. Applies attention modifier if MediaPipe vision data is present.
        5. Emits the classified CognitiveState and pedagogical triggers.
        """
        # Step 1: Complexity-adjusted target dwell
        # High Flesch-Kincaid grade expands expected reading duration
        complexity_scale = 1.0 + max(0.0, (chunk.flesch_kincaid_grade - 8.0) * 0.04)
        adjusted_target_ms = max(1000.0, chunk.target_dwell_ms * complexity_scale)

        # Step 2: Dwell ratio (Active Dwell / Adjusted Target)
        dwell_ratio = telemetry.active_dwell_time_ms / adjusted_target_ms

        # Step 3: Raw comprehension curve using log-normal distribution
        # Peak comprehension (1.0) is centered around dwell_ratio = 1.0
        if dwell_ratio <= 0.01:
            raw_comp = 0.0
        else:
            log_ratio = math.log(dwell_ratio)
            raw_comp = math.exp(-((log_ratio) ** 2) / (2 * (cls.DWELL_SPREAD_SIGMA**2)))

        # Step 4: Scroll Regression Penalty
        # Expected natural regressions based on word count & learner baseline
        expected_regressions = max(
            1.0, (chunk.word_count / 120.0) * learner.regression_tolerance_ratio
        )
        excess_regressions = max(0.0, telemetry.scroll_up_regressions - expected_regressions)
        regression_penalty = min(
            0.50, excess_regressions * cls.BASE_REGRESSION_PENALTY_WEIGHT
        )

        # Step 5: Code interactions & highlights bonus (slight cognitive engagement boost)
        engagement_boost = 0.0
        if telemetry.text_highlights_count > 0:
            engagement_boost += min(0.05, telemetry.text_highlights_count * 0.02)
        if telemetry.code_copies_count > 0:
            engagement_boost += 0.05

        # Step 6: Attention modifier (MediaPipe webcam gaze local score)
        if telemetry.attention_score is not None:
            attention_modifier = 0.60 + (0.40 * telemetry.attention_score)
        else:
            attention_modifier = 1.0

        # Step 7: Final composite BCS calculus
        penalized_comp = max(0.0, raw_comp - regression_penalty + engagement_boost)
        final_bcs = max(0.0, min(1.0, penalized_comp * attention_modifier))

        # Step 8: Cognitive State Classification
        if dwell_ratio < cls.SKIMMING_RATIO_CUTOFF:
            cognitive_state = CognitiveState.SKIMMING
            requires_speed_check = True
            requires_adaptation = False
        elif (
            dwell_ratio > cls.OVERLOAD_RATIO_CUTOFF
            and (telemetry.scroll_up_regressions > expected_regressions * 1.8 or final_bcs < 0.50)
        ):
            cognitive_state = CognitiveState.OVERLOADED
            requires_speed_check = False
            requires_adaptation = True
        elif final_bcs >= 0.72 and 0.65 <= dwell_ratio <= 1.70:
            cognitive_state = CognitiveState.OPTIMAL
            requires_speed_check = False
            requires_adaptation = False
        else:
            cognitive_state = CognitiveState.NEUTRAL
            requires_speed_check = False
            requires_adaptation = False

        return BCSEvaluation(
            score=round(final_bcs, 4),
            dwell_ratio=round(dwell_ratio, 4),
            raw_comprehension=round(raw_comp, 4),
            regression_penalty=round(regression_penalty, 4),
            attention_modifier=round(attention_modifier, 4),
            cognitive_state=cognitive_state,
            requires_speed_check=requires_speed_check,
            requires_adaptation=requires_adaptation,
        )

