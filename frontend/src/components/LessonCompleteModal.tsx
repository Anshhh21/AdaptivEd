"use client";

import React from "react";

interface LessonCompleteModalProps {
  isOpen: boolean;
  lessonTitle: string;
  xpEarned?: number;
  streakDays?: number;
  onReturnToCatalog: () => void;
  onGoToArena: () => void;
}

/**
 * LessonCompleteModal Component
 * Fires when the learner completes all chunks of a lesson.
 * Awards XP, updates streaks, and provides clear routes back to the catalog or into the Arena.
 */
export const LessonCompleteModal: React.FC<LessonCompleteModalProps> = ({
  isOpen,
  lessonTitle,
  xpEarned = 150,
  streakDays = 2,
  onReturnToCatalog,
  onGoToArena,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-complete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-6 transition-all duration-300"
    >
      <div className="relative max-w-lg w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-6">
        {/* Celebration Trophy Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <span className="text-4xl animate-bounce">🏆</span>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-semibold">
            Concept Module Mastered
          </div>
          <h2 id="lesson-complete-title" className="text-2xl font-bold text-white tracking-tight">
            {lessonTitle}
          </h2>
          <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
            Your dwell time and behavioral comprehension metrics have been validated and saved to your
            persistent profile.
          </p>
        </div>

        {/* Rewards Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Cognitive XP</div>
            <div className="text-xl font-bold text-emerald-400">+{xpEarned} XP</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Focus Streak</div>
            <div className="text-xl font-bold text-amber-400">{streakDays} Days 🔥</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onGoToArena}
            type="button"
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition cursor-pointer"
          >
            Verify Skills in Proof-of-Work Arena →
          </button>

          <button
            onClick={onReturnToCatalog}
            type="button"
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Back to Course Catalog
          </button>
        </div>
      </div>
    </div>
  );
};

