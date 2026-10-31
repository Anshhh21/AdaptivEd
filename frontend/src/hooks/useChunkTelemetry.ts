"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChunkTelemetryPayload } from "../types/telemetry";

interface UseChunkTelemetryProps {
  chunkId: string;
  lessonId: string;
  isLockedInFocus: boolean;
  flushIntervalMs?: number;
  onTick?: (payload: ChunkTelemetryPayload) => void;
}

interface UseChunkTelemetryReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  payload: ChunkTelemetryPayload;
  resetTelemetry: () => void;
  recordAttentionScore: (score: number | null) => void;
}

/**
 * useChunkTelemetry Hook
 * High-precision telemetry accumulator for active reading chunks.
 *
 * Buffers:
 * 1. Active dwell milliseconds (accumulated strictly when isLockedInFocus is true).
 * 2. Directional upward scroll regressions (re-reading behavior).
 * 3. Text selection/highlight interactions.
 * 4. Code snippet copy events.
 * 5. Optional local MediaPipe gaze/attention scores.
 */
export function useChunkTelemetry({
  chunkId,
  lessonId,
  isLockedInFocus,
  flushIntervalMs = 1000,
  onTick,
}: UseChunkTelemetryProps): UseChunkTelemetryReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Buffered telemetry metrics held in refs to prevent render thrashing
  const dwellTimeMsRef = useRef<number>(0);
  const activeDwellTimeMsRef = useRef<number>(0);
  const scrollUpRegressionsRef = useRef<number>(0);
  const textHighlightsCountRef = useRef<number>(0);
  const codeCopiesCountRef = useRef<number>(0);
  const attentionScoreRef = useRef<number | null>(null);

  // Scroll debounce state
  const lastScrollTimeRef = useRef<number>(0);
  const lastTouchYRef = useRef<number>(0);

  // Sync state for UI consumers (e.g. Developer X-Ray drawer)
  const [payload, setPayload] = useState<ChunkTelemetryPayload>({
    chunk_id: chunkId,
    lesson_id: lessonId,
    dwell_time_ms: 0,
    active_dwell_time_ms: 0,
    scroll_up_regressions: 0,
    text_highlights_count: 0,
    code_copies_count: 0,
    attention_score: null,
  });

  const resetTelemetry = useCallback(() => {
    dwellTimeMsRef.current = 0;
    activeDwellTimeMsRef.current = 0;
    scrollUpRegressionsRef.current = 0;
    textHighlightsCountRef.current = 0;
    codeCopiesCountRef.current = 0;
    attentionScoreRef.current = null;
    setPayload({
      chunk_id: chunkId,
      lesson_id: lessonId,
      dwell_time_ms: 0,
      active_dwell_time_ms: 0,
      scroll_up_regressions: 0,
      text_highlights_count: 0,
      code_copies_count: 0,
      attention_score: null,
    });
  }, [chunkId, lessonId]);

  const recordAttentionScore = useCallback((score: number | null) => {
    if (score === null) {
      attentionScoreRef.current = null;
    } else {
      attentionScoreRef.current = Math.max(0.0, Math.min(1.0, score));
    }
  }, []);

  // 1. Dwell Accumulator & Periodic Flush Interval
  useEffect(() => {
    const tickRateMs = 100; // 10 Hz accumulator resolution
    let accumulatedFlushTimer = 0;

    const interval = setInterval(() => {
      // Wall clock dwell always advances
      dwellTimeMsRef.current += tickRateMs;

      // Active dwell ONLY advances when student is locked in focus
      if (isLockedInFocus) {
        activeDwellTimeMsRef.current += tickRateMs;
      }

      accumulatedFlushTimer += tickRateMs;

      // Flush when flushIntervalMs is reached
      if (accumulatedFlushTimer >= flushIntervalMs) {
        accumulatedFlushTimer = 0;

        const currentSnapshot: ChunkTelemetryPayload = {
          chunk_id: chunkId,
          lesson_id: lessonId,
          dwell_time_ms: dwellTimeMsRef.current,
          active_dwell_time_ms: activeDwellTimeMsRef.current,
          scroll_up_regressions: scrollUpRegressionsRef.current,
          text_highlights_count: textHighlightsCountRef.current,
          code_copies_count: codeCopiesCountRef.current,
          attention_score: attentionScoreRef.current,
        };

        setPayload(currentSnapshot);

        if (onTick && isLockedInFocus) {
          onTick(currentSnapshot);
        }
      }
    }, tickRateMs);

    return () => clearInterval(interval);
  }, [chunkId, lessonId, isLockedInFocus, flushIntervalMs, onTick]);

  // 2. Upward Scroll Regression Detection (Wheel & Touch)
  useEffect(() => {
    const container = containerRef.current || (typeof window !== "undefined" ? window : null);
    if (!container) return;

    const handleWheel = (e: Event) => {
      if (!isLockedInFocus) return;
      const wheelEvent = e as WheelEvent;

      // Negative deltaY indicates scrolling up towards previously read text
      if (wheelEvent.deltaY < -20) {
        const now = Date.now();
        // Debounce by 600ms to group continuous upward flicks into a single conceptual re-read
        if (now - lastScrollTimeRef.current > 600) {
          scrollUpRegressionsRef.current += 1;
          lastScrollTimeRef.current = now;
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        lastTouchYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isLockedInFocus || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - lastTouchYRef.current;

      // Swiping down moves viewport up (re-reading)
      if (deltaY > 30) {
        const now = Date.now();
        if (now - lastScrollTimeRef.current > 600) {
          scrollUpRegressionsRef.current += 1;
          lastScrollTimeRef.current = now;
        }
      }
      lastTouchYRef.current = currentY;
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouchStart as EventListener, { passive: true });
    container.addEventListener("touchmove", handleTouchMove as EventListener, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart as EventListener);
      container.removeEventListener("touchmove", handleTouchMove as EventListener);
    };
  }, [isLockedInFocus]);

  // 3. Text Selection / Highlight Interaction Listener
  useEffect(() => {
    if (typeof document === "undefined") return;

    let selectionDebounce: NodeJS.Timeout;

    const handleSelectionChange = () => {
      if (!isLockedInFocus) return;
      clearTimeout(selectionDebounce);
      selectionDebounce = setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 5) {
          // Verify selection intersects our chunk container
          if (
            containerRef.current &&
            selection.anchorNode &&
            containerRef.current.contains(selection.anchorNode)
          ) {
            textHighlightsCountRef.current += 1;
          }
        }
      }, 500);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      clearTimeout(selectionDebounce);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [isLockedInFocus]);

  // 4. Code Snippet Copy Event Listener
  useEffect(() => {
    const elem = containerRef.current;
    if (!elem) return;

    const handleCopy = (e: ClipboardEvent) => {
      if (!isLockedInFocus) return;
      // Target event within a <code> or <pre> element
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("pre") || target.closest("code"))) {
        codeCopiesCountRef.current += 1;
      }
    };

    elem.addEventListener("copy", handleCopy);
    return () => elem.removeEventListener("copy", handleCopy);
  }, [isLockedInFocus]);

  return {
    containerRef,
    payload,
    resetTelemetry,
    recordAttentionScore,
  };
}

