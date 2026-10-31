"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
}

export const AdaptiveChunkReader: React.FC<AdaptiveChunkReaderProps> = ({
  lessonId,
  lessonTitle,
  chunks,
  learnerId = "learner_anonymous",
  onLessonComplete,
}) => {
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [activeViewMode, setActiveViewMode] = useState<"ORIGINAL" | "ADAPTED">("ORIGINAL");
  const [isAdaptiveAssistanceActive, setIsAdaptiveAssistanceActive] = useState<boolean>(false);
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
          if (data.score !== undefined) {
            const evalRes = data as BCSEvaluationResponse;
            setActiveEvaluation(evalRes);

            // Flag adaptation availability without forcing an intrusive view switch
            if (evalRes.requires_adaptation) {
              setIsAdaptiveAssistanceActive(true);
            }

            // Handle skimming speed-check triggers
            if (evalRes.requires_speed_check && !isSpeedCheckPassedRef.current) {
              setIsSpeedCheckOpen(true);
            }
          }
        } catch (err) {
          console.warn("Telemetry socket parse error:", err);
        }
      };

      ws.onerror = () => {
        // Silently capture websocket error if offline/restarting
      };

      wsRef.current = ws;
    } catch (e) {
      console.warn("WebSocket initialization failed:", e);
    }

    return () => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [learnerId]);

  // Handle speed-check answer submission
  const handleVerifyAnswer = () => {
    if (!currentChunk?.speed_check || selectedOption === null) return;

    if (selectedOption === currentChunk.speed_check.correct_option_index) {
      setIsSpeedCheckPassed(true);
      setIsSpeedCheckOpen(false);
      setQuizError(null);
    } else {
      setQuizError("Incorrect. Re-read the conceptual breakdown and try again.");
    }
  };

  // Interactive in-line comprehension checkpoint state ("Judge What You Learned")
  const [inlineAnswers, setInlineAnswers] = useState<Record<number, number | null>>({});
  const [inlineVerified, setInlineVerified] = useState<Record<number, boolean>>({});
  const [inlineFeedback, setInlineFeedback] = useState<Record<number, { isCorrect: boolean; text: string }>>({});

  const handleSelectInlineOption = (optIdx: number) => {
    setInlineAnswers((prev) => ({ ...prev, [activeChunkIndex]: optIdx }));
  };

  const handleVerifyInlineAnswer = async () => {
    const selected = inlineAnswers[activeChunkIndex];
    const speedCheck = currentChunk?.speed_check;
    if (selected === undefined || selected === null || !speedCheck) return;

    const isCorrect = selected === speedCheck.correct_option_index;
    setInlineVerified((prev) => ({ ...prev, [activeChunkIndex]: true }));
    setInlineFeedback((prev) => ({
      ...prev,
      [activeChunkIndex]: {
        isCorrect,
        text: isCorrect
          ? `✓ Verified! ${speedCheck.explanation}`
          : `✗ Review needed. Correct answer is Option ${speedCheck.correct_option_index + 1}: "${speedCheck.options[speedCheck.correct_option_index]}". ${speedCheck.explanation}`,
      },
    }));

    // If incorrect, flag adaptive assistance and fetch Gemini analogy in background without forcing a disruptive view switch
    if (!isCorrect) {
      setIsAdaptiveAssistanceActive(true);

      // Check if we need to fetch a fresh Gemini real-world analogy
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
      // Preserve the user's manual view mode preference without forcing tab flips
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
      setIsSpeedCheckPassed(false);
    }
  };

  if (!currentChunk) {
    return <div className="p-8 text-center text-slate-400">No content available for this lesson.</div>;
  }

  const adaptation = currentChunk.cached_adaptations?.["OVERLOAD_SIMPLIFIED"];

  const getBadgeColor = (state: CognitiveState | undefined) => {
    switch (state) {
      case "OPTIMAL":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "OVERLOADED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "SKIMMING":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* 1. Fullscreen Focus Lock Shield Overlay */}
      <FocusLockShield
        isLockedInFocus={isLockedInFocus}
        blockReason={blockReason}
        onRequestFullscreen={requestFullscreenLock}
      />

      {/* 2. Top Minimalist Study Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-20 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-300">
            {lessonTitle}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${((activeChunkIndex + 1) / chunks.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {activeChunkIndex + 1} / {chunks.length}
            </span>
          </div>
        </div>

        {/* Clean Focus Status Badge (Overwhelming numbers moved to X-Ray drawer) */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-2 ${getBadgeColor(
              activeEvaluation?.cognitive_state
            )}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
            <span>
              {activeEvaluation?.cognitive_state === "OPTIMAL"
                ? "Deep Focus"
                : activeEvaluation?.cognitive_state === "OVERLOADED"
                ? "Reviewing Concepts"
                : activeEvaluation?.cognitive_state === "SKIMMING"
                ? "Fast Paced"
                : "Focus Active"}
            </span>
          </div>
        </div>
      </header>

      {/* 3. Main Reading Area (Minimalist Typography) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 flex flex-col justify-between">
        <div ref={containerRef} className="space-y-6">
          {/* Chunk Header with Explicit Learning Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {currentChunk.title || `Concept Section ${activeChunkIndex + 1}`}
            </h1>

            {/* Mode Toggle: Technical Deep Dive vs Real-World Analogy */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveViewMode("ORIGINAL")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeViewMode === "ORIGINAL"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>📘</span>
                <span>Code & Deep Dive</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveViewMode("ADAPTED")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeViewMode === "ADAPTED"
                    ? "bg-amber-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>💡</span>
                <span>Real-Life Analogy</span>
              </button>
            </div>
          </div>

          {/* Active Adaptive Assistance Banner */}
          {isAdaptiveAssistanceActive && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>
                  <strong>Adaptive Assistance Active:</strong> Based on your recent answers, we are using simpler real-life analogies and intuitive step-by-step breakdowns.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAdaptiveAssistanceActive(false)}
                className="text-[11px] text-amber-400 hover:text-white underline cursor-pointer ml-3 shrink-0"
              >
                Reset Standard
              </button>
            </div>
          )}

          {/* Dynamic Content View (Original vs Morphed Real-World Analogy) */}
          {activeViewMode === "ORIGINAL" ? (
            <div className="space-y-4">
              <MarkdownCodeRenderer content={currentChunk.content} />
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              {isGeneratingAdaptation ? (
                <div className="p-8 rounded-2xl bg-slate-900/60 border border-indigo-500/30 text-center space-y-3">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs font-semibold text-indigo-300">
                    Gemini AI is crafting a real-life analogy for this topic...
                  </p>
                </div>
              ) : dynamicAdaptations[activeChunkIndex] ? (
                /* Dynamically generated Gemini real-world metaphor */
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-950/20 to-slate-900 border border-amber-500/30 text-slate-200 space-y-3 shadow-xl">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                      💡 Real-World Metaphor
                    </div>
                    <p className="text-sm sm:text-base leading-relaxed text-amber-100 font-medium">
                      {dynamicAdaptations[activeChunkIndex].real_world_metaphor}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      {dynamicAdaptations[activeChunkIndex].simplified_analogy}
                    </p>
                  </div>

                  {/* 3-Step Walkthrough */}
                  {dynamicAdaptations[activeChunkIndex].step_by_step_walkthrough?.length > 0 && (
                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        Plain-English 3-Step Walkthrough
                      </div>
                      <div className="space-y-2">
                        {dynamicAdaptations[activeChunkIndex].step_by_step_walkthrough.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950 text-xs text-slate-300">
                            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                              {sIdx + 1}
                            </span>
                            <span className="leading-5">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Simplified Code Example */}
                  {dynamicAdaptations[activeChunkIndex].simplified_code_example && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Ultra-Simple Code Example
                      </div>
                      <MarkdownCodeRenderer content={dynamicAdaptations[activeChunkIndex].simplified_code_example || ""} />
                    </div>
                  )}
                </div>
              ) : (
                /* Pre-cached adaptation fallback */
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-slate-200">
                    <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                      Cognitive Adaptation: Visual Analogy
                    </div>
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                      {adaptation?.simplified_markdown ||
                        "Think of this concept like an everyday kitchen receipt or classroom whiteboard: states change in memory first, and the display reflects the new values cleanly."}
                    </div>
                  </div>

                  {adaptation?.mermaid_diagram && (
                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center font-mono text-xs text-indigo-300">
                      <div className="text-slate-400 text-xs mb-3 font-sans">
                        Architecture Workflow (Mermaid)
                      </div>
                      <pre className="text-left bg-slate-950 p-4 rounded-xl border border-slate-800/80 overflow-x-auto text-emerald-400">
                        {adaptation.mermaid_diagram}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Interactive Topic Comprehension Checkpoint ("Judge What You Learned") */}
          {currentChunk.speed_check && (
            <div className="mt-10 p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Comprehension Checkpoint: Judge What You Learned
                  </span>
                </div>
                {inlineVerified[activeChunkIndex] && inlineFeedback[activeChunkIndex]?.isCorrect && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
                    ✓ Verified Comprehension
                  </span>
                )}
              </div>

              <h4 className="text-base font-bold text-white leading-snug">
                {currentChunk.speed_check.question}
              </h4>

              <div className="space-y-2 pt-1">
                {currentChunk.speed_check.options.map((opt, optIdx) => {
                  const isSelected = inlineAnswers[activeChunkIndex] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectInlineOption(optIdx)}
                      className={`w-full text-left p-3.5 rounded-xl text-xs sm:text-sm border transition flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-600/20 text-white font-medium shadow-md shadow-indigo-500/10"
                          : "border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span>{opt}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 ml-2"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback Alert */}
              {inlineFeedback[activeChunkIndex] && (
                <div
                  className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                    inlineFeedback[activeChunkIndex].isCorrect
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                  }`}
                >
                  {inlineFeedback[activeChunkIndex].text}
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleVerifyInlineAnswer}
                  disabled={inlineAnswers[activeChunkIndex] === undefined || inlineAnswers[activeChunkIndex] === null}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs transition disabled:opacity-40 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {inlineVerified[activeChunkIndex] ? "Re-evaluate Answer" : "Judge My Answer →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Bottom Progression Bar & Gating Controls */}
        <div className="pt-12 border-t border-slate-900 flex items-center justify-between">
          <button
            onClick={handlePrevChunk}
            disabled={activeChunkIndex === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-medium border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            ← Previous
          </button>

          <span className="text-xs text-slate-500 font-sans">
            Section {activeChunkIndex + 1} of {chunks.length}
          </span>

          <button
            onClick={handleNextChunk}
            disabled={isSpeedCheckOpen}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            {activeChunkIndex === chunks.length - 1 ? "Complete Lesson ✓" : "Next Concept →"}
          </button>
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

      {/* 5. In-line Conceptual Speed-Check Modal (Gated Skimming Prevention) */}
      {isSpeedCheckOpen && currentChunk.speed_check && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>Speed-Check Gating (Skimming Detected)</span>
            </div>

            <h3 className="text-lg font-bold text-white">
              {currentChunk.speed_check.question}
            </h3>

            <div className="space-y-2 pt-2">
              {currentChunk.speed_check.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOption(idx)}
                  className={`w-full text-left p-3.5 rounded-xl text-sm border transition ${
                    selectedOption === idx
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {quizError && <p className="text-rose-400 text-xs pt-1">{quizError}</p>}

            <button
              onClick={handleVerifyAnswer}
              disabled={selectedOption === null}
              className="w-full mt-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition disabled:opacity-40"
            >
              Verify Answer & Unlock Next Concept
            </button>
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

