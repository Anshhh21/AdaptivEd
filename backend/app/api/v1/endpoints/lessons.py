from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models.content import Lesson, SemanticChunk, TrackTier
from app.schemas.base import ResponseEnvelope

router = APIRouter()


@router.get("/lessons", response_model=ResponseEnvelope[List[Lesson]], tags=["Lessons"])
async def list_lessons(
    track_id: Optional[str] = Query(default=None, description="Filter by track identifier."),
    track_tier: Optional[TrackTier] = Query(default=None, description="Filter by GOLD or BYOC_SANDBOX."),
) -> ResponseEnvelope[List[Lesson]]:
    """
    Retrieves all curriculum lessons, optionally filtered by track or tier.
    """
    query = {}
    if track_id:
        query["track_id"] = track_id
    if track_tier:
        query["track_tier"] = track_tier

    lessons = await Lesson.find(query).sort("+order").to_list()
    return ResponseEnvelope(
        success=True,
        data=lessons,
        message=f"Retrieved {len(lessons)} curriculum lessons.",
    )


@router.get("/lessons/{slug}", response_model=ResponseEnvelope[dict], tags=["Lessons"])
async def get_lesson_with_chunks(slug: str) -> ResponseEnvelope[dict]:
    """
    Retrieves a complete lesson module and its ordered semantic chunks for the active reader.
    """
    lesson = await Lesson.find_one(Lesson.slug == slug)
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson with slug '{slug}' not found.",
        )

    chunks = await SemanticChunk.find(
        SemanticChunk.lesson_id == str(lesson.id)
    ).sort("+chunk_index").to_list()

    return ResponseEnvelope(
        success=True,
        data={
            "lesson": lesson,
            "chunks": chunks,
        },
        message=f"Loaded lesson '{lesson.title}' with {len(chunks)} chunks.",
    )


@router.post("/lessons/seed", response_model=ResponseEnvelope[dict], tags=["Lessons"])
async def trigger_gold_tracks_seed() -> ResponseEnvelope[dict]:
    """
    Deprecated: The platform is 100% universal AI ingestion driven via /api/v1/byoc/upload.
    """
    return ResponseEnvelope(
        success=True,
        data={"seeded_count": 0},
        message="Pre-calibrated tracks deprecated. Use universal AI Ingestion (/api/v1/byoc/upload).",
    )

