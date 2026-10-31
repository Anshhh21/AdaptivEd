"use client";

import React, { useEffect, useState } from "react";
import { AblationStudio } from "../components/AblationStudio";
import { AdaptiveChunkReader, SemanticChunkData } from "../components/AdaptiveChunkReader";
import { AuthModal, UserSession } from "../components/AuthModal";
import { LessonCompleteModal } from "../components/LessonCompleteModal";
import { EducationalTrack, TrackCatalog, VERIFIED_TRACKS } from "../components/TrackCatalog";

// Curated Gold Track Curriculums
const TRACK_CHUNKS: Record<string, SemanticChunkData[]> = {
  "react-gold": [
    {
      id: "chunk-react-1",
      chunk_index: 0,
      title: "1. The Stack Reconciler vs Fiber Architecture",
      content:
        "In early React architectures, reconciliation was a synchronous recursive walk over the virtual DOM tree. When updating a deep component hierarchy, the main thread was completely blocked until the reconciliation traversal concluded. This stack reconciler caused noticeable frame drops and sluggish input responsiveness during rapid keystrokes or complex animations. React Fiber fundamentally re-architected this process by turning the component tree into a singly linked list of mutable work units called Fiber nodes. This architectural shift enables cooperative multitasking: React can pause ongoing reconciliation, yield control back to the browser event loop for urgent user events, and resume work seamlessly.",
      sentence_count: 5,
      word_count: 98,
      flesch_kincaid_grade: 9.4,
      target_dwell_ms: 26000,
      speed_check: {
        question: "What primary architectural flaw in the legacy Stack Reconciler necessitated React Fiber?",
        options: [
          "It lacked support for CSS-in-JS style sheet compilations.",
          "It performed synchronous recursion that monopolized the main thread, blocking urgent user input.",
          "It was unable to serialize virtual DOM trees across HTTP network boundaries.",
          "It required manual garbage collection invocations after every render pass.",
        ],
        correct_option_index: 1,
        explanation:
          "The Stack Reconciler's synchronous recursive walk blocked the main thread until completion, causing frame drops during heavy renders.",
      },
      cached_adaptations: {
        OVERLOAD_SIMPLIFIED: {
          simplified_markdown:
            "### Mental Model: The Fiber Task Scheduler\n\n- **Stack Reconciler (Old):** Like waiting for a chef to cook a 10-course banquet without pause; if a customer asks for a glass of water, they must wait until all 10 courses finish.\n- **Fiber Reconciler (Modern):** The chef preps one dish, pauses to serve water if requested, and returns to the kitchen right where they left off.\n\n> [!TIP] Fiber transforms React from an all-or-nothing recursion loop into an interruptible cooperative scheduler.",
          mermaid_diagram:
            "graph TD\n  A[User Event: Keystroke] --> B{Browser Event Loop}\n  B -->|Yield Priority| C[Urgent Input Handler]\n  B -->|Idle Period| D[Fiber Node Reconciliation]\n  D -->|Time Slice Expired| B\n  D -->|Work Finished| E[Commit Phase to Real DOM]",
          code_annotations: [
            "Fiber nodes link together using child, sibling, and return pointers.",
            "The commit phase is always synchronous to prevent visual tearing in the DOM.",
          ],
        },
      },
    },
    {
      id: "chunk-react-2",
      chunk_index: 1,
      title: "2. Double Buffering: Current vs WorkInProgress Trees",
      content:
        "To guarantee zero visual tearing during interruptible renders, React utilizes a classic computer graphics technique known as double buffering. At any given instant, React maintains two parallel trees: the 'current' tree, which mirrors what is currently rendered on screen, and the 'workInProgress' tree. All expensive diffing, hook executions, and effect allocations occur exclusively on the workInProgress tree in memory without touching real DOM nodes. Once the entire workInProgress tree has finished evaluating all priority lanes, React executes the synchronous Commit Phase. With a single pointer swap (workInProgress.alternate), the workInProgress tree instantly becomes the current tree, presenting the updated UI atomically to the user.",
      sentence_count: 5,
      word_count: 104,
      flesch_kincaid_grade: 10.2,
      target_dwell_ms: 28000,
      speed_check: {
        question: "How does React's double-buffering architecture prevent visual tearing during long render passes?",
        options: [
          "By writing render diffs directly to the GPU video buffer via WebGL.",
          "By performing all render calculations on an in-memory workInProgress tree and swapping pointers only upon completion.",
          "By locking the browser screen with a CSS backdrop filter until rendering finishes.",
          "By running React components inside a secondary Service Worker thread.",
        ],
        correct_option_index: 1,
        explanation:
          "Double buffering ensures modifications remain offscreen in the workInProgress tree until the entire frame is ready to commit atomically.",
      },
      cached_adaptations: {
        OVERLOAD_SIMPLIFIED: {
          simplified_markdown:
            "### Mental Model: Dual Canvas Painting\n\n- **Current Tree:** The framed painting hanging on the museum wall that visitors are admiring right now.\n- **WorkInProgress Tree:** The artist's easel behind the curtain where corrections and paint strokes are applied in private.\n- **The Pointer Swap:** Once the painting is finished, the curtain is pulled back instantly replacing the old painting in one atomic motion.",
          mermaid_diagram:
            "graph LR\n  Current[Current Fiber Tree] -.->|Mirrors Real DOM| Screen[Screen Display]\n  WIP[WorkInProgress Tree] -->|Offscreen Processing| Prep[Memory Allocations]\n  Prep -->|Commit Phase| Swap[Atomic Pointer Swap: alternate]\n  Swap --> Current",
          code_annotations: [
            "workInProgress nodes reuse existing Fiber object allocations to minimize garbage collection pauses.",
            "alternate pointers allow bidirectional traversal between both trees.",
          ],
        },
      },
    },
  ],
  "nextjs-gold": [
    {
      id: "chunk-next-1",
      chunk_index: 0,
      title: "1. Server Actions as POST RPC Endpoints",
      content:
        "While Server Actions resemble normal asynchronous JavaScript functions declared alongside your components, they compile into dedicated RPC POST endpoints. When a client component triggers a Server Action, Next.js generates an HTTP POST request carrying a cryptographic action ID header. Closed-over scope variables in the client environment are encrypted and serialized into the payload using React's flight protocol format. The server decodes the action ID, verifies the cryptographic signature to prevent arbitrary remote code execution, and executes the server function inside Node.js or edge runtimes.",
      sentence_count: 4,
      word_count: 85,
      flesch_kincaid_grade: 11.2,
      target_dwell_ms: 24000,
      speed_check: {
        question: "What wire payload does a Next.js Server Action return to the browser upon execution?",
        options: [
          "A standard HTTP 302 redirect header with an empty JSON body.",
          "A raw SQL result set stream parsed directly by the client browser.",
          "An RSC Flight stream containing both action results and revalidated component cache boundaries.",
          "A newly compiled WebAssembly binary containing the client component updates.",
        ],
        correct_option_index: 2,
        explanation:
          "Server Actions return an RSC Flight stream that seamlessly revalidates server components and mutates cache boundaries in a single network trip.",
      },
    },
    {
      id: "chunk-next-2",
      chunk_index: 1,
      title: "2. Optimistic Mutations & Router Cache Revalidation",
      content:
        "To provide instantaneous UI responsiveness before the network roundtrip completes, Next.js pairs Server Actions with the useOptimistic hook. When an action is dispatched, the client component immediately switches to its projected optimistic state. Concurrently, the flight protocol response streams back from the server, triggering revalidatePath or revalidateTag handlers that purge stale cache fragments. The client reconciles the true server response against the optimistic state, resolving pending visual states atomically.",
      sentence_count: 4,
      word_count: 78,
      flesch_kincaid_grade: 10.8,
      target_dwell_ms: 22000,
    },
  ],
  "mongodb-gold": [
    {
      id: "chunk-mongo-1",
      chunk_index: 0,
      title: "1. The ESR (Equality, Sort, Range) Principle",
      content:
        "When designing compound indices in MongoDB, field ordering dictates whether the query engine executes an optimal index scan (IXSCAN) or degrades into an in-memory sort. The ESR guideline mandates that index fields must follow a strict three-tier sequence: Equality fields first, followed by Sort fields, followed by Range filter fields. Equality fields narrow down the index tree traversal to an exact B-tree node branch with maximum selectivity.",
      sentence_count: 4,
      word_count: 68,
      flesch_kincaid_grade: 10.5,
      target_dwell_ms: 20000,
      speed_check: {
        question: "According to the ESR rule, why must Sort fields precede Range fields in a compound index?",
        options: [
          "Because MongoDB drivers automatically reverse index keys containing range constraints.",
          "Because range filters traverse multiple B-tree leaf nodes, destroying the physical ordering required for index-backed sorting.",
          "Because Range queries require BSON document decryption while Sort queries do not.",
          "Because MongoDB compound indices are limited to a maximum depth of two fields.",
        ],
        correct_option_index: 1,
        explanation:
          "A range filter splits traversals across disparate index leaves; any sort fields placed after a range require an expensive in-memory sort pass.",
      },
    },
    {
      id: "chunk-mongo-2",
      chunk_index: 1,
      title: "2. Preventing the 32MB In-Memory Sort Exception",
      content:
        "If a MongoDB query requires sorting on a field that is not backed by an index prefix, MongoDB attempts to load all candidate documents into an in-memory sort buffer. If this working set exceeds 32 megabytes, the query engine aborts with an operation failure. Adhering to the ESR rule ensures that the index itself provides the exact required sorting order, allowing documents to stream directly from disk leaf nodes without memory buffering.",
      sentence_count: 4,
      word_count: 74,
      flesch_kincaid_grade: 9.8,
      target_dwell_ms: 21000,
    },
  ],
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<"catalog" | "reader" | "ablation" | "arena">("catalog");
  const [selectedTrack, setSelectedTrack] = useState<EducationalTrack>(VERIFIED_TRACKS[0]);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState<boolean>(false);

  // Load user session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("adaptived_user");
      if (stored) {
        setUserSession(JSON.parse(stored));
      }
    } catch {
      // Fallback
    }
  }, []);

  const handleSelectTrack = (track: EducationalTrack) => {
    setSelectedTrack(track);
    setActiveTab("reader");
  };

  const handleLessonComplete = () => {
    // 1. Award XP to user session
    if (userSession) {
      const updated: UserSession = {
        ...userSession,
        total_xp: userSession.total_xp + 150,
        current_streak_days: Math.max(1, userSession.current_streak_days),
      };
      setUserSession(updated);
      localStorage.setItem("adaptived_user", JSON.stringify(updated));
    }
    // 2. Open celebration modal
    setIsCompleteOpen(true);
  };

  const activeChunks = TRACK_CHUNKS[selectedTrack.id] || TRACK_CHUNKS["react-gold"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Global Navigation Bar */}
      <nav className="border-b border-slate-900 bg-slate-950/90 backdrop-blur sticky top-0 z-30 px-6 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("catalog")}
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
        </div>

        {/* Global Module Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === "catalog"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Courses
          </button>
          <button
            onClick={() => setActiveTab("reader")}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === "reader"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Study Reader
          </button>
          <button
            onClick={() => setActiveTab("ablation")}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === "ablation"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Ablation Studio
          </button>
          <button
            onClick={() => setActiveTab("arena")}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === "arena"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Arena
          </button>
        </div>

        {/* User Profile / Sign In Section */}
        <div className="flex items-center gap-3">
          {userSession ? (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs hover:border-slate-700 transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-white">{userSession.display_name}</span>
              <span className="text-amber-400 font-mono text-[11px]">🔥 {userSession.current_streak_days}d</span>
              <span className="text-indigo-400 font-mono text-[11px]">+{userSession.total_xp} XP</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-semibold text-white transition cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Main Views */}
      <main className="flex-1">
        {/* 1. Track Picker / Course Catalog */}
        {activeTab === "catalog" && (
          <TrackCatalog
            onSelectTrack={handleSelectTrack}
            onOpenByocUpload={() => setActiveTab("ablation")}
          />
        )}

        {/* 2. Minimalist Study Reader */}
        {activeTab === "reader" && (
          <AdaptiveChunkReader
            lessonId={selectedTrack.slug}
            lessonTitle={selectedTrack.title}
            chunks={activeChunks}
            learnerId={userSession?.user_id || "learner_anonymous"}
            onLessonComplete={handleLessonComplete}
          />
        )}

        {/* 3. Educator Ablation Studio */}
        {activeTab === "ablation" && <AblationStudio />}

        {/* 4. Proof-of-Work Arena */}
        {activeTab === "arena" && (
          <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-indigo-400 mb-1">
                Phase 6 Verified Skill Arena
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Proof-of-Work Verification Arena
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Using AI is allowed, but blind vibe-coding is caught. Submit your production repository
                to run through all 4 verification tactics.
              </p>
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

      {/* Auth / Account Profile Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(session) => setUserSession(session)}
      />

      {/* Lesson Complete Celebration Modal */}
      <LessonCompleteModal
        isOpen={isCompleteOpen}
        lessonTitle={selectedTrack.title}
        streakDays={userSession?.current_streak_days || 1}
        onReturnToCatalog={() => {
          setIsCompleteOpen(false);
          setActiveTab("catalog");
        }}
        onGoToArena={() => {
          setIsCompleteOpen(false);
          setActiveTab("arena");
        }}
      />
    </div>
  );
}
