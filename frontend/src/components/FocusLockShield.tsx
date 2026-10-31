"use client";

import React from "react";
import { FocusBlockReason } from "../types/telemetry";

interface FocusLockShieldProps {
  isLockedInFocus: boolean;
  blockReason: FocusBlockReason;
  onRequestFullscreen: () => Promise<boolean>;
}

/**
 * FocusLockShield Component
 * Un-dismissible immersive visual barrier presented whenever the student exits fullscreen,
 * switches tabs, or loses operating system window focus.
 * Blurs active learning material and pauses all cognitive telemetry.
 */
export const FocusLockShield: React.FC<FocusLockShieldProps> = ({
  isLockedInFocus,
  blockReason,
  onRequestFullscreen,
}) => {
  if (isLockedInFocus) {
    return null;
  }

  const getReasonDetails = (): { title: string; description: string; actionText: string } => {
    switch (blockReason) {
      case "NOT_FULLSCREEN":
        return {
          title: "Deep-Focus Fullscreen Required",
          description:
            "AdaptivEd's behavioral comprehension engine and XP streaks require an uninterrupted visual field. Enter fullscreen mode to resume your session.",
          actionText: "Enter Fullscreen Mode",
        };
      case "TAB_HIDDEN":
        return {
          title: "Learning Session Paused",
          description:
            "You switched to another browser tab. Telemetry timers and comprehension scoring have been frozen to protect your cognitive profile.",
          actionText: "Resume Active Focus",
        };
      case "WINDOW_BLURRED":
        return {
          title: "Window Focus Lost",
          description:
            "Another application or window pulled your operating system focus. Click back into this window to continue.",
          actionText: "Re-focus Reader",
        };
      default:
        return {
          title: "Focus Interrupted",
          description: "Click below to restore your deep-focus learning arena.",
          actionText: "Restore Focus",
        };
    }
  };

  const { title, description, actionText } = getReasonDetails();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="focus-shield-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-6 transition-all duration-300"
    >
      <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-indigo-400 animate-pulse"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h2
          id="focus-shield-title"
          className="text-2xl font-bold text-white tracking-tight mb-3"
        >
          {title}
        </h2>

        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          {description}
        </p>

        <button
          onClick={onRequestFullscreen}
          type="button"
          className="w-full inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 cursor-pointer"
        >
          {actionText}
        </button>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Telemetry & XP Accumulation Frozen</span>
        </div>
      </div>
    </div>
  );
};

