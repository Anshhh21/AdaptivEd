"use client";

import React from "react";
import SpecularButton from "./SpecularButton";

interface LessonCompleteModalProps {
  isOpen: boolean;
  lessonTitle: string;
  xpEarned?: number;
  streakDays?: number;
  onReturnToCatalog: () => void;
}

/**
 * LessonCompleteModal Component
 * Fires when the learner completes all chunks of a lesson.
 * Awards XP, updates streaks, and provides a direct path back to courses.
 */
export const LessonCompleteModal: React.FC<LessonCompleteModalProps> = ({
  isOpen,
  lessonTitle,
  xpEarned = 150,
  streakDays = 2,
  onReturnToCatalog,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-complete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6 transition-all duration-300"
    >
      <div className="relative max-w-md w-full bg-white/[0.03] border border-white/10 rounded-3xl p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl space-y-6 animate-fadeIn">
        {/* Minimalist Outline Trophy Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-emerald-400">
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
            <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-medium">
            Lesson Completed
          </div>
          <h2 id="lesson-complete-title" className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            {lessonTitle}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-light">
            Your reading dwell metrics and verified comprehension score have been persisted to MongoDB Atlas.
          </p>
        </div>

        {/* Minimalist Stats Summary */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Cognitive XP</div>
            <div className="text-lg font-medium text-emerald-400">+{xpEarned} XP</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-slate-400 font-mono">Active Streak</div>
            <div className="text-lg font-medium text-purple-300">{streakDays} Days</div>
          </div>
        </div>

        {/* Action Button: Return to Courses */}
        <div className="pt-2 flex justify-center">
          <SpecularButton
            size="lg"
            radius={16}
            tint="#ffffff"
            tintOpacity={0.08}
            textColor="#ffffff"
            lineColor="#ffffff"
            baseColor="#666666"
            intensity={1.3}
            idleIntensity={0.5}
            onClick={onReturnToCatalog}
          >
            Back to Courses
          </SpecularButton>
        </div>
      </div>
    </div>
  );
};
