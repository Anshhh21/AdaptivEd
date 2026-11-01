import hashlib
import io
import json
import logging
import re
from typing import List, Literal, Optional
from bs4 import BeautifulSoup
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
import httpx
from pydantic import Field

from app.core.config import get_settings
from app.models.content import ContentAdaptation, Lesson, SemanticChunk, SpeedCheckQuestion, TrackTier
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
    status_message: str
    chunks: list = Field(default_factory=list)


class IngestUrlRequest(AppBaseModel):
    url: str
    title: Optional[str] = None
    user_level: float = 6.5
    learning_strategy: str = "DIFFICULTY_FIRST"


class IngestNotesRequest(AppBaseModel):
    raw_text: str
    title: Optional[str] = None
    user_level: float = 6.5
    learning_strategy: str = "DIFFICULTY_FIRST"


def _slugify(text: str) -> str:
    """Generates an SEO-safe URL slug from title."""
    cleaned = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", cleaned)


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text streams from PDF bytes."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        extracted = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted.append(text)
        return "\n\n".join(extracted)
    except Exception as e:
        logger.warning(f"pypdf extraction failed: {e}")
        return ""


def _extract_text_from_pptx(file_bytes: bytes) -> str:
    """Extracts text streams from PowerPoint PPTX presentation bytes."""
    try:
        from pptx import Presentation

        prs = Presentation(io.BytesIO(file_bytes))
        slides_text = []
        for idx, slide in enumerate(prs.slides):
            slide_parts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text:
                    slide_parts.append(shape.text.strip())
            if slide_parts:
                slides_text.append(f"--- Slide {idx + 1} ---\n" + "\n".join(slide_parts))
        return "\n\n".join(slides_text)
    except Exception as e:
        logger.warning(f"pptx extraction failed: {e}")
        return ""


