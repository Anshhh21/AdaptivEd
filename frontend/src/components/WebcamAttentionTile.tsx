"use client";

import React, { useState } from "react";

interface WebcamAttentionTileProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isTracking: boolean;
  hasCameraPermission: boolean;
  attentionScore: number | null;
  faceDetected: boolean;
  outOfFrame?: boolean;
  onRequestCamera: () => Promise<boolean>;
  onStopCamera: () => void;
}

/**
 * WebcamAttentionTile Component
 * Floating Picture-in-Picture webcam viewport.
 * Provides real-time focus feedback and prominent warnings when the learner leaves the camera POV.
 */
export const WebcamAttentionTile: React.FC<WebcamAttentionTileProps> = ({
  videoRef,
  isTracking,
  hasCameraPermission,
  attentionScore,
  faceDetected,
  outOfFrame = false,
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

  const isWarning = outOfFrame;
  const isHealthy = faceDetected && !outOfFrame;

  return (
    <div
      className={`fixed bottom-6 left-6 z-30 rounded-2xl bg-slate-900/95 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden ${
        isWarning
          ? "border-2 border-rose-500/90 shadow-rose-950/50"
          : isHealthy
          ? "border border-emerald-500/50 shadow-emerald-950/20"
          : "border border-amber-500/50 shadow-amber-950/20"
      } ${isMinimized ? "w-44 h-12 p-2 flex items-center justify-between" : "w-52 p-2.5 space-y-2"}`}
    >
      {/* Header Controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          {isWarning ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-rose-400 font-semibold">⚠️ No Face in Frame</span>
            </>
          ) : isHealthy ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400 font-medium">Focus Active</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-amber-300">Calibrating Focus...</span>
            </>
          )}
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

          {/* Out of POV Overlay Alert */}
          {isWarning && (
            <div className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center pointer-events-none z-10 animate-fadeIn">
              <span className="text-xs font-bold text-rose-200">Face Not Detected</span>
              <span className="text-[10px] text-rose-300/90 leading-tight mt-0.5">
                Look at the screen to resume focus tracking
              </span>
            </div>
          )}

          {/* Attention Health Indicator */}
          <div
            className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded backdrop-blur text-[9px] font-mono z-20 ${
              isWarning
                ? "bg-rose-950/90 text-rose-300 border border-rose-500/50"
                : isHealthy
                ? "bg-black/75 text-emerald-300 border border-emerald-500/30"
                : "bg-black/75 text-amber-300 border border-amber-500/30"
            }`}
          >
            {isWarning
              ? "0% Focus • Out of POV"
              : attentionScore !== null
              ? `${Math.round(attentionScore * 100)}% Focus`
              : "Calibrating"}
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
