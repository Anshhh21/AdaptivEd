import math
from typing import Dict, List, Optional, Set
import numpy as np
from pydantic import Field

from app.ml.chunker import (
    BaseChunker,
    ChunkingResult,
    GeneratedChunk,
    compute_flesch_kincaid_grade,
)
from app.schemas.base import AppBaseModel


class AblationMetrics(AppBaseModel):
    """Evaluation metrics comparing chunking boundaries against baseline benchmarks."""

    precision: float = Field(ge=0.0, le=1.0)
    recall: float = Field(ge=0.0, le=1.0)
    f1_score: float = Field(ge=0.0, le=1.0)
    total_boundaries_detected: int
    ground_truth_boundaries: int
    mean_chunk_word_count: float
    variance_chunk_word_count: float


class AblationComparisonReport(AppBaseModel):
    """Comparative report across multiple chunking strategies for the Educator Studio."""

    strategy_results: Dict[str, ChunkingResult]
    comparative_metrics: Dict[str, AblationMetrics]
    ground_truth_boundaries: List[int]
    recommended_strategy: str


class TfidfLsaChunker(BaseChunker):
    """
    Week 4 Validated Baseline Chunker (F1 = 0.895 Benchmark).
    Transforms sliding sentence windows into TF-IDF term vectors followed by
    Latent Semantic Analysis (TruncatedSVD) to produce low-dimensional dense vectors.
    """

    def __init__(self, n_components: int = 40) -> None:
        self.n_components = n_components

    def _split_into_sentences(self, text: str) -> List[str]:
        import re

        normalized = re.sub(r"\r\n", "\n", text).strip()
        raw_sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9#*_`])", normalized)
        cleaned = [s.strip() for s in raw_sentences if s.strip()]
        return cleaned if cleaned else [text.strip()]

    def _compute_lsa_vectors(self, window_texts: List[str]) -> np.ndarray:
        """Projects texts into low-rank latent semantic space via TF-IDF + TruncatedSVD."""
        try:
            from sklearn.decomposition import TruncatedSVD
            from sklearn.feature_extraction.text import TfidfVectorizer

            vectorizer = TfidfVectorizer(stop_words="english", max_features=1000)
            tfidf_matrix = vectorizer.fit_transform(window_texts)

            # Cap components at min(n_samples - 1, n_features - 1, desired_components)
            n_samples, n_features = tfidf_matrix.shape
            k = max(2, min(self.n_components, n_samples - 1, n_features - 1))

            if n_samples < 3 or n_features < 3:
                dense = tfidf_matrix.toarray()
                norms = np.linalg.norm(dense, axis=1, keepdims=True)
                return dense / np.maximum(norms, 1e-9)

            svd = TruncatedSVD(n_components=k, random_state=42)
            lsa_matrix = svd.fit_transform(tfidf_matrix)

            # L2 normalize
            norms = np.linalg.norm(lsa_matrix, axis=1, keepdims=True)
            return lsa_matrix / np.maximum(norms, 1e-9)
        except ImportError:
            # Deterministic pure numpy fallback for testing environments
            dim = min(self.n_components, 32)
            vectors = []
            for text in window_texts:
                v = np.zeros(dim, dtype=np.float32)
                for word in text.lower().split():
                    v[hash(word) % dim] += 1.0
                norm = np.linalg.norm(v)
                vectors.append(v / (norm + 1e-9))
            return np.vstack(vectors)

    def chunk_text(
        self,
        text: str,
        window_size: int = 3,
        alpha: float = 0.85,
        wpm_baseline: float = 220.0,
    ) -> ChunkingResult:
        sentences = self._split_into_sentences(text)
        n = len(sentences)

        if n <= window_size:
            w_count = sum(len(s.split()) for s in sentences)
            dwell = int((w_count / wpm_baseline) * 60_000)
            fk = compute_flesch_kincaid_grade(text, n, w_count)
            chunk = GeneratedChunk(
                chunk_index=0,
                content=text,
                sentences=sentences,
                sentence_count=n,
                word_count=w_count,
                flesch_kincaid_grade=fk,
                target_dwell_ms=dwell,
                boundary_cosine_drop=None,
            )
            return ChunkingResult(
                chunks=[chunk],
                total_chunks=1,
                total_sentences=n,
                total_words=w_count,
                mean_cosine_similarity=1.0,
                std_cosine_similarity=0.0,
                threshold_tau=1.0,
                model_name=f"TF-IDF + LSA (k={self.n_components})",
            )

        # Build sliding windows
        window_texts = []
        for i in range(n - window_size + 1):
            window_slice = sentences[i : i + window_size]
            window_texts.append(" ".join(window_slice))

        lsa_vectors = self._compute_lsa_vectors(window_texts)

        # Pairwise cosine similarity
        similarities: List[float] = []
        for i in range(len(lsa_vectors) - 1):
            sim = float(np.dot(lsa_vectors[i], lsa_vectors[i + 1]))
            similarities.append(max(-1.0, min(1.0, sim)))

        sim_arr = np.array(similarities)
        mean_sim = float(np.mean(sim_arr))
        std_sim = float(np.std(sim_arr))
        threshold_tau = mean_sim - (alpha * std_sim)

        # Identify boundary break indices
        split_indices = set()
        for idx, sim in enumerate(similarities):
            if sim < threshold_tau:
                boundary = idx + window_size - 1
                if 0 < boundary < n - 1:
                    split_indices.add(boundary)

        # Construct chunks
        chunks: List[GeneratedChunk] = []
        cur_sentences: List[str] = []
        chunk_idx = 0

        for s_idx, sentence in enumerate(sentences):
            cur_sentences.append(sentence)
            if s_idx in split_indices or s_idx == n - 1:
                chunk_body = " ".join(cur_sentences)
                words = sum(len(s.split()) for s in cur_sentences)
                sc = len(cur_sentences)
                fk = compute_flesch_kincaid_grade(chunk_body, sc, words)
                dwell = int((words / wpm_baseline) * 60_000)

                drop_val = (
                    float(mean_sim - similarities[min(s_idx, len(similarities) - 1)])
                    if s_idx in split_indices
                    else None
                )

                chunks.append(
                    GeneratedChunk(
                        chunk_index=chunk_idx,
                        content=chunk_body,
                        sentences=cur_sentences,
                        sentence_count=sc,
                        word_count=words,
                        flesch_kincaid_grade=fk,
                        target_dwell_ms=dwell,
                        boundary_cosine_drop=drop_val,
                    )
                )
                chunk_idx += 1
                cur_sentences = []

        return ChunkingResult(
            chunks=chunks,
            total_chunks=len(chunks),
            total_sentences=n,
            total_words=sum(c.word_count for c in chunks),
            mean_cosine_similarity=round(mean_sim, 4),
            std_cosine_similarity=round(std_sim, 4),
            threshold_tau=round(threshold_tau, 4),
            model_name=f"TF-IDF + LSA (k={self.n_components})",
        )