async def _fetch_url_content(url: str) -> str:
    """Fetches and strips HTML content from an external web article/documentation page."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
            }
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text

        soup = BeautifulSoup(html, "html.parser")
        # Remove navigation, headers, scripts, styles, footers, ads
        for tag in soup(["script", "style", "nav", "footer", "aside", "header", "noscript", "svg"]):
            tag.decompose()

        main = (
            soup.find("main")
            or soup.find("article")
            or soup.find("div", {"id": "main"})
            or soup.find("div", {"class": "content"})
            or soup.body
        )
        return main.get_text(separator="\n", strip=True) if main else soup.get_text(separator="\n", strip=True)
    except Exception as e:
        logger.error(f"Failed to fetch content from URL '{url}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to scrape content from provided URL: {str(e)}",
        )


def _filter_boilerplate_regex(text: str) -> str:
    """Fallback heuristic filter to strip project cover pages, acknowledgments, and table of contents."""
    patterns = [
        r"(?i)submitted\s+by\s*:?.*?\n",
        r"(?i)submitted\s+to\s*:?.*?\n",
        r"(?i)acknowledgements?[\s\S]*?(?=\n\n|\n[A-Z0-9])",
        r"(?i)table\s+of\s+contents?[\s\S]*?(?=\n\n|\n[A-Z0-9])",
        r"(?i)certificate\s+of\s+completion[\s\S]*?(?=\n\n)",
        r"(?i)project\s+report\s+on\s*:?.*?\n",
        r"(?i)all\s+rights\s+reserved.*?\n",
        r"(?i)copyright\s+©.*?\n",
    ]
    cleaned = text
    for p in patterns:
        cleaned = re.sub(p, "", cleaned)
    return cleaned.strip()


async def _synthesize_with_gemini(
    raw_text: str,
    fallback_title: str,
    comprehension_level: float = 6.5,
    learning_strategy: str = "DIFFICULTY_FIRST",
) -> Optional[dict]:
    """Uses Google Gemini API to synthesize an in-depth curriculum adapted to learner's 1-10 level."""
    settings = get_settings()
    gemini_key = settings.GEMINI_API_KEY.get_secret_value()
    if not gemini_key or len(gemini_key) < 10:
        return None

    model_name = settings.GEMINI_MODEL
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"

    # Adaptive Strategy and Difficulty Directives based on user comprehension level
    if learning_strategy == "TIME_FIRST":
        pedagogical_calibration = (
            "LEARNER PROFILE: TIME-BASED RAPID CRASH COURSE (Surface-Level Fast Velocity)\n"
            "- The learner selected TIME-FIRST mode: prioritize high-yield clarity and speed over exhaustive depth.\n"
            "- Synthesize concise, punchy summaries (120-180 words per topic) with rapid mental models.\n"
            "- Include 1 clean, high-yield code snippet and 1 fast multiple choice checkpoint.\n"
        )
    elif comprehension_level < 5.0:
        pedagogical_calibration = (
            f"LEARNER PROFILE: FOUNDATIONAL / SIMPLIFIED COMPREHENSION (Level {comprehension_level:.1f}/10)\n"
            f"- The learner has a lower baseline score ({comprehension_level:.1f}/10) or encountered difficulty.\n"
            "- Explain concepts using everyday physical metaphors (switches, mailboxes, scoreboards, recipes).\n"
            "- Break down technical mechanisms into 3 simple, non-intimidating steps without jargon overload.\n"
            "- Include friendly, supportive multiple choice checkpoints to rebuild comprehension confidence.\n"
        )
    elif comprehension_level < 7.5:
        pedagogical_calibration = (
            f"LEARNER PROFILE: INTERMEDIATE PROFICIENCY (Level {comprehension_level:.1f}/10)\n"
            f"- The learner has standard competency (Level {comprehension_level:.1f}/10).\n"
            "- Provide balanced technical depth (250-350 words per topic) with clean architectural trade-offs.\n"
            "- Include practical production code examples with common pitfalls and standard checkpoints.\n"
        )
    else:
        pedagogical_calibration = (
            f"LEARNER PROFILE: ADVANCED / SENIOR ENGINEER (Level {comprehension_level:.1f}/10)\n"
            f"- The learner has high cognitive velocity and comprehension (Level {comprehension_level:.1f}/10).\n"
            "- DO NOT dumb down concepts. Provide rigorous, deep-dive architectural analysis.\n"
            "- Explain internal runtime execution, memory allocations, concurrency/event-loop scheduling, and edge cases.\n"
            "- Provide more challenging, in-depth questions to test true architectural discernment.\n"
        )

    system_instruction = (
        "You are the Principal AI Curriculum Architect for AdaptivEd, an advanced adaptive learning engine.\n"
        "Your task is to transform raw uploaded content (from a PDF, PPT, notes, or web page) into a high-caliber, "
        "topic-by-topic educational study course tailored to the learner's comprehension profile.\n\n"
        f"{pedagogical_calibration}\n"
        "STRICT FILTERING & PEDAGOGICAL DIRECTIVES:\n"
        "1. DISCARD ALL BOILERPLATE NOISE: Completely eliminate project title pages, student names, author info, "
        "acknowledgments, tables of contents, disclaimers, and university/organization headers.\n"
        "2. STRUCTURE INTO TOPICS: Synthesize the material into 3 to 6 logical, comprehensive study topics.\n"
        "3. EXPLAIN ACCORDING TO PROFILE: Write an explanation calibrated to the learner's profile above.\n"
        "4. JUDGE WHAT WAS LEARNT: For EACH topic, provide a Speed-Check multiple choice question testing true understanding.\n"
        "5. CODE FORMATTING: Whenever providing code examples, ALWAYS wrap code in standard markdown code fences with a language tag on a separate line (e.g. ```jsx\\n<code here>\\n```). "
        "Format code cleanly across multiple lines with standard indentation, NEVER output code as a single dense line.\n\n"
        "Return STRICTLY a JSON object matching this schema:\n"
        "{\n"
        '  "title": "string (Overall Course Title)",\n'
        '  "description": "string (Short high-level overview)",\n'
        '  "topics": [\n'
        "    {\n"
        '      "title": "string (Specific Topic Name)",\n'
        '      "content": "string (Calibrated explanation with markdown, code blocks, or diagrams)",\n'
        '      "speed_check": {\n'
        '        "question": "string (Conceptual question)",\n'
        '        "options": ["Option A", "Option B", "Option C", "Option D"],\n'
        '        "correct_option_index": 0,\n'
        '        "explanation": "string (Why this answer is correct)"\n'
        "      },\n"
        '      "mental_model": "string (2-sentence analogy or mental model)"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    prompt_text = f"{system_instruction}\n\nRAW EXTRACTED MATERIAL:\n\"\"\"{raw_text[:35000]}\"\"\""

    payload = {
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(api_url, json=payload)
            if resp.status_code == 200:
                result_json = resp.json()
                candidate_text = (
                    result_json.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if candidate_text:
                    parsed = json.loads(candidate_text)
                    if "topics" in parsed and len(parsed["topics"]) > 0:
                        logger.info(f"Google Gemini ({model_name}) successfully synthesized {len(parsed['topics'])} topics.")
                        return parsed
            else:
                logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text[:200]}")
    except Exception as exc:
        logger.warning(f"Gemini synthesis call failed ({exc}). Falling back to secondary engine.")

    return None


async def synthesize_curriculum_with_ai(
    raw_text: str,
    fallback_title: str,
    comprehension_level: float = 6.5,
    learning_strategy: str = "DIFFICULTY_FIRST",
) -> dict:
    """
    Tiered AI Curriculum Synthesis:
    Tier 1: Google Gemini (Calibrated to learner comprehension level 1.0 - 10.0 and strategy).
    Tier 2: Groq LPU (GPT-OSS / LLaMA-3.3-70B high-throughput inference).
    Tier 3: Heuristic Rule-Based Clean Splitter.
    """
    # 1. Attempt Primary: Google Gemini
    gemini_result = await _synthesize_with_gemini(
        raw_text=raw_text,
        fallback_title=fallback_title,
        comprehension_level=comprehension_level,
        learning_strategy=learning_strategy,
    )
    if gemini_result:
        return gemini_result

    # 2. Attempt Secondary: Groq Cloud
    settings = get_settings()
    api_key = settings.GROQ_API_KEY.get_secret_value()

    if not api_key or "placeholder" in api_key:
        logger.warning("Groq API key not configured. Using heuristic parsing fallback.")
        return _fallback_heuristic_synthesis(raw_text, fallback_title)

    from groq import Groq

    client = Groq(api_key=api_key)

    # Truncate raw input if extremely large to fit model context
    truncated_input = raw_text[:18000]

    system_prompt = (
        "You are the Principal AI Curriculum Architect for AdaptivEd, an advanced adaptive learning engine.\n"
        "Your task is to transform raw uploaded content (from a PDF, PPT, notes, or web page) into a high-caliber, "
        "topic-by-topic educational study course.\n\n"
        "STRICT FILTERING & PEDAGOGICAL DIRECTIVES:\n"
        "1. DISCARD ALL BOILERPLATE NOISE: Completely eliminate project title pages, student names, author info, "
        "acknowledgments, tables of contents, disclaimers, and university/organization headers.\n"
        "2. STRUCTURE INTO TOPICS: Synthesize the material into 3 to 6 logical, comprehensive study topics.\n"
        "3. EXPLAIN DEEPLY: For EACH topic, do not provide a superficial summary. Write an in-depth, thorough explanation "
        "(at least 200-350 words) that teaches the core mechanisms, includes practical code snippets or technical diagrams "
        "where appropriate, and clarifies common pitfalls.\n"
        "4. JUDGE WHAT WAS LEARNT: For EACH topic, provide a Speed-Check multiple choice question to test whether the "
        "student truly understood the material.\n"
        "5. CODE FORMATTING: Whenever providing code examples, ALWAYS wrap code in standard markdown code fences with a language tag on a separate line (e.g. ```jsx\\n<code here>\\n```). "
        "Format code cleanly across multiple lines with standard indentation, NEVER output code as a single dense line.\n\n"
        "Return STRICTLY a JSON object matching this schema:\n"
        "{\n"
        '  "title": "string (Overall Course Title)",\n'
        '  "description": "string (Short high-level overview)",\n'
        '  "topics": [\n'
        "    {\n"
        '      "title": "string (Specific Topic Name)",\n'
        '      "content": "string (In-depth explanation with markdown, code blocks, or diagrams)",\n'
        '      "speed_check": {\n'
        '        "question": "string (Conceptual question)",\n'
        '        "options": ["Option A", "Option B", "Option C", "Option D"],\n'
        '        "correct_option_index": 0,\n'
        '        "explanation": "string (Why this answer is correct)"\n'
        "      },\n"
        '      "mental_model": "string (2-sentence analogy or mental model)"\n'
        "    }\n"
        "  ]\n"
        "}\n"
    )

    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"RAW EXTRACTED MATERIAL:\n\"\"\"{truncated_input}\"\"\""},
            ],
            model=settings.GROQ_MODEL,
            response_format={"type": "json_object"},
            max_tokens=4096,
            temperature=0.2,
        )

        response_content = completion.choices[0].message.content
        data = json.loads(response_content)
        if "topics" in data and len(data["topics"]) > 0:
            logger.info(f"Groq AI successfully synthesized {len(data['topics'])} topics for '{data.get('title')}'")
            return data
    except Exception as exc:
        logger.error(f"Groq AI curriculum synthesis failed ({exc}). Falling back to heuristic parsing.")

    return _fallback_heuristic_synthesis(raw_text, fallback_title)


