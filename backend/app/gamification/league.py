import logging
from typing import List, Optional
from pydantic import Field

from app.models.learner import LearnerProfile
from app.schemas.base import AppBaseModel

logger = logging.getLogger("adaptived.gamification.league")


class LeaderboardEntry(AppBaseModel):
    """Ranked learner entry in the Cognitive Velocity League."""

    rank: int = Field(ge=1)
    user_id: str
    display_name: str
    total_xp: int
    streak_days: int
    effective_learning_velocity: float
    percentile_rank: float
    is_verified: bool = False


class PercentileBadge(AppBaseModel):
    """Dynamic percentile badge comparing learner performance against the cohort."""

    percentile: float = Field(ge=0.0, le=100.0)
    badge_title: str
    headline: str
    description: str
    accent_tier: str = Field(description="'DIAMOND' | 'PLATINUM' | 'GOLD' | 'SILVER'")


class LeagueSummary(AppBaseModel):
    """Top-level view of the current weekly league cohort."""

    cohort_name: str = "Cognitive Velocity League: Emerald Tier"
    total_active_learners: int
    top_entries: List[LeaderboardEntry]
    active_user_standing: Optional[LeaderboardEntry] = None
    personalized_badge: Optional[PercentileBadge] = None


class LeagueService:
    """
    Cognitive Velocity League computation service.
    Ranks learners using Effective Learning Velocity (ELV) combining BCS, streak consistency, and arena audits.
    """

    @classmethod
    def compute_elv(cls, average_bcs: float, streak_days: int, arena_score: float) -> float:
        """
        Calculates Effective Learning Velocity:
        ELV = (Avg_BCS * 0.40) + (min(1.0, streak / 30) * 0.20) + ((ArenaScore / 100) * 0.40)
        """
        bcs_factor = max(0.0, min(1.0, average_bcs)) * 0.40
        streak_factor = min(1.0, streak_days / 30.0) * 0.20
        arena_factor = (max(0.0, min(100.0, arena_score)) / 100.0) * 0.40

        # Normalizes to a 1.0 baseline multiplier (scaled between 0.2 and 2.5)
        raw_velocity = (bcs_factor + streak_factor + arena_factor) * 2.0
        return round(max(0.2, min(2.5, raw_velocity)), 2)

    @classmethod
    def generate_badge(cls, percentile: float, track_title: str = "Modern Engineering") -> PercentileBadge:
        """Constructs motivational percentile copy based on ranked percentile."""
        p_int = int(round(percentile))

        if percentile >= 95.0:
            return PercentileBadge(
                percentile=percentile,
                badge_title="Diamond Tier: Velocity Elite",
                headline=f"Top {100 - p_int}% Cognitive Velocity",
                description=f"You mastered {track_title} faster and with higher behavioral comprehension than {p_int}% of developers this week.",
                accent_tier="DIAMOND",
            )
        elif percentile >= 80.0:
            return PercentileBadge(
                percentile=percentile,
                badge_title="Platinum Tier: High-Efficiency Master",
                headline=f"Top {100 - p_int}% Comprehension",
                description=f"You completed concepts with higher focus stability and fewer regressions than {p_int}% of learners.",
                accent_tier="PLATINUM",
            )
        elif percentile >= 60.0:
            return PercentileBadge(
                percentile=percentile,
                badge_title="Gold Tier: Consistent Performer",
                headline="Above Cohort Average",
                description=f"Outperforming {p_int}% of learners with consistent streak progression.",
                accent_tier="GOLD",
            )
        else:
            return PercentileBadge(
                percentile=percentile,
                badge_title="Silver Tier: Steady Apprentice",
                headline="Active Accelerator",
                description="Keep your fullscreen focus locked to accelerate into the Top 20%.",
                accent_tier="SILVER",
            )

    @classmethod
    async def get_cohort_leaderboard(
        cls, current_user_id: Optional[str] = None, limit: int = 20
    ) -> LeagueSummary:
        """
        Calculates cohort percentiles and returns ranked leaderboard entries.
        """
        try:
            # Query top learners sorted by XP descending
            profiles = await LearnerProfile.find().sort("-total_xp").limit(limit).to_list()
            total_learners = await LearnerProfile.count()
        except Exception as exc:
            logger.warning(f"Failed to query learner profiles from MongoDB: {exc}")
            profiles = []
            total_learners = 0

        # Provide deterministic mock roster if database is empty or running offline demo
        if not profiles:
            mock_entries = [
                LeaderboardEntry(
                    rank=1,
                    user_id="dev-alex-99",
                    display_name="Alex Rivera",
                    total_xp=4250,
                    streak_days=18,
                    effective_learning_velocity=2.15,
                    percentile_rank=99.2,
                    is_verified=True,
                ),
                LeaderboardEntry(
                    rank=2,
                    user_id="dev-sarah-k",
                    display_name="Sarah Chen",
                    total_xp=3800,
                    streak_days=14,
                    effective_learning_velocity=1.92,
                    percentile_rank=96.5,
                    is_verified=True,
                ),
                LeaderboardEntry(
                    rank=3,
                    user_id="dev-marcus",
                    display_name="Marcus Vance",
                    total_xp=3100,
                    streak_days=9,
                    effective_learning_velocity=1.74,
                    percentile_rank=91.0,
                    is_verified=False,
                ),
            ]
            badge = cls.generate_badge(94.0, "React 19 Fiber Architecture")
            return LeagueSummary(
                total_active_learners=1420,
                top_entries=mock_entries,
                active_user_standing=mock_entries[0],
                personalized_badge=badge,
            )

        entries: List[LeaderboardEntry] = []
        user_standing: Optional[LeaderboardEntry] = None

        for idx, p in enumerate(profiles):
            rank = idx + 1
            # Calculate percentile rank
            percentile = round(((total_learners - rank) / max(1, total_learners)) * 100.0, 1)

            entry = LeaderboardEntry(
                rank=rank,
                user_id=p.user_id,
                display_name=p.display_name,
                total_xp=p.total_xp,
                streak_days=p.current_streak_days,
                effective_learning_velocity=p.effective_learning_velocity,
                percentile_rank=percentile,
                is_verified=p.total_xp >= 1500,
            )
            entries.append(entry)

            if current_user_id and p.user_id == current_user_id:
                user_standing = entry

        target_percentile = user_standing.percentile_rank if user_standing else 88.0
        badge = cls.generate_badge(target_percentile, "Next.js 15 Server Actions")

        return LeagueSummary(
            total_active_learners=max(len(entries), total_learners),
            top_entries=entries,
            active_user_standing=user_standing,
            personalized_badge=badge,
        )

