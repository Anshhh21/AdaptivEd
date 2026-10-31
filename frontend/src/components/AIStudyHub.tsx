"use client";

import React, { useState, useEffect } from "react";
import { TopicModule } from "../types/curriculum";
import { SemanticChunkData } from "./AdaptiveChunkReader";
import { UserSession } from "./AuthModal";

interface AIStudyHubProps {
  onSelectTopic: (topic: TopicModule, techName: string) => void;
  onOpenArena: () => void;
  userSession?: UserSession | null;
  onUpdateSession?: (session: UserSession) => void;
}

export const AIStudyHub: React.FC<AIStudyHubProps> = ({
  onSelectTopic,
  onOpenArena,
  userSession,
  onUpdateSession,
}) => {
  const [activeTab, setActiveTab] = useState<"url" | "document" | "notes">("url");
  const [strategy, setStrategy] = useState<"DIFFICULTY_FIRST" | "TIME_FIRST">(
    userSession?.learning_strategy || "DIFFICULTY_FIRST"
  );
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notesInput, setNotesInput] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentScore = userSession?.comprehension_score || 6.5;

  const handleToggleStrategy = async (newStrategy: "DIFFICULTY_FIRST" | "TIME_FIRST") => {
    setStrategy(newStrategy);
    if (userSession && onUpdateSession) {
      const updated: UserSession = { ...userSession, learning_strategy: newStrategy };
      onUpdateSession(updated);
      try {
        localStorage.setItem("adaptived_user", JSON.stringify(updated));
        await fetch("http://127.0.0.1:8000/api/v1/auth/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userSession.user_id,
            learning_strategy: newStrategy,
          }),
        });
      } catch (err) {
        console.warn("Failed to persist learning strategy to MongoDB:", err);
      }
    }
  };

  // Ingested Courses History
  const [savedCourses, setSavedCourses] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      totalTopics: number;
      source: string;
      topic: TopicModule;
    }>
  >([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("adaptived_saved_courses");
      if (stored) {
        setSavedCourses(JSON.parse(stored));
      }
    } catch {
      // Ignored
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!customTitle) {
        setCustomTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    }
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (activeTab === "url" && !urlInput.trim().startsWith("http")) {
      setErrorMsg("Please enter a valid website link (e.g. https://www.w3schools.com/js/).");
      return;
    }

    if (activeTab === "document" && !selectedFile) {
      setErrorMsg("Please choose a PDF, PPT/PPTX, Markdown or Text file.");
      return;
    }

    if (activeTab === "notes" && (!notesInput || notesInput.trim().length < 50)) {
      setErrorMsg("Please paste or type at least 50 characters of notes.");
      return;
    }

    setIsLoading(true);
    setLoadingStep("1/3 Extracting raw content & removing boilerplate noise...");

    try {
      const formData = new FormData();
      formData.append("comprehension_level", String(currentScore));
      formData.append("learning_strategy", strategy);

      if (customTitle.trim()) {
        formData.append("title", customTitle.trim());
      }

      if (activeTab === "url") {
        formData.append("url_input", urlInput.trim());
      } else if (activeTab === "document" && selectedFile) {
        formData.append("file", selectedFile);
      } else if (activeTab === "notes") {
        formData.append("raw_text_input", notesInput.trim());
      }

      setTimeout(() => {
        setLoadingStep("2/3 Synthesizing deep topic-wise explanations & code models...");
      }, 1800);

      setTimeout(() => {
        setLoadingStep("3/3 Generating comprehension verification checkpoints...");
      }, 4200);

      const res = await fetch("http://127.0.0.1:8000/api/v1/byoc/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.detail || "AI synthesis failed.");
      }

      const result = json.data;
      const chunks: SemanticChunkData[] = (result.chunks || []).map((c: any) => ({
        id: c.id,
        chunk_index: c.chunk_index,
        title: c.title || `Topic ${c.chunk_index + 1}`,
        content: c.content,
        sentence_count: c.sentence_count,
        word_count: c.word_count,
        flesch_kincaid_grade: c.flesch_kincaid_grade,
        target_dwell_ms: c.target_dwell_ms,
        speed_check: c.speed_check,
        cached_adaptations: c.cached_adaptations,
      }));

      const newTopic: TopicModule = {
        id: result.lesson_id,
        slug: result.slug,
        title: result.title,
        shortDescription: `AI Synthesized Course (${result.total_chunks} topics, ~${result.total_words} words)`,
        estimatedMinutes: Math.max(3, Math.round(result.total_words / 220)),
        chunks: chunks,
      };

      // Save to course history
      const newCourseEntry = {
        id: result.lesson_id,
        title: result.title,
        description: `Ingested from ${
          activeTab === "url"
            ? urlInput
            : activeTab === "document" && selectedFile
            ? selectedFile.name
            : "Notes"
        }`,
        totalTopics: result.total_chunks,
        source: activeTab,
        topic: newTopic,
      };

      const updatedHistory = [newCourseEntry, ...savedCourses.slice(0, 5)];
      setSavedCourses(updatedHistory);
      try {
        localStorage.setItem("adaptived_saved_courses", JSON.stringify(updatedHistory));
      } catch {
        // Ignored
      }

      onSelectTopic(newTopic, result.title);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to synthesize curriculum.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12 animate-fadeIn">
      {/* 1. Hero Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          AI Curriculum Synthesizer
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Turn Any Link, PDF, PPT or Notes Into An Adaptive Course
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mx-auto">
          Discard irrelevant cover pages and acknowledgments. Our AI breaks your content into
          structured, topic-wise deep explanations, tracks focus in real time, and judges what you actually learned.
        </p>
      </div>

      {/* 2. Main Ingestion Workstation */}
      <div className="relative rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Adaptive Comprehension Profile & Strategy Controller */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Dynamic 1.0 - 10.0 Comprehension Meter */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cognitive Comprehension Rating
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-mono text-emerald-400">MongoDB Synced</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                {currentScore.toFixed(1)}
                <span className="text-slate-500 text-sm font-sans font-normal"> / 10.0</span>
              </span>

              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                  currentScore < 5.0
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : currentScore < 7.5
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}
              >
                {currentScore < 5.0
                  ? "Foundational (Adapting simpler analogies)"
                  : currentScore < 7.5
                  ? "Proficient (Standard architectural depth)"
                  : "Advanced / Senior (Deep mechanics & edge cases)"}
              </span>
            </div>

            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  currentScore < 5.0 ? "bg-rose-500" : currentScore < 7.5 ? "bg-indigo-500" : "bg-amber-400"
                }`}
                style={{ width: `${Math.min(100, (currentScore / 10) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Right: Strategy Mode Selector (Difficulty-Based vs Time-Based) */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Learning Focus Strategy
            </div>

            <div className="inline-flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleToggleStrategy("DIFFICULTY_FIRST")}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  strategy === "DIFFICULTY_FIRST"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Calibrates content depth and question rigor to your exact comprehension score"
              >
                <span>🎯</span>
                <span>Difficulty-Based (Deep Mastery)</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStrategy("TIME_FIRST")}
                className={`px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  strategy === "TIME_FIRST"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Condenses into fast, surface-level high-yield takeaways for rapid reading"
              >
                <span>⚡</span>
                <span>Time-Based (Rapid Speed)</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 max-w-sm">
              {strategy === "DIFFICULTY_FIRST"
                ? `Prioritizes conceptual depth tuned to your Level ${currentScore.toFixed(1)} score in MongoDB.`
                : "Prioritizes velocity: generates concise high-yield crash summaries for quick review."}
            </p>
          </div>
        </div>

        {/* Source Tabs */}
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab("url");
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "url"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🔗</span>
            <span>Website / Article URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("document");
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "document"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📁</span>
            <span>Upload Document (PDF / PPT / MD)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("notes");
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "notes"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>✍️</span>
            <span>Raw Notes or Topic</span>
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSynthesize} className="space-y-5">
          {/* TAB 1: Website URL */}
          {activeTab === "url" && (
            <div className="space-y-3">
              <label htmlFor="url-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Documentation or Tutorial URL
              </label>
              <input
                id="url-input"
                type="url"
                placeholder="https://www.w3schools.com/js/ or https://geeksforgeeks.org/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono"
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>Try examples:</span>
                <button
                  type="button"
                  onClick={() => setUrlInput("https://www.w3schools.com/js/js_intro.asp")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono"
                >
                  W3Schools JS
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUrlInput("https://www.geeksforgeeks.org/css/introduction-to-tailwind-css/")
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono"
                >
                  GfG Tailwind CSS
                </button>
                <button
                  type="button"
                  onClick={() => setUrlInput("https://www.w3schools.com/react/default.asp")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono"
                >
                  W3Schools React
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Document File Upload */}
          {activeTab === "document" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Upload File (PDF, PPT / PPTX, Markdown, Text)
              </label>
              <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition bg-slate-950/60">
                <input
                  type="file"
                  accept=".pdf,.pptx,.ppt,.md,.markdown,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2 pointer-events-none">
                  <span className="text-3xl">📄</span>
                  <p className="text-sm font-semibold text-slate-200">
                    {selectedFile
                      ? selectedFile.name
                      : "Drag & drop your PDF or presentation slides here"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                      : "Filters out title covers, author info, and acknowledgments automatically."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Raw Notes or Topic */}
          {activeTab === "notes" && (
            <div className="space-y-3">
              <label htmlFor="notes-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Paste Class Notes, Lecture Transcripts or Concept Prompts
              </label>
              <textarea
                id="notes-input"
                rows={5}
                placeholder="Paste raw notes, slide content, or write a topic prompt (e.g. Explain Kafka Architecture, event streaming, partitions and broker failover)..."
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono resize-none"
              />
            </div>
          )}

          {/* Course Title (Optional) */}
          <div>
            <label htmlFor="custom-title-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Course Title (Optional — AI auto-generates if blank)
            </label>
            <input
              id="custom-title-input"
              type="text"
              placeholder="e.g. Modern Web Architecture & Microservices"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Action Button & Loading Status */}
          <div className="space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Synthesizing Adaptive Course with AI...</span>
                </>
              ) : (
                <span>Synthesize Adaptive Course with AI →</span>
              )}
            </button>

            {isLoading && loadingStep && (
              <p className="text-center font-mono text-xs text-indigo-400 animate-pulse">
                {loadingStep}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* 3. Instant Ingestion Starters (Quick-populate real documentation links) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>⚡ Quick-Start Starters</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono">
                1-Click Ingest
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Click any starter to auto-fill verified documentation and synthesize with Gemini.
            </p>
          </div>
          <button
            onClick={onOpenArena}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition"
          >
            Proof-of-Work Arena →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("url");
              setUrlInput("https://www.geeksforgeeks.org/css/introduction-to-tailwind-css/");
              setCustomTitle("Tailwind CSS Architecture & Utility Classes");
            }}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-left space-y-1.5 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                GeeksforGeeks
              </span>
              <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                Load Link →
              </span>
            </div>
            <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
              Tailwind CSS Masterclass
            </h5>
            <p className="text-[11px] text-slate-400 truncate">
              https://www.geeksforgeeks.org/css/introduction-to-tailwind-css/
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("url");
              setUrlInput("https://www.w3schools.com/js/");
              setCustomTitle("JavaScript Core Engine & Modern ES6+");
            }}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-left space-y-1.5 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                W3Schools
              </span>
              <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                Load Link →
              </span>
            </div>
            <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
              JavaScript Complete Guide
            </h5>
            <p className="text-[11px] text-slate-400 truncate">
              https://www.w3schools.com/js/
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("url");
              setUrlInput("https://www.w3schools.com/react/default.asp");
              setCustomTitle("React 19 Hooks & State Architecture");
            }}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 text-left space-y-1.5 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold">
                W3Schools
              </span>
              <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                Load Link →
              </span>
            </div>
            <h5 className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
              React Hooks & Components
            </h5>
            <p className="text-[11px] text-slate-400 truncate">
              https://www.w3schools.com/react/default.asp
            </p>
          </button>
        </div>
      </div>

      {/* 4. Active Ingested Courses History */}
      {savedCourses.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-900">
          <h3 className="text-base font-bold text-white tracking-tight">
            Your Ingested Courses
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedCourses.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <h5 className="text-sm font-semibold text-white truncate">{c.title}</h5>
                  <p className="text-xs text-slate-400 truncate">{c.description}</p>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {c.totalTopics} Topics Generated
                  </span>
                </div>
                <button
                  onClick={() => onSelectTopic(c.topic, c.title)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 cursor-pointer transition"
                >
                  Resume →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