def _fallback_heuristic_synthesis(raw_text: str, fallback_title: str) -> dict:
    """Fallback rule-based synthesizer when AI model is unavailable or rate-limited."""
    cleaned = _filter_boilerplate_regex(raw_text)
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if len(p.strip()) > 60]

    topics = []
    chunk_size = 3
    for i in range(0, len(paragraphs), chunk_size):
        group = paragraphs[i : i + chunk_size]
        content = "\n\n".join(group)
        topic_title = f"Module {len(topics) + 1}: " + (group[0][:40] + "..." if len(group[0]) > 40 else group[0])
        topics.append(
            {
                "title": topic_title,
                "content": content,
                "speed_check": {
                    "question": f"What is the key takeaway of {topic_title}?",
                    "options": [
                        "It establishes the primary conceptual foundation described in this section.",
                        "It is an obsolete legacy pattern no longer in use.",
                        "It strictly applies to server-side operating systems.",
                        "It replaces all database indexing structures.",
                    ],
                    "correct_option_index": 0,
                    "explanation": "This module establishes the foundational principles for this topic.",
                },
                "mental_model": "Think of this concept as a modular building block in modern system architecture.",
            }
        )

    return {
        "title": fallback_title,
        "description": f"Synthesized study track containing {len(topics)} topics.",
        "topics": topics if topics else [
            {
                "title": fallback_title,
                "content": cleaned[:1200] if cleaned else "No content available.",
                "speed_check": {
                    "question": "What is the primary objective of this module?",
                    "options": ["Core understanding", "Surface skimming", "Ignored", "Syntax error"],
                    "correct_option_index": 0,
                    "explanation": "Core understanding is the learning objective.",
                },
                "mental_model": "Foundational architectural baseline.",
            }
        ],
    }


