import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Body, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.arena.chaos import ChaosDebuggingEngine
from app.arena.deployment_audit import DeploymentAuditService
from app.arena.github_audit import GitHubAuditService
from app.arena.schemas import (
    ArchitecturalVivaQuestion,
    ArenaSubmissionReport,
    ChaosChallenge,
    ChaosVerificationResult,
    RepoAuditReport,
    VercelDeploymentReport,
    VivaEvaluation,
    VivaSubmission,
)
from app.arena.viva import VivaEngine
from app.models.learner import LearnerProfile
from app.schemas.base import ResponseEnvelope

logger = logging.getLogger("adaptived.arena.api")
router = APIRouter()


class RepoAuditRequest(BaseModel):
    repo_url: str = Field(description="Public GitHub repository URL.")


class DeploymentAuditRequest(BaseModel):
    deployment_url: str = Field(description="Live hosted production URL (e.g. *.vercel.app).")


class VivaGenerateRequest(BaseModel):
    repo_url: str
    key_files: List[str] = Field(default_factory=list)


class VivaEvaluateRequest(BaseModel):
    question: ArchitecturalVivaQuestion
    submission: VivaSubmission


class ChaosVerifyRequest(BaseModel):
    challenge_id: str
    fixed_code: str


class FullArenaSubmissionRequest(BaseModel):
    learner_id: str
    track_id: str
    github_report: RepoAuditReport
    deployment_report: VercelDeploymentReport
    viva_evaluations: List[VivaEvaluation]
    chaos_resolved: bool


@router.post("/arena/audit-repo", response_model=ResponseEnvelope[RepoAuditReport], tags=["Arena"])
async def audit_github_repository(payload: RepoAuditRequest) -> ResponseEnvelope[RepoAuditReport]:
    """Tactic 1: Zero-clone static AST & modularity audit of GitHub repository."""
    report = await GitHubAuditService.audit_repository(payload.repo_url)
    return ResponseEnvelope(
        success=True,
        data=report,
        message=f"Repository audit completed. Composite code score: {report.composite_code_score}/100",
    )


@router.post("/arena/audit-deployment", response_model=ResponseEnvelope[VercelDeploymentReport], tags=["Arena"])
async def audit_vercel_deployment(payload: DeploymentAuditRequest) -> ResponseEnvelope[VercelDeploymentReport]:
    """Tactic 2: Live production deployment, SSL/TLS, latency, and OpenGraph audit."""
    report = await DeploymentAuditService.audit_deployment(payload.deployment_url)
    return ResponseEnvelope(
        success=True,
        data=report,
        message=report.status_summary,
    )


@router.post("/arena/viva/generate", response_model=ResponseEnvelope[List[ArchitecturalVivaQuestion]], tags=["Arena"])
async def generate_viva_defense(payload: VivaGenerateRequest) -> ResponseEnvelope[List[ArchitecturalVivaQuestion]]:
    """Tactic 3: Generates 3 timed defense questions referencing candidate's exact files."""
    questions = await VivaEngine.generate_viva_questions(payload.key_files, payload.repo_url)
    return ResponseEnvelope(
        success=True,
        data=questions,
        message=f"Generated {len(questions)} timed architectural viva defense questions.",
    )


@router.post("/arena/viva/evaluate", response_model=ResponseEnvelope[VivaEvaluation], tags=["Arena"])
async def evaluate_viva_answer(payload: VivaEvaluateRequest) -> ResponseEnvelope[VivaEvaluation]:
    """Tactic 3: Grades candidate's oral defense to detect blind vibe-coding."""
    evaluation = await VivaEngine.evaluate_submission(payload.question, payload.submission)
    return ResponseEnvelope(
        success=True,
        data=evaluation,
        message=evaluation.feedback,
    )


@router.get("/arena/chaos/{track_id}", response_model=ResponseEnvelope[ChaosChallenge], tags=["Arena"])
async def get_chaos_challenge(track_id: str) -> ResponseEnvelope[ChaosChallenge]:
    """Tactic 4: Serves the track-specific live sabotage debugging challenge."""
    challenge = ChaosDebuggingEngine.get_challenge_for_track(track_id)
    return ResponseEnvelope(
        success=True,
        data=challenge,
        message=f"Retrieved chaos challenge: {challenge.title}",
    )


@router.post("/arena/chaos/verify", response_model=ResponseEnvelope[ChaosVerificationResult], tags=["Arena"])
async def verify_chaos_debugging(payload: ChaosVerifyRequest) -> ResponseEnvelope[ChaosVerificationResult]:
    """Tactic 4: Verifies student's Monaco code fix against sabotage criteria."""
    result = ChaosDebuggingEngine.verify_fix(payload.challenge_id, payload.fixed_code)
    return ResponseEnvelope(
        success=True,
        data=result,
        message=result.feedback,
    )


@router.post("/arena/submit", response_model=ResponseEnvelope[ArenaSubmissionReport], tags=["Arena"])
async def submit_arena_evaluation(payload: FullArenaSubmissionRequest) -> ResponseEnvelope[ArenaSubmissionReport]:
    """
    Final composite evaluation across all 4 Proof-of-Work Arena tactics.
    Calculates weighted composite score and awards the 'Verified Engineer' credential.
    """
    code_score = payload.github_report.composite_code_score
    deploy_score = 100.0 if payload.deployment_report.is_live else 0.0

    # Calculate average viva comprehension score
    viva_scores = [v.comprehension_score for v in payload.viva_evaluations]
    viva_avg = sum(viva_scores) / max(1, len(viva_scores))
    any_vibe_coded = any(v.is_vibe_coded_detected for v in payload.viva_evaluations)

    chaos_score = 100.0 if payload.chaos_resolved else 0.0

    # Weighted final calculus
    # 25% Code Modularity + 20% Live Deployment + 35% Viva Defense + 20% Chaos Debugging
    final_score = round(
        (0.25 * code_score) + (0.20 * deploy_score) + (0.35 * viva_avg) + (0.20 * chaos_score),
        1,
    )

    is_verified = (
        final_score >= 75.0
        and payload.deployment_report.is_live
        and payload.chaos_resolved
        and not any_vibe_coded
    )

    submission_id = f"arena-{uuid.uuid4().hex[:12]}"

    report = ArenaSubmissionReport(
        submission_id=submission_id,
        user_id=payload.learner_id,
        track_id=payload.track_id,
        github_report=payload.github_report,
        deployment_report=payload.deployment_report,
        viva_evaluations=payload.viva_evaluations,
        chaos_resolved=payload.chaos_resolved,
        final_arena_score=final_score,
        is_verified_engineer=is_verified,
    )

    # Update Learner Profile in MongoDB
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.user_id == payload.learner_id)
        if profile:
            # High XP award for completed Arena
            xp_boost = 500 if is_verified else 150
            profile.total_xp += xp_boost
            profile.effective_learning_velocity = round(min(3.0, profile.effective_learning_velocity + 0.25), 3)
            await profile.save()
            logger.info(f"Learner {payload.learner_id} completed Arena: +{xp_boost} XP, Verified={is_verified}")
    except Exception as exc:
        logger.warning(f"Could not update profile for {payload.learner_id}: {exc}")

    status_text = (
        f"Congratulations! You have been certified as a Verified Engineer in {payload.track_id}."
        if is_verified
        else f"Arena evaluation complete (Score: {final_score}/100). Review your viva or deployment findings to achieve full verification."
    )

    return ResponseEnvelope(
        success=True,
        data=report,
        message=status_text,
    )

