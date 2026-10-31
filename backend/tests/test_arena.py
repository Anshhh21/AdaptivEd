import pytest
from app.arena.chaos import ChaosDebuggingEngine
from app.arena.github_audit import GitHubAuditService
from app.arena.schemas import (
    ArchitecturalVivaQuestion,
    CodeQualityMetric,
    RepoAuditReport,
    VercelDeploymentReport,
    VivaEvaluation,
    VivaSubmission,
)
from app.arena.viva import VivaEngine


@pytest.mark.asyncio
async def test_github_audit_mock_report():
    """Verify GitHub audit calculates modularity, hook score, and composite code score."""
    report = await GitHubAuditService.audit_repository("https://github.com/mock-user/mock-react-app")
    assert report.modularity_score > 0
    assert report.hook_architecture_score > 0
    assert report.composite_code_score > 0
    assert len(report.metrics) >= 3


def test_chaos_debugging_stale_closure_verification():
    """Verify Chaos engine rejects broken code and accepts valid functional updater fix."""
    challenge_id = "chaos-react-stale-closure"

    # Incomplete fix (still broken)
    broken_fix = "setCount(count + 1);"
    result_fail = ChaosDebuggingEngine.verify_fix(challenge_id, broken_fix)
    assert not result_fail.is_resolved

    # Correct fix (functional state updater)
    valid_fix = "setCount((prev) => prev + 1);"
    result_pass = ChaosDebuggingEngine.verify_fix(challenge_id, valid_fix)
    assert result_pass.is_resolved


def test_chaos_debugging_mongodb_esr_verification():
    """Verify Chaos engine validates ESR rule ordering."""
    challenge_id = "chaos-mongodb-unindexed-sort"

    # Violates ESR (Range before Sort)
    bad_code = "createIndex({ amount: 1, status: 1, createdAt: -1 })"
    res_bad = ChaosDebuggingEngine.verify_fix(challenge_id, bad_code)
    assert not res_bad.is_resolved

    # Adheres to ESR (Equality first, Sort second, Range third)
    good_code = "createIndex({ status: 1, createdAt: -1, amount: 1 })"
    res_good = ChaosDebuggingEngine.verify_fix(challenge_id, good_code)
    assert res_good.is_resolved


@pytest.mark.asyncio
async def test_viva_defense_evaluation():
    """Verify viva engine catches hollow vibe-coding answers."""
    q = ArchitecturalVivaQuestion(
        question_id="viva-test-1",
        file_reference="hooks/useSession.ts",
        question="How does your implementation prevent stale closure captures?",
        rubric_guidelines=["Must mention dependency array or functional updater."],
    )

    # Vibe-coding hollow answer (<10 words)
    vibe_answer = VivaSubmission(question_id="viva-test-1", answer_text="It uses AI to optimize the code automatically.")
    evaluation_fail = await VivaEngine.evaluate_submission(q, vibe_answer)
    assert evaluation_fail.is_vibe_coded_detected

    # Technical answer
    technical_answer = VivaSubmission(
        question_id="viva-test-1",
        answer_text="We pass a functional updater callback to setCount to read the fresh state and memoize with useCallback.",
    )
    evaluation_pass = await VivaEngine.evaluate_submission(q, technical_answer)
    assert evaluation_pass.comprehension_score >= 70.0

