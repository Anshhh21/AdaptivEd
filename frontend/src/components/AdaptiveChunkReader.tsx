"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import AnimatedContent from "./AnimatedContent";
import RubberSegment from "./RubberSegment";
import SpecularButton from "./SpecularButton";
import { useAttentionTracker } from "../hooks/useAttentionTracker";
import { useChunkTelemetry } from "../hooks/useChunkTelemetry";
import { useFullscreenLock } from "../hooks/useFullscreenLock";
import { BCSEvaluationResponse, ChunkTelemetryPayload, CognitiveState } from "../types/telemetry";
import { DeveloperXRayDrawer } from "./DeveloperXRayDrawer";
import { FocusLockShield } from "./FocusLockShield";
import { MarkdownCodeRenderer } from "./MarkdownCodeRenderer";
import { WebcamAttentionTile } from "./WebcamAttentionTile";

export interface SemanticChunkData {
  id: string;
  chunk_index: number;
  title: string | null;
  content: string;
  sentence_count: number;
  word_count: number;
  flesch_kincaid_grade: number;
  target_dwell_ms: number;
  speed_check?: {
    question: string;
    options: string[];
    correct_option_index: number;
    explanation: string;
  } | null;
  cached_adaptations?: Record<
    string,
    {
      simplified_markdown: string;
      mermaid_diagram?: string | null;
      code_annotations: string[];
    }
  >;
}

interface AdaptiveChunkReaderProps {
  lessonId: string;
  lessonTitle: string;
  chunks: SemanticChunkData[];
  learnerId?: string;
  onLessonComplete?: () => void;
  onScoreUpdated?: (newScore: number, delta: number, feedback: string) => void;
  onBack?: () => void;
}

