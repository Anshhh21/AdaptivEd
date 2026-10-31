"use client";

import React, { useState } from "react";

interface WebcamAttentionTileProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  hasCameraPermission: boolean;
  attentionScore: number | null;
  faceDetected: boolean;
  onRequestCamera: () => Promise<boolean>;
  onStopCamera: () => void;
}

/**
 * WebcamAttentionTile Component
 * Floating Picture-in-Picture webcam viewport rendered directly on screen when enabled.
 * Reassures the student that attention tracking is active, fully local, and privacy-preserved.
 */
export const WebcamAttentionTile: React.FC<WebcamAttentionTileProps> = ({
  videoRef,
  isTracking,
  hasCameraPermission,
  attentionScore,
  faceDetected,
  onRequestCamera,
  onStopCamera,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (!hasCameraPermission || !isTracking) {
    return (
      <button
        onClick={onRequestCamera}
        type="button"
        className="fixed bottom-6 left-6 z-30 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 hover:border-indigo-500/50 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-2 shadow-xl backdrop-blur transition cursor-pointer"
        title="Enable local webcam focus verification"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
        <span>Enable Focus Camera</span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 left-6 z-30 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden ${
        isMinimized ? "w-44 h-12 p-2 flex items-center justify-between" : "w-48 p-2.5 space-y-2"
      }`}
    >
      {/* Header Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
          <span
            className={`w-2 h-2 rounded-full ${
              faceDetected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          ></span>
          <span>{faceDetected ? "Focus Active" : "Detecting Face"}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized((prev) => !prev)}
            className="text-[10px] text-slate-400 hover:text-white px-1 rounded hover:bg-slate-800"
            title={isMinimized ? "Expand Camera" : "Minimize"}
          >
            {isMinimized ? "▢" : "–"}
          </button>
          <button
            onClick={onStopCamera}
            className="text-[10px] text-slate-400 hover:text-rose-400 px-1 rounded hover:bg-slate-800"
            title="Turn off camera"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      {!isMinimized && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-800 flex items-center justify-center">
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Attention Health Indicator */}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur text-[9px] font-mono text-emerald-300 border border-emerald-500/20">
            {attentionScore !== null ? `${Math.round(attentionScore * 100)}% Focus` : "Calibrating"}
          </div>
        </div>
      )}

      {!isMinimized && (
        <div className="text-[9px] text-slate-400 text-center font-sans tracking-tight">
          Client-only 2 FPS • Zero video stored
        </div>
      )}
    </div>
  );
};