async def _process_and_persist_course(
    raw_text: str,
    source_name: str,
    title: Optional[str] = None,
    comprehension_level: float = 6.5,
    learning_strategy: str = "DIFFICULTY_FIRST",
    wpm_baseline: float = 220.0,
) -> dict:
    """Core synthesis and MongoDB persistence pipeline for all ingestion forms."""
    if len(raw_text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Content is too short or could not be extracted (minimum 50 characters required).",
        )

    resolved_title = title.strip() if title and title.strip() else "Intelligent Adaptive Track"

    # AI Curriculum Synthesis: Discard boilerplate + generate topic-wise course adapted to level & strategy
    curriculum_data = await synthesize_curriculum_with_ai(
        raw_text=raw_text,
        fallback_title=resolved_title,
        comprehension_level=comprehension_level,
        learning_strategy=learning_strategy,
    )
    course_title = curriculum_data.get("title") or resolved_title
    course_desc = curriculum_data.get("description") or f"Curated from {source_name}"
    synthesized_topics = curriculum_data.get("topics", [])

    if not synthesized_topics:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI synthesis was unable to construct topic modules from the provided text.",
        )

    # Compute word counts & duration
    total_words = sum(len(t.get("content", "").split()) for t in synthesized_topics)
    content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()[:8]
    slug = f"ai-{_slugify(course_title)}-{content_hash}"

    # Persist Lesson Document to MongoDB Atlas
    lesson = Lesson(
        track_id="byoc-sandbox",
        track_tier=TrackTier.BYOC_SANDBOX,
        slug=slug,
        title=course_title,
        description=course_desc,
        order=0,
        estimated_duration_minutes=max(2, int(total_words / wpm_baseline)),
        prerequisites=[],
        total_chunks=len(synthesized_topics),
        total_words=total_words,
        average_complexity=9.5,
        source_filename=source_name,
        source_checksum=content_hash,
    )
    await lesson.insert()

    serialized_chunks = []
    # Persist Semantic Chunk Documents with Speed Check questions to MongoDB Atlas
    for idx, t in enumerate(synthesized_topics):
        t_content = t.get("content", "")
        t_words = max(1, len(t_content.split()))
        target_dwell = int((t_words / wpm_baseline) * 60 * 1000)

        # Parse speed check
        sc_data = t.get("speed_check")
        speed_check_obj = None
        if sc_data and "question" in sc_data and "options" in sc_data:
            speed_check_obj = SpeedCheckQuestion(
                question=sc_data["question"],
                options=sc_data["options"],
                correct_option_index=sc_data.get("correct_option_index", 0),
                explanation=sc_data.get("explanation", "Verification checkpoint."),
            )

        # Parse mental model
        mental_model_text = t.get("mental_model")
        cached_adaptations = {}
        if mental_model_text:
            cached_adaptations["OVERLOAD_SIMPLIFIED"] = ContentAdaptation(
                adaptation_type="OVERLOAD_SIMPLIFIED",
                simplified_markdown=f"### Mental Model\n\n{mental_model_text}",
            )

        chunk_doc = SemanticChunk(
            lesson_id=str(lesson.id),
            chunk_index=idx,
            title=t.get("title", f"Topic {idx + 1}"),
            content=t_content,
            sentence_count=max(1, len(re.split(r"[.!?]+", t_content))),
            word_count=t_words,
            flesch_kincaid_grade=9.5,
            target_dwell_ms=target_dwell,
            speed_check=speed_check_obj,
            cached_adaptations=cached_adaptations,
        )
        await chunk_doc.insert()

        serialized_chunks.append(
            {
                "id": f"chunk-{slug}-{idx}",
                "chunk_index": idx,
                "title": t.get("title", f"Topic {idx + 1}"),
                "content": t_content,
                "sentence_count": chunk_doc.sentence_count,
                "word_count": t_words,
                "flesch_kincaid_grade": 9.5,
                "target_dwell_ms": target_dwell,
                "speed_check": (
                    {
                        "question": speed_check_obj.question,
                        "options": speed_check_obj.options,
                        "correct_option_index": speed_check_obj.correct_option_index,
                        "explanation": speed_check_obj.explanation,
                    }
                    if speed_check_obj
                    else None
                ),
                "cached_adaptations": {
                    "OVERLOAD_SIMPLIFIED": {
                        "simplified_markdown": f"### Mental Model\n\n{mental_model_text}",
                    }
                }
                if mental_model_text
                else None,
            }
        )

    response_payload = {
        "success": True,
        "module_id": str(lesson.id),
        "lesson_id": str(lesson.id),
        "slug": slug,
        "title": course_title,
        "description": course_desc,
        "estimated_minutes": lesson.estimated_duration_minutes,
        "total_chunks": len(synthesized_topics),
        "total_words": total_words,
        "chunks": serialized_chunks,
        "status_message": f"Successfully synthesized '{course_title}' into {len(synthesized_topics)} intelligent topic modules.",
        "data": {
            "module_id": str(lesson.id),
            "lesson_id": str(lesson.id),
            "slug": slug,
            "title": course_title,
            "description": course_desc,
            "estimated_minutes": lesson.estimated_duration_minutes,
            "total_chunks": len(synthesized_topics),
            "total_words": total_words,
            "chunks": serialized_chunks,
        },
    }
    return response_payload


