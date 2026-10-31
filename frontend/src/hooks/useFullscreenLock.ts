"use client";

import { useCallback, useEffect, useState } from "react";
import { FocusBlockReason, FullscreenLockState } from "../types/telemetry";

interface UseFullscreenLockReturn extends FullscreenLockState {
  requestFullscreenLock: () => Promise<boolean>;
  exitFullscreenLock: () => Promise<void>;
}

/**
 * useFullscreenLock Hook
 * Enforces deep-focus reading by monitoring:
 * 1. Document fullscreen status (HTML5 Fullscreen API).
 * 2. Tab visibility state ('visibilitychange').
 * 3. Window blur/focus events.
 *
 * Telemetry accumulation and lesson progression are only permitted when
 * `isLockedInFocus` is true. Any distraction or tab switch immediately flags a blockReason.
 */
export function useFullscreenLock(): UseFullscreenLockReturn {
  const [state, setState] = useState<FullscreenLockState>({
    isFullscreen: false,
    isTabVisible: true,
    isWindowFocused: true,
    isLockedInFocus: false,
    blockReason: "NOT_FULLSCREEN",
  });

  const evaluateState = useCallback(
    (fullscreen: boolean, tabVisible: boolean, windowFocused: boolean): FullscreenLockState => {
      let blockReason: FocusBlockReason = null;

      if (!fullscreen) {
        blockReason = "NOT_FULLSCREEN";
      } else if (!tabVisible) {
        blockReason = "TAB_HIDDEN";
      } else if (!windowFocused) {
        blockReason = "WINDOW_BLURRED";
      }

      const isLockedInFocus = fullscreen && tabVisible && windowFocused;

      return {
        isFullscreen: fullscreen,
        isTabVisible: tabVisible,
        isWindowFocused: windowFocused,
        isLockedInFocus,
        blockReason,
      };
    },
    []
  );

  const checkFullscreenElement = useCallback((): boolean => {
    if (typeof document === "undefined") return false;
    return Boolean(
      document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );
  }, []);

  const handleFullscreenChange = useCallback(() => {
    const isFs = checkFullscreenElement();
    const isTab = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
    const isWin = typeof document !== "undefined" ? document.hasFocus() : true;

    setState(evaluateState(isFs, isTab, isWin));
  }, [checkFullscreenElement, evaluateState]);

  const handleVisibilityChange = useCallback(() => {
    const isFs = checkFullscreenElement();
    const isTab = document.visibilityState === "visible";
    const isWin = document.hasFocus();

    setState(evaluateState(isFs, isTab, isWin));
  }, [checkFullscreenElement, evaluateState]);

  const handleWindowFocus = useCallback(() => {
    const isFs = checkFullscreenElement();
    const isTab = document.visibilityState === "visible";
    setState(evaluateState(isFs, isTab, true));
  }, [checkFullscreenElement, evaluateState]);

  const handleWindowBlur = useCallback(() => {
    const isFs = checkFullscreenElement();
    const isTab = document.visibilityState === "visible";
    setState(evaluateState(isFs, isTab, false));
  }, [checkFullscreenElement, evaluateState]);

  const requestFullscreenLock = useCallback(async (): Promise<boolean> => {
    if (typeof document === "undefined") return false;

    try {
      const rootElem = document.documentElement;
      if (rootElem.requestFullscreen) {
        await rootElem.requestFullscreen();
      } else if ((rootElem as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
        await (rootElem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.error("Failed to acquire fullscreen focus lock:", error);
      return false;
    }
  }, []);

  const exitFullscreenLock = useCallback(async (): Promise<void> => {
    if (typeof document === "undefined") return;

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Failed to exit fullscreen lock:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Initial evaluation
    const initialFs = checkFullscreenElement();
    const initialTab = document.visibilityState === "visible";
    const initialWin = document.hasFocus();
    setState(evaluateState(initialFs, initialTab, initialWin));

    // Event listeners
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    checkFullscreenElement,
    evaluateState,
    handleFullscreenChange,
    handleVisibilityChange,
    handleWindowFocus,
    handleWindowBlur,
  ]);

  return {
    ...state,
    requestFullscreenLock,
    exitFullscreenLock,
  };
}

