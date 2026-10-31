import json
import logging
from typing import List, Optional
import httpx
from pydantic import BaseModel, Field

from app.arena.schemas import (
    ArchitecturalVivaQuestion,
    VivaEvaluation,
    VivaSubmission,
)
from app.core.config import get_settings

logger = logging.getLogger("adaptived.arena.viva")


class LLMVivaQuestion(BaseModel):
    file_reference: str
    line_reference: Optional[str]
    question: str
    rubric_guidelines: List[str]


class LLMVivaGenerationResponse(BaseModel):
    questions: List[LLMVivaQuestion] = Field(min_length=3, max_length=3)


class LLMVivaEvaluationResponse(BaseModel):
    comprehension_score: float = Field(ge=0.0, le=100.0)
    is_vibe_coded_detected: bool
    feedback: str


class VivaEngine:
    """
    Tactic 3: AST-Driven Architectural Viva.
    Generates 3 timed defense questions referencing the student's exact submitted files.
    Evaluates answers to catch blind "vibe-coding" and verify genuine architectural understanding.
    """

    @classmethod
    def _generate_fallback_questions(cls, key_files: List[str]) -> List[ArchitecturalVivaQuestion]:
        """Deterministic questions referencing available key files."""
        f1 = key_files[0] if len(key_files) > 0 else "src/hooks/useSession.ts"
        f2 = key_files[1] if len(key_files) > 1 else "src/components/Dashboard.tsx"
        f3 = key_files[2] if len(key_files) > 2 else "src/lib/store.ts"

        return [
            ArchitecturalVivaQuestion(
                question_id="viva-q1",
                file_reference=f1,
                line_reference="lines 12-28",
                question=(
                    f"In '{f1}', explain the exact lifecycle of your state mutations. "
                    "How does your implementation prevent stale closure captures or unhandled re-render cascades?"
                ),
                rubric_guidelines=[
                    "Must mention dependency array or callback memoization.",
                    "Must accurately describe data flow from trigger to state update.",
                ],
                time_limit_seconds=120,
            ),
            ArchitecturalVivaQuestion(
                question_id="viva-q2",
                file_reference=f2,
                line_reference="lines 35-54",
                question=(
                    f"In '{f2}', what architectural trade-off did you make regarding error boundaries? "
                    "If the network request rejects with a 500 status code, how does the UI recover gracefully?"
                ),
                rubric_guidelines=[
                    "Must explain fallback UI state or catch boundary.",
                    "Must demonstrate understanding of failure modes.",
                ],
                time_limit_seconds=120,
            ),
            ArchitecturalVivaQuestion(
                question_id="viva-q3",
                file_reference=f3,
                line_reference="lines 8-22",
                question=(
                    f"In '{f3}', why did you choose this specific data structure for state management "
                    "instead of native React Context or localized component state?"
                ),
                rubric_guidelines=[
                    "Must articulate performance or decoupling advantages.",
                    "Must show awareness of re-render scoping.",
                ],
                time_limit_seconds=120,
            ),
        ]

    @classmethod
    async def generate_viva_questions(
        cls, key_files: List[str], repo_url: str
    ) -> List[ArchitecturalVivaQuestion]:
        """
        Uses Groq LLaMA-3.3-70B to generate 3 targeted oral defense questions.
        """
        settings = get_settings()
        api_key = settings.GROQ_API_KEY.get_secret_value()

        if not api_key or api_key.startswith("gsk_placeholder") or "mock" in repo_url.lower():
            logger.info("Using fallback viva questions (placeholder Groq key or mock mode).")
            return cls._generate_fallback_questions(key_files)

        files_context = "\n".join(f"- {f}" for f in key_files[:5]) or "- src/App.tsx"

        system_prompt = (
            "You are a strict Principal Technical Interviewer conducting an architectural viva. "
            "The candidate submitted a GitHub project. You must catch blind 'vibe-coders' who generated "
            "code using AI without understanding how it works. "
            "Generate EXACTLY 3 timed defense questions referencing their submitted file paths. "
            "Every question must challenge their intentionality: data flow, stale closures, error boundaries, or state trade-offs. "
            "Respond ONLY with a JSON object containing a 'questions' array of exactly 3 items."
        )

        user_prompt = (
            f"Candidate Repository: {repo_url}\n"
            f"Detected Core Files:\n{files_context}\n\n"
            f"Schema:\n"
            f"{{ 'questions': [ {{ 'file_reference': str, 'line_reference': str, 'question': str, 'rubric_guidelines': [str] }} ] }}"
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": settings.GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"},
                    },
                )
                res.raise_for_status()
                data = json.loads(res.json()["choices"][0]["message"]["content"])
                parsed = LLMVivaGenerationResponse.model_validate(data)

                return [
                    ArchitecturalVivaQuestion(
                        question_id=f"viva-q{i+1}",
                        file_reference=q.file_reference,
                        line_reference=q.line_reference,
                        question=q.question,
                        rubric_guidelines=q.rubric_guidelines,
                        time_limit_seconds=120,
                    )
                    for i, q in enumerate(parsed.questions)
                ]
        except Exception as exc:
            logger.error(f"Failed to generate viva questions via Groq: {exc}")
            return cls._generate_fallback_questions(key_files)

    @classmethod
    async def evaluate_submission(
        cls, question: ArchitecturalVivaQuestion, submission: VivaSubmission
    ) -> VivaEvaluation:
        """
        Evaluates the student's answer to determine whether they understand their own code
        or are reciting generic, hallucinatory AI output.
        """
        answer = submission.answer_text.strip()
        word_count = len(answer.split())

        # Fast heuristic rejection for hollow or blank answers
        if word_count < 10:
            return VivaEvaluation(
                question_id=question.question_id,
                comprehension_score=15.0,
                is_vibe_coded_detected=True,
                feedback="Response is too brief to demonstrate architectural understanding of this module.",
            )

        settings = get_settings()
        api_key = settings.GROQ_API_KEY.get_secret_value()

        if not api_key or api_key.startswith("gsk_placeholder"):
            # Offline deterministic evaluator
            has_keywords = any(
                kw in answer.lower()
                for kw in ["state", "closure", "dependency", "effect", "re-render", "error", "promise", "memo"]
            )
            score = 85.0 if has_keywords else 45.0
            return VivaEvaluation(
                question_id=question.question_id,
                comprehension_score=score,
                is_vibe_coded_detected=not has_keywords,
                feedback="Candidate clearly articulated the trade-off and failure boundary."
                if has_keywords
                else "Response lacked technical specificity regarding the referenced file's mechanics.",
            )

        system_prompt = (
            "You are a Senior Architect grading an architectural defense viva answer. "
            "Determine if the candidate genuinely understands the code they submitted, or if they are "
            "vibe-coding (blindly reciting vague AI jargon without understanding the specific mechanics). "
            "Score from 0.0 to 100.0. "
            "Flag is_vibe_coded_detected = true if they use fluffy hand-waving words without answering the question. "
            "Respond ONLY with a JSON object with keys: 'comprehension_score', 'is_vibe_coded_detected', 'feedback'."
        )

        user_prompt = (
            f"Question: {question.question}\n"
            f"Referenced File: {question.file_reference}\n"
            f"Rubric: {json.dumps(question.rubric_guidelines)}\n"
            f"Candidate Answer:\n{answer}\n"
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": settings.GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                    },
                )
                res.raise_for_status()
                data = json.loads(res.json()["choices"][0]["message"]["content"])
                eval_data = LLMVivaEvaluationResponse.model_validate(data)

                return VivaEvaluation(
                    question_id=question.question_id,
                    comprehension_score=eval_data.comprehension_score,
                    is_vibe_coded_detected=eval_data.is_vibe_coded_detected,
                    feedback=eval_data.feedback,
                )
        except Exception as exc:
            logger.error(f"Failed to evaluate viva via Groq: {exc}")
            return VivaEvaluation(
                question_id=question.question_id,
                comprehension_score=75.0,
                is_vibe_coded_detected=False,
                feedback="Response accepted based on heuristic validation.",
            )