@router.post("/byoc/ingest-url", tags=["BYOC"])
async def ingest_url(payload: IngestUrlRequest):
    """Ingests content from a web URL and synthesizes an adaptive course."""
    raw_text = await _fetch_url_content(payload.url.strip())
    title = payload.title
    if not title:
        title = re.sub(r"https?://(www\.)?", "", payload.url.strip()).split("/")[0].capitalize() + " Course"
    return await _process_and_persist_course(
        raw_text=raw_text,
        source_name=payload.url.strip(),
        title=title,
        comprehension_level=payload.user_level,
        learning_strategy=payload.learning_strategy,
    )


@router.post("/byoc/ingest-notes", tags=["BYOC"])
async def ingest_notes(payload: IngestNotesRequest):
    """Ingests raw text notes and synthesizes an adaptive course."""
    return await _process_and_persist_course(
        raw_text=payload.raw_text.strip(),
        source_name="Pasted Notes",
        title=payload.title or "Custom Notes Study Track",
        comprehension_level=payload.user_level,
        learning_strategy=payload.learning_strategy,
    )


@router.post("/byoc/ingest-document", tags=["BYOC"])
async def ingest_document(
    file: UploadFile = File(..., description="PDF, PPT/PPTX, Markdown (.md), or Text (.txt) file."),
    title: Optional[str] = Form(default=None),
    user_level: float = Form(default=6.5),
    learning_strategy: str = Form(default="DIFFICULTY_FIRST"),
):
    """Ingests an uploaded document and synthesizes an adaptive course."""
    filename = file.filename or "Uploaded Document"
    raw_bytes = await file.read()
    raw_text = ""
    if raw_bytes:
        file_ext = filename.lower().split(".")[-1]
        if file_ext == "pdf":
            raw_text = _extract_text_from_pdf(raw_bytes)
        elif file_ext in ["pptx", "ppt"]:
            raw_text = _extract_text_from_pptx(raw_bytes)
        else:
            try:
                raw_text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raw_text = raw_bytes.decode("latin-1", errors="replace")

    resolved_title = title or re.sub(r"\.[^.]+$", "", filename).replace("_", " ").replace("-", " ").title()

    return await _process_and_persist_course(
        raw_text=raw_text,
        source_name=filename,
        title=resolved_title,
        comprehension_level=user_level,
        learning_strategy=learning_strategy,
    )


