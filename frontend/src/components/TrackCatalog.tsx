"use client";

import React from "react";

export interface EducationalTrack {
  id: string;
  slug: string;
  tier: "GOLD" | "BYOC";
  title: string;
  badgeText: string;
  description: string;
  durationMinutes: number;
  totalSections: number;
  complexityLabel: string;
  accentColor: string;
}

export const VERIFIED_TRACKS: EducationalTrack[] = [
  {
    id: "react-gold",
    slug: "react-reconciliation-fiber",
    tier: "GOLD",
    title: "React 19 Reconciliation & Fiber Engine",
    badgeText: "Verified Gold Track",
    description:
      "Deep dive into cooperative multitasking, workInProgress double-buffering, and interruptible lane priorities.",
    durationMinutes: 15,
    totalSections: 2,
    complexityLabel: "Intermediate • Calibrated",
    accentColor: "indigo",
  },
  {
    id: "nextjs-gold",
    slug: "nextjs-server-actions-lifecycle",
    tier: "GOLD",
    title: "Next.js 15 Server Actions & RSC Wire Format",
    badgeText: "Verified Gold Track",
    description:
      "Understand the HTTP POST RPC wire protocol, encrypted closures, and flight stream router revalidations.",
    durationMinutes: 20,
    totalSections: 2,
    complexityLabel: "Advanced • Calibrated",
    accentColor: "emerald",
  },
  {
    id: "mongodb-gold",
    slug: "mongodb-compound-indexing-strategy",
    tier: "GOLD",
    title: "MongoDB High-Concurrency Compound Indexing",
    badgeText: "Verified Gold Track",
    description:
      "Architect zero-COLLSCAN compound indices utilizing the strict ESR (Equality, Sort, Range) rule.",
    durationMinutes: 18,
    totalSections: 2,
    complexityLabel: "Architectural • Calibrated",
    accentColor: "amber",
  },
];

interface TrackCatalogProps {
  onSelectTrack: (track: EducationalTrack) => void;
  onOpenByocUpload: () => void;
}

export const TrackCatalog: React.FC<TrackCatalogProps> = ({
  onSelectTrack,
  onOpenByocUpload,
}) => {
  return (
    <div className="max-w-5xl w-full mx-auto px-6 py-12 space-y-10">
      {/* Catalog Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          Curriculum Catalog
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          What would you like to master today?
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Select a verified gold track calibrated with visual analogies, or upload your own custom
          notes to calibrate on the fly.
        </p>
      </div>

      {/* Grid of Tracks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {VERIFIED_TRACKS.map((track) => (
          <div
            key={track.id}
            className="group relative rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  {track.badgeText}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ~{track.durationMinutes} mins
                </span>
              </div>

              <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                {track.title}
              </h2>

              <p className="text-slate-400 text-xs leading-relaxed">
                {track.description}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {track.complexityLabel}
              </span>
              <button
                onClick={() => onSelectTrack(track)}
                type="button"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                Start Study Session →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* BYOC Upload Card */}
      <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/30 p-8 flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-indigo-500/40 transition">
        <div className="space-y-2 text-center sm:text-left">
          <div className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
            <span>Bring Your Own Content (BYOC Sandbox)</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Dynamic Chunker
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Have custom PDF slides, college lecture notes, or technical documentation? Upload them to
            dynamically split and calibrate them with our 3-sentence sliding window chunker.
          </p>
        </div>

        <button
          onClick={onOpenByocUpload}
          type="button"
          className="whitespace-nowrap px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white text-xs font-semibold transition cursor-pointer"
        >
          Upload Custom Notes (.md / .pdf)
        </button>
      </div>
    </div>
  );
};

