import hashlib
import io
import logging
import re
from typing import Literal, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import Field

from app.ml.ablation import TfidfLsaChunker
from app.ml.chunker import BaseChunker, SemanticWindowChunker
from app.models.content import Lesson, SemanticChunk, TrackTier
from app.schemas.base import AppBaseModel, ResponseEnvelope

logger = logging.getLogger("adaptived.byoc")
router = APIRouter()


class BYOCIngestionResult(AppBaseModel):
    """Structured response contract for dynamic BYOC uploads."""

    lesson_id: str
    slug: str
    title: str
    track_tier: TrackTier = TrackTier.BYOC_SANDBOX
    total_chunks: int
    total_words: int
    average_complexity: float
    chunking_strategy: str
    mean_cosine_similarity: float
    threshold_tau: float
    status_message: str


def _slugify(text: str) -> str:
    """Generates an SEO-safe URL slug from title."""
    cleaned = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", cleaned)


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text streams from PDF bytes with fallback."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        extracted = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted.append(text)
        return "\n\n".join(extracted)
    except ImportError:
        # Fallback heuristic stream reader for testing environments without pypdf
        text_stream = []
        for line in file_bytes.split(b"\n"):
            # Filter printable ASCII bytes
            printable = "".join(chr(b) for b in line if 32 <= b <= 126)
            if len(printable) > 20:
                text_stream.append(printable)
        return "\n".join(text_stream) if text_stream else "PDF content parsed into text."


@router.post("/byoc/upload", response_model=ResponseEnvelope[BYOCIngestionResult], tags=["BYOC"])
async def upload_byoc_content(
    file: UploadFile = File(..., description="Markdown (.md, .txt) or PDF file to calibrate."),
    title: str = Form(..., min_length=3, max_length=120),
    description: Optional[str] = Form(default="Custom uploaded material running in dynamic sandbox calibration."),
    chunker_strategy: Literal["semantic_neural", "tfidf_lsa"] = Form(
        default="semantic_neural",
        description="Chunking algorithm: 'semantic_neural' (all-MiniLM-L6-v2) or 'tfidf_lsa' (Week 4 baseline).",
    ),
    alpha: float = Form(default=0.80, ge=0.2, le=2.0),
    wpm_baseline: float = Form(default=220.0, ge=80.0, le=600.0),
) -> ResponseEnvelope[BYOCIngestionResult]:
    """
    Bring Your Own Content (BYOC) Ingestion Pipeline:
    1. Extracts raw text from Markdown or PDF bytes.
    2. Runs text through the selected sliding-window semantic chunker.
    3. Dynamically assigns Flesch-Kincaid complexity and target dwell baselines.
    4. Persists the new Lesson and SemanticChunks under TrackTier.BYOC_SANDBOX.
    """
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    filename = file.filename or "upload.txt"
    file_ext = filename.lower().split(".")[-1]

    # Extract text based on file format
    if file_ext == "pdf":
        raw_text = _extract_text_from_pdf(raw_bytes)
    else:
        try:
            raw_text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = raw_bytes.decode("latin-1", errors="replace")

    if len(raw_text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Extracted text is too short to construct semantic chunks (minimum 50 characters required).",
        )

    # Instantiate chosen chunking strategy
    chunker: BaseChunker
    if chunker_strategy == "tfidf_lsa":
        chunker = TfidfLsaChunker(n_components=40)
    else:
        chunker = SemanticWindowChunker(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # Execute dynamic mathematical chunking
    chunking_result = chunker.chunk_text(
        text=raw_text,
        window_size=3,
        alpha=alpha,
        wpm_baseline=wpm_baseline,
    )

    # Generate unique slug
    content_hash = hashlib.sha256(raw_bytes).hexdigest()[:8]
    slug = f"byoc-{_slugify(title)}-{content_hash}"

    # Calculate overall complexity metrics
    avg_complexity = (
        sum(c.flesch_kincaid_grade for c in chunking_result.chunks)
        / max(1, len(chunking_result.chunks))
    )

    # Persist Lesson Document
    lesson = Lesson(
        track_id="byoc-sandbox",
        track_tier=TrackTier.BYOC_SANDBOX,
        slug=slug,
        title=title,
        description=description or "Custom BYOC sandbox module.",
        order=0,
        estimated_duration_minutes=max(1, int(chunking_result.total_words / wpm_baseline)),
        prerequisites=[],
        total_chunks=chunking_result.total_chunks,
        total_words=chunking_result.total_words,
        average_complexity=round(avg_complexity, 2),
        source_filename=filename,
        source_checksum=content_hash,
    )
    await lesson.insert()

    # Persist Semantic Chunk Documents
    for c in chunking_result.chunks:
        chunk_doc = SemanticChunk(
            lesson_id=str(lesson.id),
            chunk_index=c.chunk_index,
            title=f"Section {c.chunk_index + 1}",
            content=c.content,
            sentence_count=c.sentence_count,
            word_count=c.word_count,
            flesch_kincaid_grade=c.flesch_kincaid_grade,
            target_dwell_ms=c.target_dwell_ms,
            boundary_cosine_drop=c.boundary_cosine_drop,
        )
        await chunk_doc.insert()

    result_payload = BYOCIngestionResult(
        lesson_id=str(lesson.id),
        slug=slug,
        title=title,
        track_tier=TrackTier.BYOC_SANDBOX,
        total_chunks=chunking_result.total_chunks,
        total_words=chunking_result.total_words,
        average_complexity=round(avg_complexity, 2),
        chunking_strategy=chunking_result.model_name,
        mean_cosine_similarity=chunking_result.mean_cosine_similarity,
        threshold_tau=chunking_result.threshold_tau,
        status_message=(
            f"Successfully ingested and calibrated '{title}' into {chunking_result.total_chunks} "
            f"semantic chunks via {chunking_result.model_name}."
        ),
    )

    return ResponseEnvelope(
        success=True,
        data=result_payload,
        message="BYOC content successfully calibrated and ready for reader.",
    )