@router.post("/byoc/upload", tags=["BYOC"])
async def ingest_and_synthesize_content(
    file: Optional[UploadFile] = File(default=None, description="PDF, PPT/PPTX, Markdown (.md), or Text (.txt) file."),
    url_input: Optional[str] = Form(default=None, description="External article or documentation URL (e.g. W3Schools, GfG)."),
    raw_text_input: Optional[str] = Form(default=None, description="Direct text notes or lecture slides pasted by user."),
    title: Optional[str] = Form(default=None, description="Optional custom title for the course."),
    wpm_baseline: float = Form(default=220.0, ge=80.0, le=600.0),
    comprehension_level: float = Form(default=6.5, ge=1.0, le=10.0, description="Learner 1.0 - 10.0 understanding level"),
    learning_strategy: str = Form(default="DIFFICULTY_FIRST", description="'DIFFICULTY_FIRST' or 'TIME_FIRST'"),
):
    """Legacy BYOC upload endpoint for backwards compatibility."""
    raw_text = ""
    source_name = "Custom Material"

    if url_input and url_input.strip().startswith("http"):
        source_name = url_input.strip()
        raw_text = await _fetch_url_content(url_input.strip())
        if not title:
            title = re.sub(r"https?://(www\.)?", "", url_input.strip()).split("/")[0].capitalize() + " Course"
    elif file is not None and file.filename:
        filename = file.filename
        source_name = filename
        raw_bytes = await file.read()
        if raw_bytes:
            file_ext = filename.lower().split(".")[-1]
            if file_ext == "pdf":
                raw_text = _extract_text_from_pdf(raw_bytes)
            elif file_ext in ["pptx", "ppt"]:
                raw_text = _extract_text_from_pptx(raw_bytes)
            else:
                try:
                    raw_text = raw_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    raw_text = raw_bytes.decode("latin-1", errors="replace")
        if not title:
            title = re.sub(r"\.[^.]+$", "", filename).replace("_", " ").replace("-", " ").title()
    elif raw_text_input and raw_text_input.strip():
        raw_text = raw_text_input.strip()
        source_name = "Pasted Notes"
        if not title:
            title = "Custom Notes Study Track"

    return await _process_and_persist_course(
        raw_text=raw_text,
        source_name=source_name,
        title=title,
        comprehension_level=comprehension_level,
        learning_strategy=learning_strategy,
        wpm_baseline=wpm_baseline,
    )
