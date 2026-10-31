from typing import Optional
from fastapi import APIRouter, Query
from app.gamification.league import LeagueService, LeagueSummary, PercentileBadge
from app.schemas.base import ResponseEnvelope

router = APIRouter()


@router.get("/leaderboard", response_model=ResponseEnvelope[LeagueSummary], tags=["Gamification"])
async def get_weekly_league_leaderboard(
    user_id: Optional[str] = Query(default=None, description="Optional active learner ID to compute standing."),
    limit: int = Query(default=20, ge=1, le=100),
) -> ResponseEnvelope[LeagueSummary]:
    """
    Returns the Cognitive Velocity League standings and cohort percentiles.
    """
    summary = await LeagueService.get_cohort_leaderboard(current_user_id=user_id, limit=limit)
    return ResponseEnvelope(
        success=True,
        data=summary,
        message=f"Retrieved standings for {summary.cohort_name}.",
    )


@router.get("/leaderboard/badge", response_model=ResponseEnvelope[PercentileBadge], tags=["Gamification"])
async def get_percentile_badge(
    percentile: float = Query(default=94.0, ge=0.0, le=100.0),
    track_title: str = Query(default="Next.js Server Actions"),
) -> ResponseEnvelope[PercentileBadge]:
    """
    Computes a personalized percentile achievement badge.
    """
    badge = LeagueService.generate_badge(percentile=percentile, track_title=track_title)
    return ResponseEnvelope(
        success=True,
        data=badge,
        message=f"Generated badge: {badge.badge_title}",
    )