export const AdaptiveChunkReader: React.FC<AdaptiveChunkReaderProps> = ({
  lessonId,
  lessonTitle,
  chunks,
  learnerId = "learner_anonymous",
  onLessonComplete,
  onScoreUpdated,
  onBack,
}) => {
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [activeViewMode, setActiveViewMode] = useState<"ORIGINAL" | "ADAPTED">("ORIGINAL");
  const [isAdaptiveAssistanceActive, setIsAdaptiveAssistanceActive] = useState<boolean>(false);
  const [comprehensionToast, setComprehensionToast] = useState<{
    previousScore: number;
    newScore: number;
    delta: number;
    feedback: string;
  } | null>(null);
  const chunkStartTimeRef = useRef<number>(Date.now());
  const [dynamicAdaptations, setDynamicAdaptations] = useState<
    Record<
      number,
      {
        real_world_metaphor: string;
        simplified_analogy: string;
        step_by_step_walkthrough: string[];
        simplified_code_example?: string | null;
        mermaid_diagram?: string | null;
      }
    >
  >({});
  const [isGeneratingAdaptation, setIsGeneratingAdaptation] = useState<boolean>(false);
  const [activeEvaluation, setActiveEvaluation] = useState<BCSEvaluationResponse | null>(null);
  const [isXRayOpen, setIsXRayOpen] = useState<boolean>(false);

  // Speed-Check Intercept State
  const [isSpeedCheckOpen, setIsSpeedCheckOpen] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [isSpeedCheckPassed, setIsSpeedCheckPassed] = useState<boolean>(false);

  // Focus Lock Hook
  const { isLockedInFocus, blockReason, requestFullscreenLock } = useFullscreenLock();

  // Local MediaPipe 2-FPS Vision Attention Tracker
  const {
    videoRef,
    attentionScore,
    faceDetected,
    isTracking,
    hasCameraPermission,
    requestCameraAccess,
    stopTracking,
  } = useAttentionTracker(true);

  const currentChunk = chunks[activeChunkIndex] || null;

  // WebSocket Telemetry Streaming Handler
  const wsRef = useRef<WebSocket | null>(null);

  const handleTelemetryTick = useCallback(
    (payload: ChunkTelemetryPayload) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    },
    []
  );

  // Initialize Telemetry Hook for the active chunk
  const { containerRef, payload: livePayload, recordAttentionScore } = useChunkTelemetry({
    chunkId: currentChunk ? currentChunk.id : "empty",
    lessonId,
    isLockedInFocus,
    onTick: handleTelemetryTick,
  });

  // Pipe MediaPipe attention score into the telemetry accumulator
  useEffect(() => {
    recordAttentionScore(attentionScore);
  }, [attentionScore, recordAttentionScore]);

  // Connect WebSocket to FastAPI Telemetry Aggregator
  const activeViewModeRef = useRef<"ORIGINAL" | "ADAPTED">(activeViewMode);
  activeViewModeRef.current = activeViewMode;
  const isSpeedCheckPassedRef = useRef<boolean>(isSpeedCheckPassed);
  isSpeedCheckPassedRef.current = isSpeedCheckPassed;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws/telemetry/${learnerId}`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "TELEMETRY_EVALUATION" && data.payload) {
            const evalResult: BCSEvaluationResponse = data.payload;
            setActiveEvaluation(evalResult);

            if (
              evalResult.requires_speed_check &&
              !isSpeedCheckPassedRef.current &&
              currentChunk?.speed_check
            ) {
              setIsSpeedCheckOpen(true);
            }
          }
        } catch (err) {
          console.error("Failed to parse telemetry evaluation WebSocket payload:", err);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.warn("WebSocket connection to telemetry backend failed:", e);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [learnerId, currentChunk]);

  // Modal Speed-Check verification
  const handleVerifyAnswer = () => {
    if (!currentChunk?.speed_check || selectedOption === null) return;

    const isCorrect = selectedOption === currentChunk.speed_check.correct_option_index;
    if (isCorrect) {
      setIsSpeedCheckPassed(true);
      setIsSpeedCheckOpen(false);
      setQuizError(null);
    } else {
      setQuizError("That is incorrect. Review the concept carefully before proceeding.");
    }
  };

  // Inline Quiz state
  const [inlineAnswers, setInlineAnswers] = useState<Record<number, number>>({});
  const [inlineFeedback, setInlineFeedback] = useState<
    Record<number, { isCorrect: boolean; text: string }>
  >({});
  const [inlineVerified, setInlineVerified] = useState<Record<number, boolean>>({});
  const [passedChunks, setPassedChunks] = useState<Record<number, boolean>>({});

  const handleSelectInlineOption = (optIdx: number) => {
    // If user already passed this concept, freeze selection to prevent point farming
    if (passedChunks[activeChunkIndex]) return;

    setInlineAnswers((prev) => ({ ...prev, [activeChunkIndex]: optIdx }));
    setInlineFeedback((prev) => {
      const next = { ...prev };
      delete next[activeChunkIndex];
      return next;
    });
    setInlineVerified((prev) => ({ ...prev, [activeChunkIndex]: false }));
  };

  const handleVerifyInlineAnswer = async () => {
    const speedCheck = currentChunk?.speed_check;
    if (!speedCheck) return;

    const selected = inlineAnswers[activeChunkIndex];
    if (selected === undefined || selected === null) return;

    // Prevent repeated re-evaluation if question is already verified and passed
    if (passedChunks[activeChunkIndex]) return;

    const isCorrect = selected === speedCheck.correct_option_index;
    const dwellSeconds = Math.max(1, Math.round((Date.now() - chunkStartTimeRef.current) / 1000));

    setInlineVerified((prev) => ({ ...prev, [activeChunkIndex]: true }));
    if (isCorrect) {
      setPassedChunks((prev) => ({ ...prev, [activeChunkIndex]: true }));
    }

    setInlineFeedback((prev) => ({
      ...prev,
      [activeChunkIndex]: {
        isCorrect,
        text: isCorrect
          ? `Verified. ${speedCheck.explanation}`
          : `Review needed. Correct answer is Option ${speedCheck.correct_option_index + 1}: "${speedCheck.options[speedCheck.correct_option_index]}". ${speedCheck.explanation}`,
      },
    }));

    // Persist dynamic 1.0 - 10.0 comprehension score directly to MongoDB Atlas
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: learnerId,
          lesson_id: currentChunk?.id || `chunk-${activeChunkIndex}`,
          track_id: lessonId,
          topic_title: currentChunk?.title || lessonTitle,
          xp_earned: isCorrect ? 50 : 10,
          bcs_score: isCorrect ? 0.95 : 0.45,
          quiz_passed: isCorrect,
          dwell_time_seconds: dwellSeconds,
          struggle_signals: isCorrect ? 0 : 1,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const { comprehension_score, previous_score, score_delta, feedback } = json.data;
        if (comprehension_score !== undefined) {
          const deltaVal = score_delta ?? (isCorrect ? 0.3 : -0.3);
          setComprehensionToast({
            previousScore: previous_score ?? 6.5,
            newScore: comprehension_score,
            delta: deltaVal,
            feedback: feedback ?? (isCorrect ? "+0.3 Level Up" : "Calibrating simpler analogies (-0.3)"),
          });

          // Sync local storage session
          try {
            const stored = localStorage.getItem("adaptived_user");
            if (stored) {
              const u = JSON.parse(stored);
              u.comprehension_score = comprehension_score;
              localStorage.setItem("adaptived_user", JSON.stringify(u));
            }
          } catch {
            // Ignored
          }

          if (onScoreUpdated) {
            onScoreUpdated(comprehension_score, deltaVal, feedback);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to persist real-time comprehension update to MongoDB:", err);
    }

    // If incorrect, flag adaptive assistance and fetch Gemini analogy in background without forcing a view switch
    if (!isCorrect) {
      setIsAdaptiveAssistanceActive(true);

      if (!currentChunk.cached_adaptations?.["OVERLOAD_SIMPLIFIED"] && !dynamicAdaptations[activeChunkIndex]) {
        setIsGeneratingAdaptation(true);
        try {
          const res = await fetch("http://127.0.0.1:8000/api/v1/telemetry/adapt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic_title: currentChunk.title || lessonTitle,
              content: currentChunk.content,
              misconception: `User selected: "${speedCheck.options[selected]}"`,
              reason: "QUIZ_CHECKPOINT_FAILED",
            }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            setDynamicAdaptations((prev) => ({
              ...prev,
              [activeChunkIndex]: json.data,
            }));
          }
        } catch (err) {
          console.warn("Failed to generate dynamic Gemini analogy:", err);
        } finally {
          setIsGeneratingAdaptation(false);
        }
      }
    }
  };

  const handleNextChunk = () => {
    if (activeChunkIndex < chunks.length - 1) {
      setActiveChunkIndex((prev) => prev + 1);
      chunkStartTimeRef.current = Date.now();
      setComprehensionToast(null);
      setIsSpeedCheckPassed(false);
      setSelectedOption(null);
      setQuizError(null);
    } else if (onLessonComplete) {
      onLessonComplete();
    }
  };

  const handlePrevChunk = () => {
    if (activeChunkIndex > 0) {
      setActiveChunkIndex((prev) => prev - 1);
      chunkStartTimeRef.current = Date.now();
      setComprehensionToast(null);
      setIsSpeedCheckPassed(false);
    }
  };

  if (!currentChunk) {
    return (
      <div className="p-12 text-center text-slate-400 font-light">
        No content available for this lesson.
      </div>
    );
  }

  const adaptation = currentChunk.cached_adaptations?.["OVERLOAD_SIMPLIFIED"];

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col font-sans selection:bg-white/20 selection:text-white bg-transparent">
      {/* 1. Fullscreen Focus Lock Shield Overlay */}
      <FocusLockShield
        isLockedInFocus={isLockedInFocus}
        blockReason={blockReason}
        onRequestFullscreen={requestFullscreenLock}
      />

      {/* 2. Top Minimalist Frosted Navigation */}
      <header className="border-b border-white/[0.08] bg-black/40 backdrop-blur-xl sticky top-0 z-20 px-6 sm:px-12 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              type="button"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-400 hover:text-white transition cursor-pointer flex items-center justify-center"
              title="Return to Course Hub"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-medium text-white truncate max-w-[200px] sm:max-w-md">
              {lessonTitle}
            </span>
            <span className="text-[11px] text-slate-400 font-light">
              Section {activeChunkIndex + 1} of {chunks.length}
            </span>
          </div>
        </div>

        {/* Minimal Progress Bar & Focus Indicator */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.08]">
            <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/80 rounded-full transition-all duration-300"
                style={{ width: `${((activeChunkIndex + 1) / chunks.length) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {Math.round(((activeChunkIndex + 1) / chunks.length) * 100)}%
            </span>
          </div>

          <div className="px-3 py-1 rounded-full text-xs font-light border border-white/10 bg-white/[0.04] text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>
              {activeEvaluation?.cognitive_state === "OPTIMAL"
                ? "Deep Focus"
                : activeEvaluation?.cognitive_state === "OVERLOADED"
                ? "Reviewing"
                : activeEvaluation?.cognitive_state === "SKIMMING"
                ? "Fast Paced"
                : "Tracking Active"}
            </span>
          </div>
        </div>
      </header>

      {/* 3. Main Reading Area (Duller Background, Maximum Text Legibility) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 flex flex-col justify-between">
        <AnimatedContent distance={30} duration={0.6} ease="power3.out" trigger="mount">
          <div ref={containerRef} className="space-y-8">
            {/* Chunk Header with Minimalist RubberSegment Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                {currentChunk.title || `Concept ${activeChunkIndex + 1}`}
              </h1>

              {/* RubberSegment Switcher: Code & Concepts vs Real-Life Analogy */}
              <div className="shrink-0">
                <RubberSegment
                  items={[
                    { value: "ORIGINAL", label: "Code & Concepts" },
                    { value: "ADAPTED", label: "Real-Life Analogy" },
                  ]}
                  value={activeViewMode}
                  onChange={(val) => {
                    if (val === "ORIGINAL" || val === "ADAPTED") {
                      setActiveViewMode(val);
                    }
                  }}
                  size="sm"
                  radius={12}
                  trackColor="rgba(255, 255, 255, 0.05)"
                  thumbColor="rgba(255, 255, 255, 0.15)"
                  textColor="#94a3b8"
                  activeTextColor="#ffffff"
                />
              </div>
            </div>

            {/* Adaptive Assistance Notice */}
            {isAdaptiveAssistanceActive && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md text-slate-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg
                    className="w-4 h-4 text-purple-300 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span className="font-light leading-relaxed">
                    Adaptive assistance enabled: using simpler real-life metaphors and step-by-step breakdowns.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdaptiveAssistanceActive(false)}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer ml-3 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Dynamic Content View (Original vs Morphed Real-World Analogy) */}
            {activeViewMode === "ORIGINAL" ? (
              <div className="space-y-4">
                <MarkdownCodeRenderer content={currentChunk.content} />
              </div>
            ) : (
              <div className="space-y-6">
                {isGeneratingAdaptation ? (
                  <div className="p-10 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl text-center space-y-3">
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-light text-slate-400">
                      Formulating intuitive real-life analogy...
                    </p>
                  </div>
                ) : dynamicAdaptations[activeChunkIndex] ? (
                  <div className="space-y-6">
                    {/* Metaphor Card */}
                    <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl text-slate-200 space-y-4 shadow-2xl">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] text-white/90 border border-white/10 text-[11px] font-medium tracking-wide uppercase">
                        <svg
                          className="w-3.5 h-3.5 text-slate-300"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z" />
                        </svg>
                        <span>Intuitive Metaphor</span>
                      </div>
                      <p className="text-base sm:text-lg leading-relaxed text-white/95 font-normal">
                        {dynamicAdaptations[activeChunkIndex].real_world_metaphor}
                      </p>
                      <p className="text-sm text-slate-400 leading-relaxed font-light pt-1">
                        {dynamicAdaptations[activeChunkIndex].simplified_analogy}
                      </p>
                    </div>

                    {/* Step-by-Step Breakdown */}
                    {dynamicAdaptations[activeChunkIndex].step_by_step_walkthrough?.length > 0 && (
                      <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-4">
                        <div className="text-xs font-medium tracking-wide uppercase text-slate-400">
                          Step-by-Step Breakdown
                        </div>
                        <div className="space-y-2.5">
                          {dynamicAdaptations[activeChunkIndex].step_by_step_walkthrough.map((step, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs sm:text-sm text-slate-300 font-light"
                            >
                              <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[11px] flex items-center justify-center shrink-0">
                                {sIdx + 1}
                              </span>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Simplified Code Example */}
                    {dynamicAdaptations[activeChunkIndex].simplified_code_example && (
                      <div className="space-y-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Simplified Code Example
                        </div>
                        <MarkdownCodeRenderer
                          content={dynamicAdaptations[activeChunkIndex].simplified_code_example || ""}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Pre-cached adaptation fallback */
                  <div className="space-y-6">
                    <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl text-slate-200 space-y-3 shadow-2xl">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Visual Analogy
                      </div>
                      <div className="text-sm sm:text-base text-slate-300 leading-relaxed font-light whitespace-pre-line">
                        {adaptation?.simplified_markdown ||
                          "Think of this concept like an everyday kitchen receipt or classroom whiteboard: states change in memory first, and the display reflects the new values cleanly."}
                      </div>
                    </div>

                    {adaptation?.mermaid_diagram && (
                      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl font-mono text-xs text-slate-300">
                        <div className="text-slate-400 text-xs mb-3 font-sans">
                          Architecture Workflow
                        </div>
                        <pre className="text-left bg-black/60 p-4 rounded-2xl border border-white/10 overflow-x-auto text-slate-300">
                          {adaptation.mermaid_diagram}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Interactive Topic Comprehension Checkpoint */}
            {currentChunk.speed_check && (
              <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl space-y-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-purple-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-300">
                      Comprehension Checkpoint
                    </span>
                  </div>
                  {inlineVerified[activeChunkIndex] && inlineFeedback[activeChunkIndex]?.isCorrect && (
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      Verified
                    </span>
                  )}
                </div>

                <h4 className="text-base sm:text-lg font-medium text-white leading-relaxed">
                  {currentChunk.speed_check.question}
                </h4>

                <div className="space-y-2.5 pt-1">
                  {currentChunk.speed_check.options.map((opt, optIdx) => {
                    const isSelected = inlineAnswers[activeChunkIndex] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectInlineOption(optIdx)}
                        className={`w-full text-left p-4 rounded-2xl text-xs sm:text-sm border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "border-white/30 bg-white/[0.08] text-white shadow-lg"
                            : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <span className="leading-relaxed font-light">{opt}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-3 transition-colors ${
                            isSelected ? "border-white bg-white" : "border-white/20 bg-transparent"
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback Alert */}
                {inlineFeedback[activeChunkIndex] && (
                  <div
                    className={`p-4 rounded-2xl text-xs font-light leading-relaxed border ${
                      inlineFeedback[activeChunkIndex].isCorrect
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    }`}
                  >
                    {inlineFeedback[activeChunkIndex].text}
                  </div>
                )}

                {/* Comprehension Score Update Card (Synced to MongoDB Atlas) */}
                {comprehensionToast && (
                  <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs animate-fadeIn">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-medium text-white">
                        Level {comprehensionToast.previousScore.toFixed(1)} → {comprehensionToast.newScore.toFixed(1)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 font-mono text-[11px] text-slate-300">
                        {comprehensionToast.delta >= 0
                          ? `+${comprehensionToast.delta.toFixed(1)} Level Up`
                          : `${comprehensionToast.delta.toFixed(1)} Friction`}
                      </span>
                      <span className="text-slate-400 hidden md:inline">• {comprehensionToast.feedback}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Saved to MongoDB Atlas</span>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  {passedChunks[activeChunkIndex] || (inlineVerified[activeChunkIndex] && inlineFeedback[activeChunkIndex]?.isCorrect) ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Answer Verified</span>
                    </div>
                  ) : (
                    <SpecularButton
                      size="md"
                      radius={14}
                      tint="#ffffff"
                      tintOpacity={0.06}
                      textColor="#ffffff"
                      lineColor="#ffffff"
                      baseColor="#555555"
                      intensity={1.2}
                      idleIntensity={0.5}
                      onClick={handleVerifyInlineAnswer}
                      disabled={inlineAnswers[activeChunkIndex] === undefined || inlineAnswers[activeChunkIndex] === null}
                    >
                      Judge My Answer
                    </SpecularButton>
                  )}
                </div>
              </div>
            )}
          </div>
        </AnimatedContent>

        {/* 4. Bottom Progression Bar & Gating Controls */}
        <div className="pt-12 mt-12 border-t border-white/[0.08] flex items-center justify-between">
          <button
            onClick={handlePrevChunk}
            disabled={activeChunkIndex === 0}
            type="button"
            className="px-5 py-2.5 rounded-2xl text-xs font-light border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white transition cursor-pointer"
          >
            ← Previous
          </button>

          <span className="text-xs text-slate-500 font-mono">
            {activeChunkIndex + 1} / {chunks.length}
          </span>

          <SpecularButton
            size="md"
            radius={14}
            tint="#ffffff"
            tintOpacity={0.08}
            textColor="#ffffff"
            lineColor="#ffffff"
            baseColor="#666666"
            intensity={1.3}
            idleIntensity={0.5}
            onClick={handleNextChunk}
            disabled={isSpeedCheckOpen}
          >
            {activeChunkIndex === chunks.length - 1 ? "Complete Lesson ✓" : "Next Concept →"}
          </SpecularButton>
        </div>
      </main>

      {/* Floating Picture-in-Picture Webcam Focus Tile */}
      <WebcamAttentionTile
        videoRef={videoRef}
        isTracking={isTracking}
        hasCameraPermission={hasCameraPermission}
        attentionScore={attentionScore}
        faceDetected={faceDetected}
        onRequestCamera={requestCameraAccess}
        onStopCamera={stopTracking}
      />

      {/* 5. Conceptual Speed-Check Modal (Skimming Prevention) */}
      {isSpeedCheckOpen && currentChunk.speed_check && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-lg w-full bg-white/[0.03] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span>Speed-Check Gating (Fast Pace Detected)</span>
            </div>

            <h3 className="text-lg font-medium text-white leading-snug">
              {currentChunk.speed_check.question}
            </h3>

            <div className="space-y-2.5 pt-2">
              {currentChunk.speed_check.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedOption(idx)}
                  className={`w-full text-left p-4 rounded-2xl text-xs sm:text-sm border transition-all cursor-pointer ${
                    selectedOption === idx
                      ? "border-white/30 bg-white/[0.08] text-white shadow-lg"
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {quizError && <p className="text-rose-400 text-xs font-light pt-1">{quizError}</p>}

            <div className="pt-2 flex justify-end">
              <SpecularButton
                size="md"
                radius={14}
                tint="#ffffff"
                tintOpacity={0.08}
                textColor="#ffffff"
                lineColor="#ffffff"
                baseColor="#666666"
                intensity={1.3}
                idleIntensity={0.5}
                onClick={handleVerifyAnswer}
                disabled={selectedOption === null}
              >
                Verify Answer & Continue
              </SpecularButton>
            </div>
          </div>
        </div>
      )}

      {/* 6. Developer X-Ray Drawer (Ctrl+Shift+D) */}
      <DeveloperXRayDrawer
        isOpen={isXRayOpen}
        onToggle={() => setIsXRayOpen((prev) => !prev)}
        telemetryPayload={livePayload}
        evaluation={activeEvaluation}
        targetDwellMs={currentChunk.target_dwell_ms}
        fleschKincaidGrade={currentChunk.flesch_kincaid_grade}
      />
    </div>
  );
};
