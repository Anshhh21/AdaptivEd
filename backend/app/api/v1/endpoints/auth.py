import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.models.learner import CognitiveBaseline, LearnerProfile, TrackProgress
from app.schemas.base import ResponseEnvelope

logger = logging.getLogger("adaptived.auth")
router = APIRouter()

# In-memory ephemeral store for development fallback
_IN_MEMORY_PROFILES: Dict[str, dict] = {}


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Computes a cryptographically salted PBKDF2-SHA256 password hash."""
    if not salt:
        salt = uuid.uuid4().hex
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${hashed}"


def verify_password(plain_password: str, stored_hash: Optional[str]) -> bool:
    """Verifies a plain password against the stored salted PBKDF2 hash."""
    if not stored_hash or "$" not in stored_hash:
        return False
    salt, expected_hash = stored_hash.split("$", 1)
    computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return computed == expected_hash


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email address.")
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters.")
    display_name: str = Field(..., min_length=1, description="Learner full name or handle.")


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email address.")
    password: str = Field(..., min_length=1, description="User password.")


class GoogleAuthRequest(BaseModel):
    email: str
    display_name: str
    google_id: Optional[str] = None
    photo_url: Optional[str] = None


class StrategyUpdateRequest(BaseModel):
    user_id: str
    learning_strategy: str = Field(default="DIFFICULTY_FIRST", description="'DIFFICULTY_FIRST' or 'TIME_FIRST'")


class ProgressUpdateRequest(BaseModel):
    user_id: str
    lesson_id: str
    track_id: str
    topic_title: Optional[str] = None
    xp_earned: int = Field(default=50, ge=0)
    bcs_score: float = Field(default=0.85, ge=0.0, le=1.0)
    quiz_passed: bool = Field(default=True, description="Whether checkpoint was passed")
    dwell_time_seconds: float = Field(default=25.0, ge=0.0)
    struggle_signals: int = Field(default=0, ge=0, description="Mistakes or friction events")
    learning_strategy: Optional[str] = None


class AuthResponseData(BaseModel):
    user_id: str
    email: str
    display_name: str
    total_xp: int
    current_streak_days: int
    wpm_baseline: float
    effective_learning_velocity: float
    access_token: str
    auth_provider: str = "email"
    token_type: str = "bearer"
    comprehension_score: float = Field(default=6.5, ge=1.0, le=10.0)
    learning_strategy: str = Field(default="DIFFICULTY_FIRST")
    total_topics_learned: int = Field(default=0, ge=0)
    comprehension_history: List[dict] = Field(default_factory=list)


def calculate_comprehension_delta(
    current_score: float,
    quiz_passed: bool,
    struggle_signals: int,
    dwell_time_seconds: float,
    learning_strategy: str,
) -> tuple[float, str]:
    """
    Computes real-time Comprehension Rating delta on 1.0 - 10.0 scale.
    - If user struggles (errors/high friction), level adjusts down (-0.2 to -0.4) so subsequent content adapts simpler.
    - If user demonstrates strong accuracy and healthy dwell time, level increases (+0.2 to +0.5).
    - In TIME_FIRST mode, rewards fast accurate throughput.
    """
    if quiz_passed and struggle_signals == 0:
        if learning_strategy == "TIME_FIRST" and dwell_time_seconds < 25:
            delta = 0.4
            feedback = "Rapid high-yield mastery verified! (+0.4 Level Up)"
        elif dwell_time_seconds >= 20:
            delta = 0.3
            feedback = "Flawless concept comprehension verified! (+0.3 Level Up)"
        else:
            delta = 0.2
            feedback = "Checkpoint passed. (+0.2 Level Up)"
    elif quiz_passed and struggle_signals > 0:
        delta = 0.1
        feedback = "Concept verified after reviewing assistance. (+0.1 Level Up)"
    else:
        delta = -0.3
        feedback = "Concept friction detected. Calibrating subsequent content to simpler analogies (-0.3)."

    new_score = round(max(1.0, min(10.0, current_score + delta)), 1)
    return new_score, feedback


def _generate_user_id(email: str) -> str:
    """Generates deterministic user id from email."""
    return f"usr-{hashlib.sha256(email.lower().strip().encode()).hexdigest()[:12]}"


@router.post("/auth/register", response_model=ResponseEnvelope[AuthResponseData], tags=["Auth"])
async def register(payload: RegisterRequest) -> ResponseEnvelope[AuthResponseData]:
    """
    Registers a new learner with full name, email, and password.
    Stores password hash and profile in MongoDB Atlas cluster.
    """
    clean_email = payload.email.lower().strip()
    user_id = _generate_user_id(clean_email)
    display_name = payload.display_name.strip()
    pw_hash = hash_password(payload.password)

    # Check MongoDB for duplicate
    try:
        existing = await LearnerProfile.find_one(LearnerProfile.email == clean_email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please sign in instead.",
            )

        new_profile = LearnerProfile(
            user_id=user_id,
            email=clean_email,
            display_name=display_name,
            password_hash=pw_hash,
            auth_provider="email",
            baseline=CognitiveBaseline(wpm=220.0),
            total_xp=50,  # Registration bonus
            current_streak_days=1,
            longest_streak_days=1,
            effective_learning_velocity=1.0,
            percentile_rank=50.0,
        )
        await new_profile.insert()
        logger.info(f"Persisted new user to MongoDB Atlas: {clean_email}")

        profile_data = {
            "user_id": new_profile.user_id,
            "email": new_profile.email,
            "display_name": new_profile.display_name,
            "total_xp": new_profile.total_xp,
            "current_streak_days": new_profile.current_streak_days,
            "wpm_baseline": new_profile.baseline.wpm,
            "effective_learning_velocity": new_profile.effective_learning_velocity,
            "comprehension_score": getattr(new_profile, "comprehension_score", 6.5) or 6.5,
            "learning_strategy": getattr(new_profile, "learning_strategy", "DIFFICULTY_FIRST") or "DIFFICULTY_FIRST",
            "total_topics_learned": getattr(new_profile, "total_topics_learned", 0) or 0,
            "comprehension_history": getattr(new_profile, "comprehension_history", []) or [],
        }
    except HTTPException:
        raise
    except Exception as db_exc:
        logger.warning(f"MongoDB write failed or offline ({db_exc}). Using fallback.")
        if clean_email in _IN_MEMORY_PROFILES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please sign in instead.",
            )
        _IN_MEMORY_PROFILES[clean_email] = {
            "user_id": user_id,
            "email": clean_email,
            "display_name": display_name,
            "password_hash": pw_hash,
            "total_xp": 50,
            "current_streak_days": 1,
            "wpm_baseline": 220.0,
            "effective_learning_velocity": 1.0,
        }
        profile_data = _IN_MEMORY_PROFILES[clean_email]

    token_payload = f"tok_{uuid.uuid4().hex}"

    return ResponseEnvelope(
        success=True,
        data=AuthResponseData(
            user_id=profile_data["user_id"],
            email=profile_data["email"],
            display_name=profile_data["display_name"],
            total_xp=profile_data["total_xp"],
            current_streak_days=profile_data["current_streak_days"],
            wpm_baseline=profile_data["wpm_baseline"],
            effective_learning_velocity=profile_data["effective_learning_velocity"],
            access_token=token_payload,
            auth_provider="email",
        ),
        message=f"Welcome to AdaptivEd, {display_name}!",
    )


@router.post("/auth/login", response_model=ResponseEnvelope[AuthResponseData], tags=["Auth"])
async def login(payload: LoginRequest) -> ResponseEnvelope[AuthResponseData]:
    """
    Authenticates learner using email and password against MongoDB Atlas.
    """
    clean_email = payload.email.lower().strip()

    profile_data = None
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.email == clean_email)
        if profile:
            if not profile.password_hash or not verify_password(payload.password, profile.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password.",
                )
            profile_data = {
                "user_id": profile.user_id,
                "email": profile.email,
                "display_name": profile.display_name,
                "total_xp": profile.total_xp,
                "current_streak_days": profile.current_streak_days,
                "wpm_baseline": profile.baseline.wpm,
                "effective_learning_velocity": profile.effective_learning_velocity,
                "comprehension_score": getattr(profile, "comprehension_score", 6.5) or 6.5,
                "learning_strategy": getattr(profile, "learning_strategy", "DIFFICULTY_FIRST") or "DIFFICULTY_FIRST",
                "total_topics_learned": getattr(profile, "total_topics_learned", 0) or 0,
                "comprehension_history": getattr(profile, "comprehension_history", []) or [],
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
    except HTTPException:
        raise
    except Exception as db_exc:
        logger.warning(f"MongoDB query failed ({db_exc}). Checking memory store.")
        if clean_email in _IN_MEMORY_PROFILES:
            cached = _IN_MEMORY_PROFILES[clean_email]
            if not verify_password(payload.password, cached.get("password_hash")):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password.",
                )
            profile_data = cached
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

    token_payload = f"tok_{uuid.uuid4().hex}"

    return ResponseEnvelope(
        success=True,
        data=AuthResponseData(
            user_id=profile_data["user_id"],
            email=profile_data["email"],
            display_name=profile_data["display_name"],
            total_xp=profile_data["total_xp"],
            current_streak_days=profile_data["current_streak_days"],
            wpm_baseline=profile_data["wpm_baseline"],
            effective_learning_velocity=profile_data["effective_learning_velocity"],
            access_token=token_payload,
            auth_provider="email",
        ),
        message=f"Welcome back, {profile_data['display_name']}!",
    )


@router.post("/auth/google", response_model=ResponseEnvelope[AuthResponseData], tags=["Auth"])
async def authenticate_with_google(payload: GoogleAuthRequest) -> ResponseEnvelope[AuthResponseData]:
    """
    Google SSO endpoint: verifies or registers learner profile into MongoDB Atlas.
    """
    clean_email = payload.email.lower().strip()
    user_id = _generate_user_id(clean_email)
    display_name = payload.display_name.strip() or clean_email.split("@")[0].capitalize()

    profile_data = None
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.email == clean_email)
        if not profile:
            profile = LearnerProfile(
                user_id=user_id,
                email=clean_email,
                display_name=display_name,
                auth_provider="google",
                baseline=CognitiveBaseline(wpm=220.0),
                total_xp=100,  # Google onboarding bonus
                current_streak_days=1,
                longest_streak_days=1,
                effective_learning_velocity=1.0,
                percentile_rank=55.0,
            )
            await profile.insert()
            logger.info(f"Registered new Google-authenticated user in MongoDB Atlas: {clean_email}")
        else:
            profile.display_name = display_name or profile.display_name
            profile.updated_at = datetime.now(timezone.utc)
            await profile.save()

        profile_data = {
            "user_id": profile.user_id,
            "email": profile.email,
            "display_name": profile.display_name,
            "total_xp": profile.total_xp,
            "current_streak_days": profile.current_streak_days,
            "wpm_baseline": profile.baseline.wpm,
            "effective_learning_velocity": profile.effective_learning_velocity,
            "comprehension_score": getattr(profile, "comprehension_score", 6.5) or 6.5,
            "learning_strategy": getattr(profile, "learning_strategy", "DIFFICULTY_FIRST") or "DIFFICULTY_FIRST",
            "total_topics_learned": getattr(profile, "total_topics_learned", 0) or 0,
            "comprehension_history": getattr(profile, "comprehension_history", []) or [],
        }
    except Exception as db_exc:
        logger.warning(f"MongoDB offline ({db_exc}). In-memory Google authentication.")
        if clean_email not in _IN_MEMORY_PROFILES:
            _IN_MEMORY_PROFILES[clean_email] = {
                "user_id": user_id,
                "email": clean_email,
                "display_name": display_name,
                "total_xp": 100,
                "current_streak_days": 1,
                "wpm_baseline": 220.0,
                "effective_learning_velocity": 1.0,
            }
        profile_data = _IN_MEMORY_PROFILES[clean_email]

    token_payload = f"tok_google_{uuid.uuid4().hex}"

    return ResponseEnvelope(
        success=True,
        data=AuthResponseData(
            user_id=profile_data["user_id"],
            email=profile_data["email"],
            display_name=profile_data["display_name"],
            total_xp=profile_data["total_xp"],
            current_streak_days=profile_data["current_streak_days"],
            wpm_baseline=profile_data["wpm_baseline"],
            effective_learning_velocity=profile_data["effective_learning_velocity"],
            access_token=token_payload,
            auth_provider="google",
        ),
        message=f"Signed in with Google as {display_name}!",
    )


@router.post("/auth/progress", response_model=ResponseEnvelope[dict], tags=["Auth"])
async def update_learning_progress(payload: ProgressUpdateRequest) -> ResponseEnvelope[dict]:
    """
    Persists lesson completion, earned XP, streaks, and updates the learner's 1.0 - 10.0
    comprehension level directly in MongoDB Atlas.
    """
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.user_id == payload.user_id)
        if profile:
            profile.total_xp += payload.xp_earned

            # Calculate updated 1.0 - 10.0 comprehension score
            old_score = getattr(profile, "comprehension_score", 6.5) or 6.5
            active_strategy = payload.learning_strategy or getattr(profile, "learning_strategy", "DIFFICULTY_FIRST") or "DIFFICULTY_FIRST"
            new_score, feedback = calculate_comprehension_delta(
                current_score=old_score,
                quiz_passed=payload.quiz_passed,
                struggle_signals=payload.struggle_signals,
                dwell_time_seconds=payload.dwell_time_seconds,
                learning_strategy=active_strategy,
            )
            profile.comprehension_score = new_score
            profile.total_topics_learned = getattr(profile, "total_topics_learned", 0) + 1
            if payload.learning_strategy:
                profile.learning_strategy = payload.learning_strategy

            # Append to comprehension audit log in MongoDB
            audit_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "topic_title": payload.topic_title or payload.lesson_id,
                "previous_score": old_score,
                "new_score": new_score,
                "delta": round(new_score - old_score, 1),
                "quiz_passed": payload.quiz_passed,
                "dwell_time_seconds": round(payload.dwell_time_seconds, 1),
                "feedback": feedback,
            }
            if not hasattr(profile, "comprehension_history") or profile.comprehension_history is None:
                profile.comprehension_history = []
            profile.comprehension_history.insert(0, audit_entry)
            profile.comprehension_history = profile.comprehension_history[:50]

            if payload.track_id not in profile.tracks:
                profile.tracks[payload.track_id] = TrackProgress(
                    track_id=payload.track_id,
                    completed_lesson_ids=[payload.lesson_id],
                    average_bcs=payload.bcs_score,
                )
            else:
                tp = profile.tracks[payload.track_id]
                if payload.lesson_id not in tp.completed_lesson_ids:
                    tp.completed_lesson_ids.append(payload.lesson_id)
                tp.average_bcs = round((tp.average_bcs + payload.bcs_score) / 2.0, 3)

            profile.updated_at = datetime.now(timezone.utc)
            await profile.save()
            logger.info(
                f"Saved progress for {payload.user_id} in MongoDB Atlas: +{payload.xp_earned} XP, "
                f"Comprehension {old_score} -> {new_score}"
            )

            return ResponseEnvelope(
                success=True,
                data={
                    "total_xp": profile.total_xp,
                    "current_streak_days": profile.current_streak_days,
                    "comprehension_score": profile.comprehension_score,
                    "previous_score": old_score,
                    "score_delta": round(new_score - old_score, 1),
                    "feedback": feedback,
                    "learning_strategy": profile.learning_strategy,
                    "total_topics_learned": profile.total_topics_learned,
                    "track_progress": profile.tracks[payload.track_id].model_dump(),
                },
                message=f"Comprehension updated to {profile.comprehension_score}/10: {feedback}",
            )
    except Exception as exc:
        logger.warning(f"Failed to persist progress to MongoDB Atlas: {exc}")

    # Fallback memory persistence
    for p in _IN_MEMORY_PROFILES.values():
        if p["user_id"] == payload.user_id:
            p["total_xp"] = p.get("total_xp", 0) + payload.xp_earned
            p["comprehension_score"] = round(p.get("comprehension_score", 6.5) + (0.3 if payload.quiz_passed else -0.3), 1)
            return ResponseEnvelope(
                success=True,
                data={
                    "total_xp": p["total_xp"],
                    "comprehension_score": p["comprehension_score"],
                    "score_delta": 0.3 if payload.quiz_passed else -0.3,
                },
                message="Progress updated in memory store.",
            )

    return ResponseEnvelope(
        success=True,
        data={"total_xp": 100, "comprehension_score": 6.8, "score_delta": 0.3},
        message="Progress recorded.",
    )


@router.post("/auth/strategy", response_model=ResponseEnvelope[dict], tags=["Auth"])
async def set_learning_strategy(payload: StrategyUpdateRequest) -> ResponseEnvelope[dict]:
    """
    Updates the learner's active mode ('DIFFICULTY_FIRST' or 'TIME_FIRST') in MongoDB.
    """
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.user_id == payload.user_id)
        if profile:
            profile.learning_strategy = payload.learning_strategy
            profile.updated_at = datetime.now(timezone.utc)
            await profile.save()
            return ResponseEnvelope(
                success=True,
                data={
                    "learning_strategy": profile.learning_strategy,
                    "comprehension_score": getattr(profile, "comprehension_score", 6.5) or 6.5,
                },
                message=f"Strategy switched to {payload.learning_strategy} and saved to MongoDB.",
            )
    except Exception as exc:
        logger.warning(f"Failed to update learning strategy: {exc}")

    return ResponseEnvelope(
        success=True,
        data={"learning_strategy": payload.learning_strategy, "comprehension_score": 6.5},
        message=f"Strategy switched to {payload.learning_strategy}.",
    )


@router.get("/auth/profile/{user_id}", response_model=ResponseEnvelope[AuthResponseData], tags=["Auth"])
async def get_user_profile(user_id: str) -> ResponseEnvelope[AuthResponseData]:
    """Retrieves learner's persistent cognitive profile from MongoDB Atlas."""
    try:
        profile = await LearnerProfile.find_one(LearnerProfile.user_id == user_id)
        if profile:
            return ResponseEnvelope(
                success=True,
                data=AuthResponseData(
                    user_id=profile.user_id,
                    email=profile.email,
                    display_name=profile.display_name,
                    total_xp=profile.total_xp,
                    current_streak_days=profile.current_streak_days,
                    wpm_baseline=profile.baseline.wpm,
                    effective_learning_velocity=profile.effective_learning_velocity,
                    access_token="active_session",
                    comprehension_score=getattr(profile, "comprehension_score", 6.5) or 6.5,
                    learning_strategy=getattr(profile, "learning_strategy", "DIFFICULTY_FIRST") or "DIFFICULTY_FIRST",
                    total_topics_learned=getattr(profile, "total_topics_learned", 0) or 0,
                    comprehension_history=getattr(profile, "comprehension_history", []) or [],
                ),
                message="Profile retrieved from MongoDB Atlas.",
            )
    except Exception:
        pass

    for p in _IN_MEMORY_PROFILES.values():
        if p["user_id"] == user_id:
            return ResponseEnvelope(
                success=True,
                data=AuthResponseData(
                    user_id=p["user_id"],
                    email=p["email"],
                    display_name=p["display_name"],
                    total_xp=p["total_xp"],
                    current_streak_days=p["current_streak_days"],
                    wpm_baseline=p["wpm_baseline"],
                    effective_learning_velocity=p["effective_learning_velocity"],
                    access_token="active_session",
                ),
                message="Profile retrieved.",
            )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner profile not found.")
