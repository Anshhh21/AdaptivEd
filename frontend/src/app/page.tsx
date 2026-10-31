"use client";

import React, { useState } from "react";
import { AblationStudio } from "../components/AblationStudio";
import { AdaptiveChunkReader, SemanticChunkData } from "../components/AdaptiveChunkReader";

// Pre-calibrated React 19 Fiber Gold Track data for immediate interactive testing
const SAMPLE_GOLD_CHUNKS: SemanticChunkData[] = [
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
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"reader" | "ablation" | "arena">("reader");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Global Navigation */}
      <nav className="border-b border-slate-900 bg-slate-950/90 backdrop-blur sticky top-0 z-30 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
        </div>

        {/* Global Module Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab("reader")}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === "reader"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Adaptive Reader
          </button>
          <button
            onClick={() => setActiveTab("ablation")}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === "ablation"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Ablation Studio
          </button>
          <button
            onClick={() => setActiveTab("arena")}
            className={`px-4 py-1.5 rounded-lg transition ${
              activeTab === "arena"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Proof-of-Work Arena
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Core Online</span>
        </div>
      </nav>

      {/* Main Tab Views */}
      <main className="flex-1">
        {activeTab === "reader" && (
          <AdaptiveChunkReader
            lessonId="lesson-react-fiber"
            lessonTitle="React 19 Reconciliation & Fiber Architecture"
            chunks={SAMPLE_GOLD_CHUNKS}
            learnerId="learner_lead_engineer"
          />
        )}

        {activeTab === "ablation" && <AblationStudio />}

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
    </div>
  );
}

