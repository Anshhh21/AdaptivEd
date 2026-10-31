"use client";

import React, { useEffect, useState } from "react";
import { BCSEvaluationResponse, ChunkTelemetryPayload } from "../types/telemetry";

interface DeveloperXRayDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  telemetryPayload: ChunkTelemetryPayload;
  evaluation: BCSEvaluationResponse | null;
  targetDwellMs: number;
  fleschKincaidGrade: number;
  learnerWpm?: number;
  elvMultiplier?: number;
  percentileRank?: number;
  nodeTrace?: string[];
}

/**
 * Developer "X-Ray Mode" HUD Drawer (Ctrl+Shift+D)
 * Real-time diagnostic panel designed for live evaluator demonstrations.
 * Visualizes:
 * 1. Live DOM telemetry tick buffers.
 * 2. Mathematical BCS calculus breakdown.
 * 3. Stateful LangGraph multi-agent execution traces.
 * 4. Longitudinal profile calibrations and ELV multipliers.
 */
export const DeveloperXRayDrawer: React.FC<DeveloperXRayDrawerProps> = ({
  isOpen,
  onToggle,
  telemetryPayload,
  evaluation,
  targetDwellMs,
  fleschKincaidGrade,
  learnerWpm = 220,
  elvMultiplier = 1.0,
  percentileRank = 94.0,
  nodeTrace = [
    "TelemetryEvaluatorNode",
    "ProfileUpdaterNode",
    "PedagogicalRouterNode",
    "ContentAdapterNode:CacheHit",
  ],
}) => {
  // Listen for Ctrl+Shift+D / Cmd+Shift+D keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        onToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        type="button"
        className="fixed bottom-6 right-6 z-30 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-indigo-500/30 text-indigo-400 font-mono text-xs shadow-2xl backdrop-blur flex items-center gap-2 transition cursor-pointer"
        title="Toggle Developer X-Ray Drawer (Ctrl+Shift+D)"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
        <span>X-Ray HUD</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">
          Ctrl+Shift+D
        </kbd>
      </button>
    );
  }

  const dwellRatio =
    targetDwellMs > 0 ? telemetryPayload.active_dwell_time_ms / targetDwellMs : 0;

  return (
    <aside
      aria-label="Developer X-Ray Diagnostic Panel"
      className="fixed top-0 right-0 z-40 h-full w-96 max-w-[90vw] bg-slate-950/95 border-l border-slate-800 backdrop-blur-2xl shadow-2xl flex flex-col font-mono text-xs text-slate-300 transition-all duration-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-bold text-white tracking-wider uppercase">Developer X-Ray HUD</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Close drawer"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Live DOM Telemetry Buffer */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            1. DOM Sensor Buffers (10 Hz)
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Active Focus Dwell:</span>
              <span className="text-white font-semibold">
                {(telemetryPayload.active_dwell_time_ms / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Read Baseline:</span>
              <span className="text-slate-300">{(targetDwellMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Scroll Up Regressions:</span>
              <span
                className={`font-semibold ${
                  telemetryPayload.scroll_up_regressions > 2 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {telemetryPayload.scroll_up_regressions} events
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Highlights / Code Copies:</span>
              <span className="text-slate-300">
                {telemetryPayload.text_highlights_count} / {telemetryPayload.code_copies_count}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MediaPipe Vision Gaze:</span>
              <span className="text-indigo-400 font-semibold">
                {telemetryPayload.attention_score !== null
                  ? `${Math.round(telemetryPayload.attention_score * 100)}% (2 FPS)`
                  : "Sensor Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Mathematical BCS Calculus */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            2. Mathematical BCS Calculus
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
            <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span className="text-slate-400">Dwell Ratio (R):</span>
              <span className="font-semibold text-white">{dwellRatio.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Raw Comprehension:</span>
              <span className="text-slate-300">
                {evaluation ? (evaluation.raw_comprehension * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Regression Penalty:</span>
              <span className="text-rose-400">
                -{evaluation ? (evaluation.regression_penalty * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vision Modifier:</span>
              <span className="text-indigo-300">
                ×{evaluation ? evaluation.attention_modifier.toFixed(2) : "1.00"}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800/60 pt-1.5 font-bold">
              <span className="text-emerald-400">Composite BCS:</span>
              <span className="text-emerald-400 text-sm">
                {evaluation ? (evaluation.score * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Stateful LangGraph Transition Trace */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            3. LangGraph Agent Transition Trace
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
            {nodeTrace.map((node, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-slate-400 text-[10px]">{idx + 1}.</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    node.includes("CacheHit")
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : node.includes("Groq")
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {node}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Learner Profile & Gamification Live Diffs */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            4. Learner Profile Invariants
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Calibrated WPM Baseline:</span>
              <span className="text-white">{learnerWpm} WPM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Flesch-Kincaid Grade:</span>
              <span className="text-slate-300">Grade {fleschKincaidGrade.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Effective Velocity (ELV):</span>
              <span className="text-cyan-400 font-semibold">{elvMultiplier}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cohort Percentile Rank:</span>
              <span className="text-emerald-400 font-semibold">Top {100 - Math.round(percentileRank)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[10px] text-slate-400 flex items-center justify-between">
        <span>AdaptivEd Live Inspector</span>
        <span className="text-emerald-400">Status: Active Stream (1 Hz)</span>
      </div>
    </aside>
  );
};

