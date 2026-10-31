"use client";

import React, { useState } from "react";
import { SemanticChunkData } from "./AdaptiveChunkReader";
import { TopicModule } from "../data/curriculum";

interface BYOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchStudy: (topic: TopicModule, trackName: string) => void;
}

export const BYOCModal: React.FC<BYOCModalProps> = ({ isOpen, onClose, onLaunchStudy }) => {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chunkerStrategy, setChunkerStrategy] = useState<"semantic_neural" | "tfidf_lsa">("tfidf_lsa");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
      }
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Please enter a title for this study module.");
      return;
    }

    if (!selectedFile && (!rawText || rawText.trim().length < 50)) {
      setErrorMsg("Please upload a file (.pdf, .md, .txt) or paste at least 50 characters of notes.");
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim() || "BYOC Custom Study Material");
      formData.append("chunker_strategy", chunkerStrategy);
      formData.append("alpha", "0.80");
      formData.append("wpm_baseline", "220");

      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      if (rawText.trim()) {
        formData.append("raw_text_input", rawText.trim());
      }

      const res = await fetch("http://127.0.0.1:8000/api/v1/byoc/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.detail || "Failed to process BYOC material.");
      }

      const result = json.data;
      const chunks: SemanticChunkData[] = (result.chunks || []).map((c: any) => ({
        id: c.id,
        chunk_index: c.chunk_index,
        title: c.title || `Section ${c.chunk_index + 1}`,
        content: c.content,
        sentence_count: c.sentence_count,
        word_count: c.word_count,
        flesch_kincaid_grade: c.flesch_kincaid_grade,
        target_dwell_ms: c.target_dwell_ms,
      }));

      const byocTopic: TopicModule = {
        id: result.lesson_id,
        slug: result.slug,
        title: result.title,
        shortDescription: `Custom Upload (${result.total_chunks} chunks, ~${result.total_words} words)`,
        estimatedMinutes: Math.max(2, Math.round(result.total_words / 220)),
        chunks: chunks,
      };

      onLaunchStudy(byocTopic, "Bring Your Own Content (BYOC)");
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error processing BYOC content.";
      setErrorMsg(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="byoc-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 overflow-y-auto"
    >
      <div className="relative max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 my-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h2 id="byoc-modal-title" className="text-xl font-bold text-white tracking-tight">
              Bring Your Own Content (BYOC)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Upload your textbook chapters, research papers, course slides, or raw markdown notes. Our mathematical
          semantic chunker will segment the material into calibrated reading units with real-time focus tracking.
        </p>

        <form onSubmit={handleIngest} className="space-y-4">
          <div>
            <label htmlFor="byoc-title-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Module Title *
            </label>
            <input
              id="byoc-title-input"
              type="text"
              required
              placeholder="e.g. Operating Systems: Virtual Memory & Page Tables"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* File Upload Zone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Upload Document (PDF, Markdown, or TXT)
            </label>
            <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center transition bg-slate-950/50">
              <input
                type="file"
                accept=".pdf,.md,.markdown,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-1 pointer-events-none">
                <span className="text-2xl">📄</span>
                <p className="text-xs font-semibold text-slate-300">
                  {selectedFile ? selectedFile.name : "Drag & drop your file here, or click to browse"}
                </p>
                <p className="text-[10px] text-slate-500">
                  {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Supports PDF, Markdown (.md), and Plain Text (.txt)"}
                </p>
              </div>
            </div>
          </div>

          {/* Direct Text Paste Option */}
          <div>
            <label htmlFor="byoc-text-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Or Paste Custom Text Directly
            </label>
            <textarea
              id="byoc-text-input"
              rows={4}
              placeholder="Paste article, notes, or textbook excerpt here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition font-mono resize-none"
            />
          </div>

          {/* Chunker Algorithm Selection */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setChunkerStrategy("tfidf_lsa")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                chunkerStrategy === "tfidf_lsa"
                  ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold">TF-IDF + LSA Chunker</div>
              <div className="text-[10px] opacity-75 mt-0.5">Ultra-fast sub-second lexical boundary parsing.</div>
            </button>

            <button
              type="button"
              onClick={() => setChunkerStrategy("semantic_neural")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                chunkerStrategy === "semantic_neural"
                  ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold">Neural Chunker (all-MiniLM)</div>
              <div className="text-[10px] opacity-75 mt-0.5">Deep transformer cosine valley detection.</div>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Calibrating Semantic Chunks...</span>
              </>
            ) : (
              <span>Chunk & Launch Adaptive Reader →</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

