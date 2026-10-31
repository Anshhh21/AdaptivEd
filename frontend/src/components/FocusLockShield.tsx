"use client";

import React from "react";
import AnimatedContent from "./AnimatedContent";
import SpecularButton from "./SpecularButton";
import { FocusBlockReason } from "../types/telemetry";

interface FocusLockShieldProps {
  isLockedInFocus: boolean;
  blockReason: FocusBlockReason;
  onRequestFullscreen: () => Promise<boolean>;
}

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
          title: "Fullscreen Focus",
          description: "Deep learning requires an uninterrupted field of view. Step into fullscreen to continue your session.",
          actionText: "Enter Fullscreen",
        };
      case "TAB_HIDDEN":
        return {
          title: "Session Paused",
          description: "You navigated away from this tab. Timers and comprehension tracking are paused.",
          actionText: "Resume Session",
        };
      case "WINDOW_BLURRED":
        return {
          title: "Focus Paused",
          description: "Another app took focus. Click below to return to your reading session.",
          actionText: "Resume Reading",
        };
      default:
        return {
          title: "Session Interrupted",
          description: "Click below to restore your learning session.",
          actionText: "Resume",
        };
    }
  };

  const { title, description, actionText } = getReasonDetails();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="focus-shield-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6 transition-all duration-300"
    >
      <AnimatedContent distance={20} duration={0.6} ease="power3.out" trigger="mount">
        <div className="relative max-w-md w-full bg-white/[0.03] border border-white/10 rounded-3xl p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl space-y-6">
          {/* Minimalist Outline Icon */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-300">
            <svg
              className="w-7 h-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2
              id="focus-shield-title"
              className="text-xl sm:text-2xl font-semibold text-white tracking-tight"
            >
              {title}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-light">
              {description}
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <SpecularButton
              size="lg"
              radius={16}
              tint="#ffffff"
              tintOpacity={0.08}
              textColor="#ffffff"
              lineColor="#ffffff"
              baseColor="#666666"
              intensity={1.5}
              idleIntensity={0.6}
              thickness={1.8}
              glow={1.3}
              autoAnimate={true}
              speed={0.4}
              onClick={onRequestFullscreen}
              className="w-full justify-center text-center"
            >
              {actionText}
            </SpecularButton>
          </div>
        </div>
      </AnimatedContent>
    </div>
  );
};
