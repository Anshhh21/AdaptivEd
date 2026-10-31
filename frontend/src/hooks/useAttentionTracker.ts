"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WorkerFrameMessage, WorkerResultMessage } from "../workers/attention.worker";

interface UseAttentionTrackerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  attentionScore: number | null;
  faceDetected: boolean;
  isTracking: boolean;
  hasCameraPermission: boolean;
  requestCameraAccess: () => Promise<boolean>;
  stopTracking: () => void;
}

/**
 * useAttentionTracker Hook
 * Orchestrates local client-side attention estimation at 2 FPS using an offscreen canvas
 * and background Web Worker. Guarantees zero video leaves the browser.
 */
export function useAttentionTracker(enabled: boolean = false): UseAttentionTrackerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [attentionScore, setAttentionScore] = useState<number | null>(null);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);

  // Initialize Worker
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const worker = new Worker(
        new URL("../workers/attention.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent<WorkerResultMessage>) => {
        if (event.data.type === "ATTENTION_SCORE") {
          setAttentionScore(event.data.score);
          setFaceDetected(event.data.faceDetected);
        }
      };

      workerRef.current = worker;
    } catch (err) {
      console.warn("Could not instantiate attention Web Worker:", err);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const requestCameraAccess = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 5 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraPermission(true);
      setIsTracking(true);
      return true;
    } catch (err) {
      console.info("Webcam access declined or unavailable (optional feature):", err);
      setHasCameraPermission(false);
      setIsTracking(false);
      return false;
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTracking(false);
    setAttentionScore(null);
    setFaceDetected(false);
  }, []);

  // Frame Capture Sampling Loop (2 FPS / 500ms interval)
  useEffect(() => {
    if (!enabled || !isTracking) return;

    // Create offscreen canvas for frame downsampling
    if (!canvasRef.current && typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      canvasRef.current = canvas;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const worker = workerRef.current;

      if (!video || !canvas || !worker || video.readyState < 2) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const message: WorkerFrameMessage = {
        type: "PROCESS_FRAME",
        width: canvas.width,
        height: canvas.height,
        pixelBuffer: frameData.data.buffer,
      };

      // Transfer pixel buffer to worker without cloning memory overhead
      worker.postMessage(message, [frameData.data.buffer]);
    }, 500); // 2 FPS

    return () => clearInterval(interval);
  }, [enabled, isTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    videoRef,
    attentionScore,
    faceDetected,
    isTracking,
    hasCameraPermission,
    requestCameraAccess,
    stopTracking,
  };
}

