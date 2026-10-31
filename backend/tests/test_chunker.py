import pytest
from app.ml.chunker import (
    SemanticWindowChunker,
    compute_flesch_kincaid_grade,
)
from app.ml.ablation import (
    AblationEvaluator,
    FixedSentenceChunker,
    TfidfLsaChunker,
)


def test_flesch_kincaid_readability():
    """Verify standard Flesch-Kincaid formula output."""
    sample_text = (
        "In early React architectures, reconciliation was a synchronous recursive walk over the virtual DOM tree. "
        "When updating a deep component hierarchy, the main thread was completely blocked until the reconciliation traversal concluded."
    )
    grade = compute_flesch_kincaid_grade(sample_text, sentence_count=2, word_count=32)
    assert 6.0 <= grade <= 18.0


def test_semantic_window_chunker():
    """Verify 3-sentence sliding window chunker segments technical text and calculates tau."""
    chunker = SemanticWindowChunker()
    text = (
        "React Fiber fundamentally re-architected the reconciliation process by turning the component tree into a singly linked list. "
        "This architectural shift enables cooperative multitasking across the browser event loop. "
        "React can pause ongoing reconciliation, yield control back to the browser for urgent user events, and resume work seamlessly. "
        "To guarantee zero visual tearing during interruptible renders, React utilizes a classic computer graphics technique known as double buffering. "
        "At any given instant, React maintains two parallel trees: the current tree and the workInProgress tree. "
        "All expensive diffing and hook executions occur exclusively on the workInProgress tree without touching real DOM nodes. "
        "Once the workInProgress tree finishes, React executes the synchronous Commit Phase with an atomic pointer swap."
    )

    result = chunker.chunk_text(text, window_size=3, alpha=0.8, wpm_baseline=220.0)

    assert result.total_chunks >= 1
    assert result.total_sentences == 7
    assert result.mean_cosine_similarity > 0.0
    for chunk in result.chunks:
        assert chunk.target_dwell_ms > 0
        assert chunk.word_count > 0
        assert chunk.sentence_count >= 1


def test_tfidf_lsa_ablation_benchmark():
    """Verify Week 4 TF-IDF + LSA baseline produces valid low-rank chunks."""
    chunker = TfidfLsaChunker(n_components=20)
    text = (
        "Server Actions compile into dedicated RPC POST endpoints carrying encrypted closures. "
        "The server decodes the action ID and executes the handler inside Node.js or edge runtimes. "
        "The response streams an updated React Server Component flight representation to revalidate cache boundaries."
    )

    result = chunker.chunk_text(text, window_size=3, alpha=0.8, wpm_baseline=220.0)
    assert result.total_chunks >= 1
    assert "TF-IDF + LSA" in result.model_name


def test_ablation_evaluator_metrics():
    """Verify windowed precision, recall, and F1 calculations with +/- 1 tolerance."""
    pred_boundaries = [2, 5, 8]
    gt_boundaries = [2, 6, 8]

    metrics = AblationEvaluator.evaluate_boundaries(pred_boundaries, gt_boundaries, tolerance=1)

    assert metrics.precision == 1.0
    assert metrics.recall == 1.0
    assert metrics.f1_score == 1.0

