from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import Field, HttpUrl
from app.schemas.base import AppBaseModel


class SecurityFinding(AppBaseModel):
    """Flags critical security violations or sensitive credential leaks."""

    severity: str = Field(description="'HIGH' | 'MEDIUM' | 'LOW'")
    file_path: str
    description: str
    line_number: Optional[int] = None


class CodeQualityMetric(AppBaseModel):
    """Granular engineering metric scored out of 100."""

    name: str
    score: float = Field(ge=0.0, le=100.0)
    benchmark_standard: str
    findings: List[str] = Field(default_factory=list)


class RepoAuditReport(AppBaseModel):
    """Tactic 1: Comprehensive GitHub repository AST & static architecture analysis."""

    repo_url: str
    total_files_analyzed: int
    modularity_score: float = Field(ge=0.0, le=100.0)
    hook_architecture_score: float = Field(ge=0.0, le=100.0)
    state_purity_score: float = Field(ge=0.0, le=100.0)
    composite_code_score: float = Field(ge=0.0, le=100.0)
    metrics: List[CodeQualityMetric] = Field(default_factory=list)
    security_findings: List[SecurityFinding] = Field(default_factory=list)
    key_files_detected: List[str] = Field(default_factory=list)


class VercelDeploymentReport(AppBaseModel):
    """Tactic 2: Live hosted production deployment audit."""

    deployment_url: str
    is_live: bool
    http_status: int
    latency_ms: float
    has_https: bool
    has_security_headers: bool
    open_graph_valid: bool
    status_summary: str


class ArchitecturalVivaQuestion(AppBaseModel):
    """Tactic 3: Timed, fullscreen oral defense question targeting submitted code."""

    question_id: str
    file_reference: str = Field(description="Exact filename referenced, e.g. 'hooks/useSession.ts'")
    line_reference: Optional[str] = Field(description="e.g. 'lines 24-41'")
    question: str
    rubric_guidelines: List[str]
    time_limit_seconds: int = 120


class VivaSubmission(AppBaseModel):
    """Student's submitted response to a viva defense question."""

    question_id: str
    answer_text: str


class VivaEvaluation(AppBaseModel):
    """Audited score of the viva defense."""

    question_id: str
    comprehension_score: float = Field(ge=0.0, le=100.0)
    is_vibe_coded_detected: bool = Field(
        description="True if student fails to explain their own code's architectural choices."
    )
    feedback: str


class ChaosChallenge(AppBaseModel):
    """Tactic 4: Live sabotage code snippet with an injected bug."""

    challenge_id: str
    title: str
    description: str
    file_name: str
    buggy_code: str
    bug_category: str = Field(description="'STALE_CLOSURE' | 'INFINITE_EFFECT' | 'UNINDEXED_QUERY'")
    hint: str


class ChaosVerificationResult(AppBaseModel):
    """Verification of student's Monaco code fix."""

    challenge_id: str
    is_resolved: bool
    tests_passed: int
    total_tests: int
    feedback: str


class ArenaSubmissionReport(AppBaseModel):
    """Composite evaluation report across all 4 Proof-of-Work Arena tactics."""

    submission_id: str
    user_id: str
    track_id: str
    github_report: RepoAuditReport
    deployment_report: VercelDeploymentReport
    viva_evaluations: List[VivaEvaluation]
    chaos_resolved: bool
    final_arena_score: float = Field(ge=0.0, le=100.0)
    is_verified_engineer: bool = Field(
        description="True if all 4 tactics pass with no vibe-coding flags."
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