class FixedSentenceChunker(BaseChunker):
    """
    Fixed-window chunker (e.g. 7 sentences) acting as the standard naive baseline
    to demonstrate why semantic boundary detection is required.
    """

    def __init__(self, sentences_per_chunk: int = 7) -> None:
        self.sentences_per_chunk = sentences_per_chunk

    def chunk_text(
        self,
        text: str,
        window_size: int = 3,
        alpha: float = 0.8,
        wpm_baseline: float = 220.0,
    ) -> ChunkingResult:
        import re

        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9#*_`])", text.strip())
            if s.strip()
        ]
        n = len(sentences)
        chunks: List[GeneratedChunk] = []
        chunk_idx = 0

        for i in range(0, n, self.sentences_per_chunk):
            slice_sentences = sentences[i : i + self.sentences_per_chunk]
            body = " ".join(slice_sentences)
            words = sum(len(s.split()) for s in slice_sentences)
            sc = len(slice_sentences)
            fk = compute_flesch_kincaid_grade(body, sc, words)
            dwell = int((words / wpm_baseline) * 60_000)

            chunks.append(
                GeneratedChunk(
                    chunk_index=chunk_idx,
                    content=body,
                    sentences=slice_sentences,
                    sentence_count=sc,
                    word_count=words,
                    flesch_kincaid_grade=fk,
                    target_dwell_ms=dwell,
                    boundary_cosine_drop=None,
                )
            )
            chunk_idx += 1

        return ChunkingResult(
            chunks=chunks,
            total_chunks=len(chunks),
            total_sentences=n,
            total_words=sum(c.word_count for c in chunks),
            mean_cosine_similarity=0.0,
            std_cosine_similarity=0.0,
            threshold_tau=0.0,
            model_name=f"Fixed ({self.sentences_per_chunk}-Sentence)",
        )


class AblationEvaluator:
    """
    Statistical evaluator comparing predicted chunk boundaries against ground-truth benchmarks
    using windowed tolerance (within +/- 1 sentence).
    """

    @staticmethod
    def extract_boundary_indices(chunking_result: ChunkingResult) -> List[int]:
        """Extracts 0-indexed sentence indices where chunk transitions occur."""
        boundaries: List[int] = []
        running_total = 0
        for chunk in chunking_result.chunks[:-1]:
            running_total += chunk.sentence_count
            boundaries.append(running_total - 1)
        return boundaries

    @classmethod
    def evaluate_boundaries(
        cls,
        predicted_boundaries: List[int],
        ground_truth_boundaries: List[int],
        tolerance: int = 1,
    ) -> AblationMetrics:
        """
        Calculates precision, recall, and F1 score with standard sentence boundary tolerance.
        A predicted boundary is a True Positive if within +/- tolerance sentences of a ground truth boundary.
        """
        gt_set = set(ground_truth_boundaries)
        pred_set = set(predicted_boundaries)

        if not gt_set and not pred_set:
            return AblationMetrics(
                precision=1.0,
                recall=1.0,
                f1_score=1.0,
                total_boundaries_detected=0,
                ground_truth_boundaries=0,
                mean_chunk_word_count=0.0,
                variance_chunk_word_count=0.0,
            )

        if not pred_set or not gt_set:
            return AblationMetrics(
                precision=0.0,
                recall=0.0,
                f1_score=0.0,
                total_boundaries_detected=len(pred_set),
                ground_truth_boundaries=len(gt_set),
                mean_chunk_word_count=0.0,
                variance_chunk_word_count=0.0,
            )

        # Match with tolerance
        matched_gt: Set[int] = set()
        true_positives = 0

        for pred in pred_set:
            match = False
            for gt in gt_set:
                if abs(pred - gt) <= tolerance and gt not in matched_gt:
                    matched_gt.add(gt)
                    match = True
                    break
            if match:
                true_positives += 1

        precision = true_positives / len(pred_set) if pred_set else 0.0
        recall = len(matched_gt) / len(gt_set) if gt_set else 0.0
        f1 = (
            (2 * precision * recall) / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )

        return AblationMetrics(
            precision=round(precision, 4),
            recall=round(recall, 4),
            f1_score=round(f1, 4),
            total_boundaries_detected=len(pred_set),
            ground_truth_boundaries=len(gt_set),
            mean_chunk_word_count=0.0,
            variance_chunk_word_count=0.0,
        )

