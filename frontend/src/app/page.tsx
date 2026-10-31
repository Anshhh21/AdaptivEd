"use client";

import React, { useEffect, useState } from "react";
import { AdaptiveChunkReader, SemanticChunkData } from "../components/AdaptiveChunkReader";
import { AIStudyHub } from "../components/AIStudyHub";
import { AuthModal, UserSession } from "../components/AuthModal";
import { BYOCModal } from "../components/BYOCModal";
import { LessonCompleteModal } from "../components/LessonCompleteModal";
import { SettingsModal } from "../components/SettingsModal";
import { FRONTEND_CURRICULUM, TopicModule } from "../data/curriculum";

export default function Home() {
  const [currentView, setCurrentView] = useState<"hub" | "reader" | "arena">("hub");
  const [selectedTopic, setSelectedTopic] = useState<TopicModule>(
    FRONTEND_CURRICULUM[0].topics[0]
  );
  const [selectedTechTitle, setSelectedTechTitle] = useState<string>("CSS Architecture");

  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState<boolean>(false);
  const [isBYOCOpen, setIsBYOCOpen] = useState<boolean>(false);

  // Load user session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("adaptived_user");
      if (stored) {
        setUserSession(JSON.parse(stored));
      }
    } catch {
      // Ignored in non-browser environments
    }
  }, []);

  // When learner clicks a specific topic from the syllabus (e.g., Tailwind or Closures)
  const handleSelectTopic = (topic: TopicModule, techName: string) => {
    setSelectedTopic(topic);
    setSelectedTechTitle(techName);
    setCurrentView("reader");
  };

  const handleLessonComplete = () => {
    if (userSession) {
      const updated: UserSession = {
        ...userSession,
        total_xp: userSession.total_xp + 150,
        current_streak_days: Math.max(1, userSession.current_streak_days),
      };
      setUserSession(updated);
      localStorage.setItem("adaptived_user", JSON.stringify(updated));

      // Persist progress to MongoDB Atlas
      fetch("http://127.0.0.1:8000/api/v1/auth/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userSession.user_id,
          lesson_id: selectedTopic.id,
          track_id: selectedTopic.slug,
          xp_earned: 150,
          bcs_score: 0.92,
        }),
      }).catch((err) => {
        console.warn("Failed to persist progress to MongoDB Atlas:", err);
      });
    }
    setIsCompleteOpen(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem("adaptived_user");
    setUserSession(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* 1. Minimalist Top Navigation Bar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-6 sm:px-8 py-3.5 flex items-center justify-between">
        <button
          onClick={() => setCurrentView("hub")}
          className="flex items-center gap-3 hover:opacity-90 transition text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            A
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              <span>AdaptivEd</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                NeuroLearn
              </span>
            </div>
            <div className="text-[10px] text-slate-400">Behavioral Comprehension Engine</div>
          </div>
        </button>

        {/* Right Action Icons: BYOC, Settings & Account */}
        <div className="flex items-center gap-3">
          {/* BYOC Upload Shortcut */}
          <button
            onClick={() => setIsBYOCOpen(true)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition cursor-pointer"
            title="Upload custom study notes, markdown or PDF"
          >
            <span>📄</span>
            <span className="hidden sm:inline">Upload Notes (BYOC)</span>
          </button>

          {/* Settings Button (Ablation Studio lives inside here) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            type="button"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition cursor-pointer"
            title="Open Platform Settings & Ablation Studio"
          >
            <span className="text-sm">⚙️</span>
          </button>

          {/* User Sign Up / Profile Button */}
          {userSession ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAuthOpen(true)}
                type="button"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs hover:border-slate-700 transition cursor-pointer"
                title={`Logged in as ${userSession.email}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-white">{userSession.display_name}</span>
                <span className="text-amber-400 font-mono text-[11px]">🔥 {userSession.current_streak_days}d</span>
                <span className="text-indigo-400 font-mono text-[11px]">+{userSession.total_xp} XP</span>
              </button>
              <button
                onClick={handleSignOut}
                type="button"
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs transition cursor-pointer"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              type="button"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              Sign Up / Sign In
            </button>
          )}
        </div>
      </nav>

      {/* 2. Main Viewport */}
      <main className="flex-1">
        {/* AI Learning & Ingestion Hub (All-In BYOC & Synthesis) */}
        {currentView === "hub" && (
          <AIStudyHub
            onSelectTopic={handleSelectTopic}
            onOpenArena={() => setCurrentView("arena")}
          />
        )}

        {/* Minimalist Study Reader (Only opens when a topic is selected!) */}
        {currentView === "reader" && (
          <div className="space-y-4">
            <div className="max-w-2xl mx-auto px-6 pt-4 flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={() => setCurrentView("hub")}
                className="hover:text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>← Back to Topics Syllabus</span>
              </button>
              <span className="font-mono text-indigo-400">{selectedTechTitle}</span>
            </div>

            <AdaptiveChunkReader
              lessonId={selectedTopic.slug}
              lessonTitle={selectedTopic.title}
              chunks={selectedTopic.chunks}
              learnerId={userSession?.user_id || "learner_anonymous"}
              onLessonComplete={handleLessonComplete}
            />
          </div>
        )}

        {/* Proof-of-Work Arena */}
        {currentView === "arena" && (
          <div className="max-w-4xl mx-auto px-6 py-12 space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-mono tracking-wider text-indigo-400 mb-1">
                  Phase 6 Verification
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  Proof-of-Work Verification Arena
                </h1>
                <p className="text-slate-400 text-xs mt-1">
                  Using AI is allowed, but blind vibe-coding is caught. Submit your production repository.
                </p>
              </div>

              <button
                onClick={() => setCurrentView("hub")}
                className="text-xs px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              >
                ← Back to Courses
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span>Tactic 1: Zero-Clone GitHub Tree Audit</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Recursively inspects file hierarchies, hook architecture, and modularity without local cloning.
                </p>
                <div className="font-mono text-xs text-emerald-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  POST /api/v1/arena/audit-repo
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Tactic 2: Live Vercel Deployment Check</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time HTTP probing, SSL verification, sub-150ms TTFB latency benchmarks, and OpenGraph audit.
                </p>
                <div className="font-mono text-xs text-emerald-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  POST /api/v1/arena/audit-deployment
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Tactic 3: AST-Driven Architectural Viva</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  3 timed defense questions referencing candidate's exact line numbers to catch LLM hallucination.
                </p>
                <div className="font-mono text-xs text-emerald-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  POST /api/v1/arena/viva/generate
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>Tactic 4: Live Chaos / Sabotage Debugging</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Injected track-specific production bugs (stale closures, ESR violations) fixed inside Monaco Editor.
                </p>
                <div className="font-mono text-xs text-emerald-400 bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  POST /api/v1/arena/chaos/verify
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Auth / Account Profile Modal (Sign Up First + Google Auth) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(session) => setUserSession(session)}
        defaultMode="signup"
      />

      {/* BYOC Upload Modal */}
      <BYOCModal
        isOpen={isBYOCOpen}
        onClose={() => setIsBYOCOpen(false)}
        onLaunchStudy={(topic, trackName) => {
          setSelectedTopic(topic);
          setSelectedTechTitle(trackName);
          setCurrentView("reader");
        }}
      />

      {/* Settings Modal (Ablation Studio is housed here) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Lesson Complete Celebration Modal */}
      <LessonCompleteModal
        isOpen={isCompleteOpen}
        lessonTitle={selectedTopic.title}
        streakDays={userSession?.current_streak_days || 1}
        onReturnToCatalog={() => {
          setIsCompleteOpen(false);
          setCurrentView("hub");
        }}
        onGoToArena={() => {
          setIsCompleteOpen(false);
          setCurrentView("arena");
        }}
      />
    </div>
  );
}
