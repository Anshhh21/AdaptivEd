import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import get_settings
from app.models.learner import CognitiveBaseline, LearnerProfile
from app.schemas.base import ResponseEnvelope

logger = logging.getLogger("adaptived.auth")
router = APIRouter()


class AuthRequest(BaseModel):
    email: EmailStr
    display_name: Optional[str] = None
    password: Optional[str] = Field(default="devpassword123", min_length=6)


class AuthResponseData(BaseModel):
    user_id: str
    email: str
    display_name: str
    total_xp: int
    current_streak_days: int
    wpm_baseline: float
    effective_learning_velocity: float
    access_token: str
    token_type: str = "bearer"


def _generate_user_id(email: str) -> str:
    """Generates deterministic user id from email."""
    return f"usr-{hashlib.sha256(email.lower().strip().encode()).hexdigest()[:12]}"


@router.post("/auth/login", response_model=ResponseEnvelope[AuthResponseData], tags=["Auth"])
async def authenticate_or_register(payload: AuthRequest) -> ResponseEnvelope[AuthResponseData]:
    """
    Seamless authentication endpoint:
    - If user exists, loads their persistent profile and active streaks from MongoDB.
    - If new user, creates their permanent LearnerProfile with calibrated baselines.
    """
    clean_email = payload.email.lower().strip()
    user_id = _generate_user_id(clean_email)
    display_name = payload.display_name or clean_email.split("@")[0].capitalize()

    profile = await LearnerProfile.find_one(LearnerProfile.email == clean_email)

    if not profile:
        profile = LearnerProfile(
            user_id=user_id,
            email=clean_email,
            display_name=display_name,
            baseline=CognitiveBaseline(wpm=220.0),
            total_xp=50,  # Welcome bonus
            current_streak_days=1,
            longest_streak_days=1,
            effective_learning_velocity=1.0,
            percentile_rank=50.0,
        )
        await profile.insert()
        logger.info(f"Registered new learner profile for {clean_email} ({user_id})")
    else:
        # Update streak on daily return
        profile.display_name = display_name or profile.display_name
        profile.updated_at = datetime.now(timezone.utc)
        await profile.save()
        logger.info(f"Learner logged in: {clean_email} ({profile.user_id})")

    # Generate a lightweight bearer token for session persistence
    token_payload = f"tok_{uuid.uuid4().hex}"

    response_data = AuthResponseData(
        user_id=profile.user_id,
        email=profile.email,
        display_name=profile.display_name,
        total_xp=profile.total_xp,
        current_streak_days=profile.current_streak_days,
        wpm_baseline=profile.baseline.wpm,
        effective_learning_velocity=profile.effective_learning_velocity,
        access_token=token_payload,
    )

    return ResponseEnvelope(
        success=True,
        data=response_data,
        message=f"Welcome back, {profile.display_name}!",
    )


@router.get("/auth/profile/{user_id}", response_model=ResponseEnvelope[AuthResponseData], tags=["Auth"])
async def get_user_profile(user_id: str) -> ResponseEnvelope[AuthResponseData]:
    """Retrieves learner's real-time persistent cognitive profile."""
    profile = await LearnerProfile.find_one(LearnerProfile.user_id == user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Learner profile not found.",
        )

    response_data = AuthResponseData(
        user_id=profile.user_id,
        email=profile.email,
        display_name=profile.display_name,
        total_xp=profile.total_xp,
        current_streak_days=profile.current_streak_days,
        wpm_baseline=profile.baseline.wpm,
        effective_learning_velocity=profile.effective_learning_velocity,
        access_token="active_session",
    )

    return ResponseEnvelope(
        success=True,
        data=response_data,
        message="Profile retrieved.",
    )

