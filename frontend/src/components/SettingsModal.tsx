"use client";

import React, { useState } from "react";
import { AblationStudio } from "./AblationStudio";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SettingsModal Component
 * Houses advanced developer & educator configurations, including the Ablation Studio,
 * telemetry sampling controls, and offline fallback toggles.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"general" | "ablation">("general");

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 sm:p-6"
    >
      <div className="relative max-w-4xl w-full h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 id="settings-modal-title" className="text-lg font-bold text-white tracking-tight">
                Platform Settings & Diagnostics
              </h2>
              <p className="text-xs text-slate-400">
                Educator benchmarks, ablation testing, and developer telemetry modes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800/80 flex gap-2">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "general"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            General & Telemetry
          </button>
          <button
            onClick={() => setActiveTab("ablation")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === "ablation"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Educator Ablation Studio
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "general" ? (
            <div className="max-w-xl space-y-6 text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-sm text-white">Developer X-Ray HUD</div>
                <p className="text-slate-400 leading-relaxed">
                  Toggle the real-time telemetry HUD overlay at any time during reading sessions by pressing:
                </p>
                <kbd className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-indigo-400 font-mono text-xs inline-block">
                  Ctrl + Shift + D
                </kbd>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="font-bold text-sm text-white">MongoDB Cluster Connection</div>
                <p className="text-slate-400 leading-relaxed">
                  Currently running with local fallback persistence. To sync with your cloud MongoDB cluster,
                  paste your Atlas connection string in <code className="text-emerald-400">backend/.env</code> under <code className="text-emerald-400">MONGODB_URI</code>.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <AblationStudio />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

