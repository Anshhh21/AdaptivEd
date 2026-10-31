"use client";

import React, { useState } from "react";
import { FRONTEND_CURRICULUM, TechnologyTrack, TopicModule } from "../data/curriculum";

interface DomainHubProps {
  onSelectTopic: (topic: TopicModule, techName: string) => void;
  onOpenArena: () => void;
  onOpenBYOC?: () => void;
}

export type DomainType = "web" | "app" | "dsa" | "aiml";
export type WebSubCategory = "frontend" | "backend" | "databases" | "production";

export const DomainHub: React.FC<DomainHubProps> = ({ onSelectTopic, onOpenArena, onOpenBYOC }) => {
  const [selectedDomain, setSelectedDomain] = useState<DomainType | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<WebSubCategory>("frontend");
  const [selectedTech, setSelectedTech] = useState<TechnologyTrack | null>(null);

  // Level 1: Domain Selection (Web Dev, App Dev, DSA, AIML)
  if (!selectedDomain) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-14 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            Adaptive Learning Hub
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Select Your Learning Domain
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Personalized behavioral comprehension tracks. Real-time focus telemetry, dynamic visual analogies,
            and verified skill arenas.
          </p>
        </div>

        {/* 4 Main Domain Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Web Development (Active) */}
          <button
            onClick={() => setSelectedDomain("web")}
            className="group relative rounded-3xl bg-slate-900/80 border border-indigo-500/30 hover:border-indigo-500 p-6 flex flex-col justify-between text-left transition-all duration-200 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/15 cursor-pointer"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🌐
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-semibold">
                  Active Track
                </span>
                <h3 className="text-lg font-bold text-white mt-2 group-hover:text-indigo-300 transition-colors">
                  Web Development
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Frontend, Backend, Databases, and Production Engineering.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-400">
              <span>Explore Curriculum</span>
              <span>→</span>
            </div>
          </button>

          {/* 2. Mobile App Development (Coming Soon) */}
          <div className="relative rounded-3xl bg-slate-900/40 border border-slate-800/80 p-6 flex flex-col justify-between text-left opacity-75">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                📱
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-semibold">
                  Coming Soon
                </span>
                <h3 className="text-lg font-bold text-slate-300 mt-2">Mobile App Dev</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  React Native, Flutter, Swift, and Jetpack Compose.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800/60 text-xs font-mono text-slate-400">
              In Calibration
            </div>
          </div>

          {/* 3. DSA (Coming Soon) */}
          <div className="relative rounded-3xl bg-slate-900/40 border border-slate-800/80 p-6 flex flex-col justify-between text-left opacity-75">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                ⚡
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-semibold">
                  Coming Soon
                </span>
                <h3 className="text-lg font-bold text-slate-300 mt-2">DSA & Algorithms</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Trees, Graphs, Dynamic Programming, and System Optimization.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800/60 text-xs font-mono text-slate-400">
              In Calibration
            </div>
          </div>

          {/* 4. AI & Machine Learning (Coming Soon) */}
          <div className="relative rounded-3xl bg-slate-900/40 border border-slate-800/80 p-6 flex flex-col justify-between text-left opacity-75">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                🧠
              </div>
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-semibold">
                  Coming Soon
                </span>
                <h3 className="text-lg font-bold text-slate-300 mt-2">AI & Machine Learning</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  PyTorch, Transformer Architectures, Embeddings, and Agent Loops.
                </p>
              </div>
            </div>
            <div className="pt-6 mt-6 border-t border-slate-800/60 text-xs font-mono text-slate-400">
              In Calibration
            </div>
          </div>
        </div>

        {/* Bring Your Own Content (BYOC) Banner Card */}
        {onOpenBYOC && (
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 to-slate-900/60 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                📄 Dynamic Sandbox
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Have your own study notes or textbooks?
              </h3>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Bring Your Own Content (BYOC): Upload any PDF, Markdown, or raw notes. Our sliding-window semantic chunker extracts mathematical reading blocks with real-time focus tracking and dynamic analogies.
              </p>
            </div>

            <button
              onClick={onOpenBYOC}
              type="button"
              className="whitespace-nowrap px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              Upload Your Notes (BYOC) →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Level 2 & 3: Inside Web Development -> Subcategories & Topic Navigator
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <button
          onClick={() => {
            setSelectedDomain(null);
            setSelectedTech(null);
          }}
          className="hover:text-white transition cursor-pointer"
        >
          Domains
        </button>
        <span>/</span>
        <button
          onClick={() => setSelectedTech(null)}
          className={`hover:text-white transition cursor-pointer ${
            !selectedTech ? "text-indigo-400 font-bold" : ""
          }`}
        >
          Web Development
        </button>
        {selectedTech && (
          <>
            <span>/</span>
            <span className="text-indigo-400 font-bold">{selectedTech.name}</span>
          </>
        )}
      </div>

      {/* Subcategory Pills: Frontend, Backend, Databases, Production */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 w-fit text-xs font-semibold">
        <button
          onClick={() => {
            setSelectedSubCategory("frontend");
            setSelectedTech(null);
          }}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            selectedSubCategory === "frontend"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Frontend Engineering
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-xl text-slate-500 cursor-not-allowed flex items-center gap-1.5"
        >
          <span>Backend</span>
          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
            Soon
          </span>
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-xl text-slate-500 cursor-not-allowed flex items-center gap-1.5"
        >
          <span>Databases</span>
          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
            Soon
          </span>
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-xl text-slate-500 cursor-not-allowed flex items-center gap-1.5"
        >
          <span>Production</span>
          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
            Soon
          </span>
        </button>
      </div>

      {/* If No Tech Selected: Show 3 Technology Cards (CSS, JS, React) */}
      {!selectedTech ? (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Frontend Core Technologies
            </h2>
            <p className="text-xs text-slate-400">
              Select a technology to navigate its complete curriculum topic-by-topic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FRONTEND_CURRICULUM.map((tech) => (
              <div
                key={tech.id}
                className="group rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 shadow-lg"
              >
                <div className="space-y-3">
                  <div className="text-xs font-mono text-indigo-400 font-semibold uppercase tracking-wider">
                    {tech.topics.length} Targeted Topics
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {tech.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {tech.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Self-Paced
                  </span>
                  <button
                    onClick={() => setSelectedTech(tech)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    View Topics →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* If Tech Selected (e.g. CSS): Show Topic-by-Topic Syllabus */
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs font-mono text-indigo-400 font-semibold uppercase tracking-wider">
                Syllabus & Topic Navigator
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                {selectedTech.name}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Choose any topic to start studying directly. You do not have to study linearly.
              </p>
            </div>

            <button
              onClick={() => setSelectedTech(null)}
              className="text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition w-fit cursor-pointer"
            >
              ← Choose Different Tech
            </button>
          </div>

          {/* List of Topic Modules (Click directly on Tailwind, Box Model, etc.) */}
          <div className="space-y-4">
            {selectedTech.topics.map((topic, idx) => (
              <div
                key={topic.id}
                className="group rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {topic.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 pl-9">
                    {topic.shortDescription}
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:self-center pl-9 sm:pl-0">
                  <span className="text-xs font-mono text-slate-400">
                    ~{topic.estimatedMinutes} mins
                  </span>
                  <button
                    onClick={() => onSelectTopic(topic, selectedTech.name)}
                    type="button"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    Study This Topic →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Capstone Proof-of-Work Arena CTA */}
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-950/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-xs font-mono text-indigo-400 uppercase font-semibold">
                Verified Skill Capstone
              </div>
              <h4 className="text-base font-bold text-white">
                Ready to verify what you learned?
              </h4>
              <p className="text-xs text-slate-400 max-w-md">
                Build a real-world project, submit your GitHub repo, and pass the 4 Proof-of-Work Arena tactics.
              </p>
            </div>

            <button
              onClick={onOpenArena}
              type="button"
              className="whitespace-nowrap px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              Enter Proof-of-Work Arena →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

