"use client";

import React, { useState, useEffect } from "react";
import AnimatedContent from "./AnimatedContent";
import MagicBento from "./MagicBento";
import RubberSegment from "./RubberSegment";
import SpecularButton from "./SpecularButton";
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

  // Saved Courses History
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

  const handleSynthesize = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (activeTab === "url" && !urlInput.trim().startsWith("http")) {
      setErrorMsg("Please enter a valid website link (e.g. https://www.w3schools.com/js/).");
      return;
    }

    if (activeTab === "document" && !selectedFile) {
      setErrorMsg("Please upload a PDF, presentation, or markdown file.");
      return;
    }

    if (activeTab === "notes" && !notesInput.trim()) {
      setErrorMsg("Please paste some notes or specify a topic to learn.");
      return;
    }

    setIsLoading(true);
    setLoadingStep("Reading and extracting relevant topics...");

    try {
      let response: Response;

      if (activeTab === "url") {
        setLoadingStep("Accessing page content and discarding fluff...");
        response = await fetch("http://127.0.0.1:8000/api/v1/byoc/ingest-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: urlInput.trim(),
            title: customTitle.trim() || undefined,
            user_level: currentScore,
            learning_strategy: strategy,
          }),
        });
      } else if (activeTab === "document") {
        setLoadingStep("Parsing document and stripping cover pages...");
        const formData = new FormData();
        formData.append("file", selectedFile!);
        if (customTitle.trim()) formData.append("title", customTitle.trim());
        formData.append("user_level", currentScore.toString());
        formData.append("learning_strategy", strategy);

        response = await fetch("http://127.0.0.1:8000/api/v1/byoc/ingest-document", {
          method: "POST",
          body: formData,
        });
      } else {
        setLoadingStep("Structuring notes into step-by-step explanations...");
        response = await fetch("http://127.0.0.1:8000/api/v1/byoc/ingest-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_text: notesInput.trim(),
            title: customTitle.trim() || undefined,
            user_level: currentScore,
            learning_strategy: strategy,
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate course from input.");
      }

      setLoadingStep("Formatting topic breakdown and interactive quizzes...");
      const result = await response.json();

      const newTopic: TopicModule = {
        id: result.module_id || `byoc_${Date.now()}`,
        slug: result.slug || `topic_${Date.now()}`,
        title: result.title || customTitle || "Personal Course",
        shortDescription: result.description || "Synthesized adaptive material.",
        estimatedMinutes: result.estimated_minutes || 45,
        chunks: result.chunks.map((c: any, index: number): SemanticChunkData => {
          const checkpoint = (c.interactive_checkpoints || [])[0] || null;
          return {
            id: c.chunk_id || `chunk_${index}`,
            chunk_index: index,
            title: c.title || `Part ${index + 1}`,
            content: c.content || "",
            sentence_count: (c.content || "").split(/[.?!]/).filter(Boolean).length || 5,
            word_count: (c.content || "").split(/\s+/).filter(Boolean).length || 150,
            flesch_kincaid_grade: 8.5,
            target_dwell_ms: (c.read_time_seconds || 180) * 1000,
            speed_check: checkpoint
              ? {
                  question: checkpoint.prompt || checkpoint.question || "Quick understanding check:",
                  options: checkpoint.options || ["Yes", "No"],
                  correct_option_index: checkpoint.correct_option_index ?? 0,
                  explanation: checkpoint.explanation || "Concept verification checkpoint.",
                }
              : null,
          };
        }),
      };

      const savedEntry = {
        id: newTopic.id,
        title: newTopic.title,
        description: newTopic.shortDescription,
        totalTopics: newTopic.chunks.length,
        source: activeTab === "url" ? urlInput : activeTab === "document" ? selectedFile?.name || "file" : "notes",
        topic: newTopic,
      };

      const updatedSaved = [savedEntry, ...savedCourses.filter((c) => c.title !== newTopic.title)].slice(0, 8);
      setSavedCourses(updatedSaved);
      try {
        localStorage.setItem("adaptived_saved_courses", JSON.stringify(updatedSaved));
      } catch {
        // Ignored
      }

      onSelectTopic(newTopic, newTopic.title);
    } catch (err: any) {
      console.error("Synthesizing error:", err);
      setErrorMsg(err.message || "Something went wrong while generating the course. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* 1. Minimal Header */}
      <AnimatedContent distance={20} duration={0.6} ease="power3.out" trigger="mount">
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Learn From Any Material
          </h1>
          <p className="text-slate-400 text-sm font-light leading-relaxed max-w-xl mx-auto">
            Drop a link, document, or notes. We skip the fluff and teach you step by step.
          </p>
        </div>
      </AnimatedContent>

      {/* 2. Main Ingestion Workstation - Translucent Frosted Glass */}
      <AnimatedContent distance={30} delay={0.1} duration={0.7} ease="power3.out" trigger="mount">
        <div className="relative rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Learning Capability & Strategy Controller */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Left: Learning Capability Meter */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Your Learning Capability
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
                  {currentScore.toFixed(1)}
                  <span className="text-slate-500 text-sm font-sans font-normal"> / 10.0</span>
                </span>

                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                    currentScore < 5.0
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                      : currentScore < 7.5
                      ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {currentScore < 5.0
                    ? "Foundational • step-by-step guidance"
                    : currentScore < 7.5
                    ? "Balanced • standard concept depth"
                    : "Advanced • deep mechanics & edge cases"}
                </span>
              </div>

              <div className="w-44 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    currentScore < 5.0 ? "bg-rose-500" : currentScore < 7.5 ? "bg-purple-500" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, (currentScore / 10) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Right: Learning Strategy Slider (RubberSegment) */}
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Learning Focus
              </div>

              <RubberSegment
                items={[
                  {
                    value: "DIFFICULTY_FIRST",
                    label: "Deep Mastery",
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                    ),
                  },
                  {
                    value: "TIME_FIRST",
                    label: "Fast Pace",
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    ),
                  },
                ]}
                value={strategy}
                onChange={(val) => handleToggleStrategy(val as "DIFFICULTY_FIRST" | "TIME_FIRST")}
                trackColor="rgba(255, 255, 255, 0.05)"
                thumbColor="rgba(255, 255, 255, 0.16)"
                textColor="#94a3b8"
                activeTextColor="#ffffff"
                size="md"
                radius={12}
                inset={3}
                equalSlots
              />

              <p className="text-[11px] text-slate-400 max-w-xs">
                {strategy === "DIFFICULTY_FIRST"
                  ? `Adapts depth to your level ${currentScore.toFixed(1)} capability.`
                  : "Generates concise, high-yield takeaways for rapid review."}
              </p>
            </div>
          </div>

          {/* Source Tabs (RubberSegment) */}
          <div className="w-full flex justify-center">
            <RubberSegment
              items={[
                {
                  value: "url",
                  label: "Website Link",
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  ),
                },
                {
                  value: "document",
                  label: "Upload File",
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  ),
                },
                {
                  value: "notes",
                  label: "Raw Notes",
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  ),
                },
              ]}
              value={activeTab}
              onChange={(val) => {
                setActiveTab(val as "url" | "document" | "notes");
                setErrorMsg(null);
              }}
              trackColor="rgba(255, 255, 255, 0.05)"
              thumbColor="rgba(255, 255, 255, 0.16)"
              textColor="#94a3b8"
              activeTextColor="#ffffff"
              size="lg"
              radius={14}
              inset={3}
              equalSlots
              className="w-full"
            />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSynthesize} className="space-y-4">
            {/* TAB 1: Website URL */}
            {activeTab === "url" && (
              <div className="space-y-2.5">
                <label htmlFor="url-input" className="block text-xs font-medium text-slate-300">
                  Article or Documentation Link
                </label>
                <input
                  id="url-input"
                  type="url"
                  placeholder="https://www.w3schools.com/js/ or tutorial url..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition font-mono backdrop-blur-md"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Examples:</span>
                  <button
                    type="button"
                    onClick={() => setUrlInput("https://www.w3schools.com/js/js_intro.asp")}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-purple-300 text-[11px] transition cursor-pointer"
                  >
                    W3Schools JS
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setUrlInput("https://www.geeksforgeeks.org/css/introduction-to-tailwind-css/")
                    }
                    className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-purple-300 text-[11px] transition cursor-pointer"
                  >
                    Tailwind CSS
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrlInput("https://www.w3schools.com/react/default.asp")}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-purple-300 text-[11px] transition cursor-pointer"
                  >
                    React Hooks
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Document File Upload */}
            {activeTab === "document" && (
              <div className="space-y-2.5">
                <label className="block text-xs font-medium text-slate-300">
                  Upload PDF, Slides or Markdown
                </label>
                <div className="relative border border-dashed border-white/15 hover:border-white/30 rounded-2xl p-7 text-center transition bg-white/[0.02] backdrop-blur-md">
                  <input
                    type="file"
                    accept=".pdf,.pptx,.ppt,.md,.markdown,.txt"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2 pointer-events-none flex flex-col items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm font-medium text-slate-200">
                      {selectedFile ? selectedFile.name : "Choose a file or drag and drop here"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : "Filters cover pages and irrelevant acknowledgments automatically"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Raw Notes */}
            {activeTab === "notes" && (
              <div className="space-y-2.5">
                <label htmlFor="notes-input" className="block text-xs font-medium text-slate-300">
                  Notes or Topic Overview
                </label>
                <textarea
                  id="notes-input"
                  rows={4}
                  placeholder="Paste lecture notes or describe what you want to learn..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition font-mono resize-none backdrop-blur-md"
                />
              </div>
            )}

            {/* Course Title (Optional) */}
            <div>
              <label htmlFor="custom-title-input" className="block text-xs font-medium text-slate-400 mb-1.5">
                Course Title (Optional)
              </label>
              <input
                id="custom-title-input"
                type="text"
                placeholder="e.g. Modern Web Architecture"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/30 transition backdrop-blur-md"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* SpecularButton Action */}
            <div className="pt-2 flex flex-col items-center space-y-2">
              <SpecularButton
                type="submit"
                size="lg"
                radius={16}
                tint="#ffffff"
                tintOpacity={0.06}
                textColor="#ffffff"
                lineColor="#ffffff"
                baseColor="#666666"
                intensity={1.5}
                idleIntensity={0.5}
                thickness={1.8}
                glow={1.4}
                autoAnimate={true}
                speed={0.4}
                followMouse={true}
                disabled={isLoading}
                className="w-full justify-center text-center"
              >
                {isLoading ? (loadingStep || "Generating...") : "Create Course"}
              </SpecularButton>

              {isLoading && loadingStep && (
                <p className="font-mono text-xs text-purple-300 animate-pulse text-center">
                  {loadingStep}
                </p>
              )}
            </div>
          </form>
        </div>
      </AnimatedContent>

      {/* 3. MagicBento Interactive Grid Layout */}
      <AnimatedContent distance={30} delay={0.2} duration={0.8} ease="power3.out" trigger="mount">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Adaptive Capabilities & Instant Tracks
              </h3>
              <p className="text-xs text-slate-400 font-light">
                Hover to illuminate with cursor light. Click any track to auto-load documentation.
              </p>
            </div>
            <button
              onClick={onOpenArena}
              className="text-xs text-purple-400 hover:text-purple-300 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>Verification Arena</span>
              <span className="text-[10px]">→</span>
            </button>
          </div>

          <MagicBento
            columns={4}
            rowHeight={195}
            gap={14}
            radius={20}
            theme="dark"
            glowColor="#c084fc"
            enableBorderGlow={true}
            enableSpotlight={true}
            spotlightRadius={300}
            clickEffect={true}
            enableStars={true}
            particleCount={20}
            items={[
              {
                id: 'synthesis',
                label: 'Gemini 3.5 Pipeline',
                title: 'Tailwind CSS Architecture',
                description: 'Auto-extracts design tokens, layout utility classes, and removes fluff.',
                visual: 'automation',
                colSpan: 2,
                rowSpan: 2,
                onClick: () => {
                  setActiveTab('url');
                  setUrlInput('https://www.geeksforgeeks.org/css/introduction-to-tailwind-css/');
                  setCustomTitle('Tailwind CSS Architecture & Utility Classes');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              },
              {
                id: 'javascript',
                label: 'Core Runtime',
                title: 'JavaScript Deep Dive',
                description: 'Prototypes, execution context, event loop, and closures step-by-step.',
                visual: 'collaboration',
                colSpan: 2,
                rowSpan: 2,
                onClick: () => {
                  setActiveTab('url');
                  setUrlInput('https://www.w3schools.com/js/');
                  setCustomTitle('JavaScript Core Engine & Modern ES6+');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              },
              {
                id: 'analytics',
                label: 'Telemetry',
                title: 'Live Focus & Dwell',
                description: 'Real-time BCS attention scoring & dwell benchmarks.',
                visual: 'analytics',
                onClick: () => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              },
              {
                id: 'dashboard',
                label: 'Capability',
                title: 'Difficulty Scaling',
                description: 'Dynamic adaptation from 1.0 to 10.0 level.',
                visual: 'dashboard',
                onClick: () => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              },
              {
                id: 'integration',
                label: 'Universal Ingestion',
                title: 'React 19 Concurrency',
                description: 'Hooks, Suspense boundaries, and Server Actions.',
                visual: 'integration',
                onClick: () => {
                  setActiveTab('url');
                  setUrlInput('https://www.w3schools.com/react/default.asp');
                  setCustomTitle('React 19 Hooks & State Architecture');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              },
              {
                id: 'verification',
                label: 'Phase 6 Defense',
                title: 'Verification Arena',
                description: 'Zero-clone audit, live Vercel check, and viva code defense.',
                visual: 'security',
                onClick: onOpenArena
              }
            ]}
          />
        </div>
      </AnimatedContent>

      {/* 4. Active Ingested Courses History */}
      {savedCourses.length > 0 && (
        <AnimatedContent distance={30} delay={0.3} duration={0.7} ease="power3.out" trigger="mount">
          <div className="space-y-3 pt-4 border-t border-white/[0.08]">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Your Ingested Courses
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedCourses.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-md flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <h5 className="text-xs font-semibold text-white truncate">{c.title}</h5>
                    <p className="text-[11px] text-slate-400 truncate">{c.description}</p>
                    <span className="text-[10px] font-mono text-purple-400">
                      {c.totalTopics} Topics
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectTopic(c.topic, c.title)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-xs font-medium shrink-0 cursor-pointer transition"
                  >
                    Resume
                  </button>
                </div>
              ))}
            </div>
          </div>
        </AnimatedContent>
      )}
    </div>
  );
};
