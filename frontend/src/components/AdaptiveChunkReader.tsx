"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAttentionTracker } from "../hooks/useAttentionTracker";
import { useChunkTelemetry } from "../hooks/useChunkTelemetry";
import { useFullscreenLock } from "../hooks/useFullscreenLock";
import { BCSEvaluationResponse, ChunkTelemetryPayload, CognitiveState } from "../types/telemetry";
import { DeveloperXRayDrawer } from "./DeveloperXRayDrawer";
import { FocusLockShield } from "./FocusLockShield";
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
  useEffect(() => {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws/telemetry/${learnerId}`;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.score !== undefined) {
          const evalRes = data as BCSEvaluationResponse;
          setActiveEvaluation(evalRes);

          // Handle automatic adaptation triggers
          if (evalRes.requires_adaptation && activeViewMode === "ORIGINAL") {
            setActiveViewMode("ADAPTED");
          }

          // Handle skimming speed-check triggers
          if (evalRes.requires_speed_check && !isSpeedCheckPassed) {
            setIsSpeedCheckOpen(true);
          }
        }
      } catch (err) {
        console.warn("Telemetry socket parse error:", err);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [learnerId, activeViewMode, isSpeedCheckPassed]);

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

  const handleNextChunk = () => {
    if (activeChunkIndex < chunks.length - 1) {
      setActiveChunkIndex((prev) => prev + 1);
      setActiveViewMode("ORIGINAL");
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
      setActiveViewMode("ORIGINAL");
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
          {/* Chunk Header */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {currentChunk.title || `Concept Section ${activeChunkIndex + 1}`}
            </h1>

            {/* Adaptation Morph Toggle */}
            {adaptation && (
              <button
                onClick={() =>
                  setActiveViewMode((prev) => (prev === "ORIGINAL" ? "ADAPTED" : "ORIGINAL"))
                }
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{activeViewMode === "ORIGINAL" ? "Visual Analogy" : "Deep Dive"}</span>
              </button>
            )}
          </div>

          {/* Dynamic Content View (Original vs Morphed Analogy) */}
          {activeViewMode === "ORIGINAL" ? (
            <div className="prose prose-invert prose-slate max-w-none text-slate-200 text-base leading-relaxed space-y-4">
              <p>{currentChunk.content}</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                  Cognitive Adaptation: Visual Analogy
                </div>
                <div className="prose prose-invert max-w-none text-sm text-slate-300 whitespace-pre-line">
                  {adaptation?.simplified_markdown}
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

