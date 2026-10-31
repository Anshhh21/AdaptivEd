"use client";

import React, { useEffect, useRef, useState } from "react";
import AnimatedContent from "../components/AnimatedContent";
import { AdaptiveChunkReader } from "../components/AdaptiveChunkReader";
import { AIStudyHub } from "../components/AIStudyHub";
import { AuthModal, UserSession } from "../components/AuthModal";
import { API_BASE_URL } from "../config/api";
import GradientWaves from "../components/GradientWaves";
import { LessonCompleteModal } from "../components/LessonCompleteModal";
import { SettingsModal } from "../components/SettingsModal";
import SpecularButton from "../components/SpecularButton";
import { TopicModule } from "../types/curriculum";

export default function Home() {
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<"hub" | "reader" | "arena">("hub");
  const [selectedTopic, setSelectedTopic] = useState<TopicModule | null>(null);
  const [selectedTechTitle, setSelectedTechTitle] = useState<string>("Adaptive Topic");

  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<"signin" | "signup">("signup");
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState<boolean>(false);

  // Profile dropdown menu toggle state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Load user session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("adaptived_user");
      if (stored) {
        setUserSession(JSON.parse(stored));
      }
    } catch {
      // Browser storage fallback
    }
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // When learner clicks a specific topic from the syllabus
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
      fetch(`${API_BASE_URL}/api/v1/auth/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userSession.user_id,
          lesson_id: selectedTopic?.id || "adaptive-lesson",
          track_id: selectedTopic?.slug || "general",
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
    setIsProfileMenuOpen(false);
  };

  return (
    <div className="relative min-h-screen bg-black text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 overflow-x-hidden">
      {/* Dynamic Background: GradientWaves WebGL2 Shader */}
      <div className={`fixed inset-0 z-0 pointer-events-auto transition-opacity duration-700 ${currentView === "reader" ? "opacity-25" : "opacity-100"}`}>
        <GradientWaves
          horizonColor="#5227FF"
          waveColor="#FF9FFC"
          crestColor="#FFFFFF"
          speed={currentView === "reader" ? 0.15 : 0.3}
          amplitude={currentView === "reader" ? 1.5 : 2.5}
          relief={currentView === "reader" ? 0.5 : 1}
          lightAngle={120}
          mouseInteraction={currentView !== "reader"}
          swellOnClick={currentView !== "reader"}
          waveScale={0.49}
          parallaxStrength={currentView === "reader" ? 0.2 : 0.96}
        />
        {/* Dark overlay ensuring words are the highest priority */}
        <div
          className={`absolute inset-0 pointer-events-none transition-colors duration-500 ${
            currentView === "reader"
              ? "bg-black/92 backdrop-blur-md"
              : "bg-gradient-to-b from-black/55 via-black/45 to-black/75"
          }`}
        />
      </div>

      {/* 1. Minimal Top Navigation Bar */}
      <nav className="relative z-30 px-6 sm:px-12 py-5 flex items-center justify-between">
        {/* Left side: Clean & empty as requested (removed AI Curriculum Synthesizer, badges, etc.) */}
        <div>
          {hasStarted && (
            <button
              onClick={() => {
                setHasStarted(false);
                setCurrentView("hub");
              }}
              type="button"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer bg-white/[0.04] backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
            >
              <span>←</span>
              <span>Home</span>
            </button>
          )}
        </div>

        {/* Right side: Profile Option with Outline Man Icon and Dropdown */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            type="button"
            className="p-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 transition-all cursor-pointer backdrop-blur-md flex items-center justify-center text-slate-300 hover:text-white"
            aria-label="User Profile and Settings"
            title="Profile & Settings"
          >
            {/* Outline Person Icon: Only lines, no colors filled inside */}
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Text-Only Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/10 shadow-2xl p-2 z-50 animate-fadeIn">
              {userSession ? (
                <div className="px-3 py-2.5 border-b border-white/10 mb-1">
                  <div className="text-xs font-medium text-white truncate">
                    {userSession.display_name}
                  </div>
                  <div className="text-[11px] text-purple-300/80 font-mono mt-0.5">
                    Level {(userSession.comprehension_score || 6.5).toFixed(1)}/10
                  </div>
                </div>
              ) : null}

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-normal text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
                >
                  Settings
                </button>

                {!userSession ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAuthDefaultMode("signup");
                        setIsAuthOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-normal text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
                    >
                      Sign Up
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAuthDefaultMode("signin");
                        setIsAuthOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-normal text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-xs font-normal text-rose-400/90 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* 2. Main Content Viewport */}
      <main className="relative z-10 flex-1 flex flex-col justify-center">
        {!hasStarted ? (
          /* Landing Page: Center big bold AdaptivEd, statement line, and Specular "Get Started" button */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 -mt-8">
            <AnimatedContent distance={30} duration={0.8} ease="power3.out" trigger="mount">
              <div className="max-w-3xl mx-auto flex flex-col items-center space-y-7">
                {/* Big Bold AdaptivEd Title */}
                <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tight text-white select-none drop-shadow-2xl">
                  AdaptivEd
                </h1>

                {/* Subtitle Statement */}
                <p className="max-w-xl text-slate-300/90 text-sm sm:text-base md:text-lg font-light leading-relaxed tracking-wide">
                  Learn in a new way by your own capacity, so that learning is fun
                  again with the help of AI.
                </p>

                {/* SpecularButton from React Bits */}
                <div className="pt-4">
                  <SpecularButton
                    size="lg"
                    radius={18}
                    tint="#ffffff"
                    tintOpacity={0.06}
                    textColor="#f5f5f5"
                    lineColor="#ffffff"
                    baseColor="#666666"
                    intensity={1.5}
                    idleIntensity={0.6}
                    shineSize={18}
                    shineFade={40}
                    thickness={2.0}
                    glow={1.4}
                    autoAnimate={true}
                    speed={0.4}
                    followMouse={true}
                    proximity={250}
                    onClick={() => setHasStarted(true)}
                  >
                    Get Started
                  </SpecularButton>
                </div>
              </div>
            </AnimatedContent>
          </div>
        ) : (
          /* AI Learning Hub / Workstation (Opened upon clicking Get Started) */
          <div className="w-full pb-16 animate-fadeIn">
            {currentView === "hub" && (
              <AIStudyHub
                onSelectTopic={handleSelectTopic}
                onOpenArena={() => setCurrentView("arena")}
                userSession={userSession}
                onUpdateSession={setUserSession}
              />
            )}

            {currentView === "reader" && (
              <div>
                {selectedTopic ? (
                  <AdaptiveChunkReader
                    lessonId={selectedTopic.slug}
                    lessonTitle={selectedTopic.title}
                    chunks={selectedTopic.chunks}
                    learnerId={userSession?.user_id || "learner_anonymous"}
                    onLessonComplete={handleLessonComplete}
                    onBack={() => setCurrentView("hub")}
                    onScoreUpdated={(newScore) => {
                      if (userSession) {
                        setUserSession((prev) =>
                          prev ? { ...prev, comprehension_score: newScore } : null
                        );
                      }
                    }}
                  />
                ) : (
                  <div className="max-w-md mx-auto py-20 text-center space-y-4">
                    <p className="text-slate-400 text-sm">No active topic selected.</p>
                    <button
                      onClick={() => setCurrentView("hub")}
                      className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 rounded-xl text-white text-xs font-semibold cursor-pointer transition"
                    >
                      Return to Courses
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentView === "arena" && (
              <div className="max-w-4xl mx-auto px-6 py-12 space-y-8 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase font-mono tracking-wider text-purple-400 mb-1">
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
                    className="text-xs px-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    ← Back to Courses
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md space-y-3">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      <span>Tactic 1: Zero-Clone GitHub Tree Audit</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Recursively inspects file hierarchies, hook architecture, and modularity without local cloning.
                    </p>
                    <div className="font-mono text-xs text-purple-300 bg-white/[0.03] p-2.5 rounded-lg border border-white/10">
                      POST /api/v1/arena/audit-repo
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md space-y-3">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>Tactic 2: Live Vercel Deployment Check</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Real-time HTTP probing, SSL verification, sub-150ms TTFB latency benchmarks, and OpenGraph audit.
                    </p>
                    <div className="font-mono text-xs text-emerald-400 bg-white/[0.03] p-2.5 rounded-lg border border-white/10">
                      POST /api/v1/arena/audit-deployment
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md space-y-3">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>Tactic 3: AST-Driven Architectural Viva</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      3 timed defense questions referencing candidate's exact line numbers to catch LLM hallucination.
                    </p>
                    <div className="font-mono text-xs text-amber-300 bg-white/[0.03] p-2.5 rounded-lg border border-white/10">
                      POST /api/v1/arena/viva/generate
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md space-y-3">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <span>Tactic 4: Live Chaos / Sabotage Debugging</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Injected track-specific production bugs (stale closures, ESR violations) fixed inside Monaco Editor.
                    </p>
                    <div className="font-mono text-xs text-rose-300 bg-white/[0.03] p-2.5 rounded-lg border border-white/10">
                      POST /api/v1/arena/chaos/verify
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Clean Footer with LinkedIn and GitHub links */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 bg-black/30 backdrop-blur-sm">
        <div className="text-slate-500 font-light">
          AdaptivEd • Adaptive Cognitive Comprehension Engine
        </div>
        <div className="flex items-center gap-6">
          <a
            href="https://www.linkedin.com/in/ansh-sharma-855572237/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>LinkedIn</span>
            <span className="text-[10px] text-slate-600">↗</span>
          </a>
          <a
            href="https://github.com/Anshhh21/AdaptivEd.git"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>GitHub</span>
            <span className="text-[10px] text-slate-600">↗</span>
          </a>
        </div>
      </footer>

      {/* Auth Modal (Sign Up / Sign In) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(session) => setUserSession(session)}
        defaultMode={authDefaultMode}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Lesson Complete Celebration Modal */}
      <LessonCompleteModal
        isOpen={isCompleteOpen}
        lessonTitle={selectedTopic?.title || "Adaptive Topic"}
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
