import pytest
from app.ml.scoring import (
    BCSEngine,
    ChunkContext,
    ChunkTelemetryTick,
    CognitiveState,
    LearnerContext,
)


def test_bcs_optimal_reading_dwell():
    """Verify high comprehension score when dwell time matches target baseline."""
    chunk = ChunkContext(target_dwell_ms=30000, flesch_kincaid_grade=8.0, word_count=110)
    learner = LearnerContext(wpm=220.0, regression_tolerance_ratio=0.15)
    telemetry = ChunkTelemetryTick(
        chunk_id="chunk-1",
        lesson_id="lesson-1",
        dwell_time_ms=31000,
        active_dwell_time_ms=30000,
        scroll_up_regressions=0,
        text_highlights_count=1,
        code_copies_count=0,
    )

    evaluation = BCSEngine.evaluate(telemetry, chunk, learner)

    assert evaluation.cognitive_state == CognitiveState.OPTIMAL
    assert evaluation.score >= 0.75
    assert not evaluation.requires_speed_check
    assert not evaluation.requires_adaptation


def test_bcs_skimming_detection():
    """Verify that dangerously low dwell time triggers SKIMMING state and speed-check requirement."""
    chunk = ChunkContext(target_dwell_ms=30000, flesch_kincaid_grade=8.0, word_count=110)
    learner = LearnerContext(wpm=220.0)
    # Student spends only 4 seconds on a 30-second chunk
    telemetry = ChunkTelemetryTick(
        chunk_id="chunk-2",
        lesson_id="lesson-1",
        dwell_time_ms=4000,
        active_dwell_time_ms=4000,
        scroll_up_regressions=0,
    )

    evaluation = BCSEngine.evaluate(telemetry, chunk, learner)

    assert evaluation.cognitive_state == CognitiveState.SKIMMING
    assert evaluation.dwell_ratio < 0.42
    assert evaluation.requires_speed_check is True
    assert evaluation.requires_adaptation is False


def test_bcs_overload_detection_with_regressions():
    """Verify that excessive dwell coupled with high scroll regressions triggers OVERLOADED state."""
    chunk = ChunkContext(target_dwell_ms=25000, flesch_kincaid_grade=11.0, word_count=90)
    learner = LearnerContext(wpm=220.0, regression_tolerance_ratio=0.10)
    # Student spends 65 seconds with 8 upward scroll regressions
    telemetry = ChunkTelemetryTick(
        chunk_id="chunk-3",
        lesson_id="lesson-1",
        dwell_time_ms=65000,
        active_dwell_time_ms=65000,
        scroll_up_regressions=8,
    )

    evaluation = BCSEngine.evaluate(telemetry, chunk, learner)

    assert evaluation.cognitive_state == CognitiveState.OVERLOADED
    assert evaluation.requires_adaptation is True
    assert evaluation.regression_penalty > 0.0

