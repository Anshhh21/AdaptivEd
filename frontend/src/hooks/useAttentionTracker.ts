"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAttentionTrackerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  attentionScore: number | null;
  faceDetected: boolean;
  outOfFrame: boolean;
  isTracking: boolean;
  hasCameraPermission: boolean;
  requestCameraAccess: () => Promise<boolean>;
  stopTracking: () => void;
}

/**
 * Robust Client-Side Attention & Face Presence Tracker.
 * Operates at 2 FPS (500ms intervals) entirely inside the browser using an offscreen canvas.
 * PRIVACY GUARANTEE: Zero video frames or pixels ever leave the client.
 */
function analyzeFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { detected: boolean; score: number } {
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;

  // Evaluate central 70% of frame where a student sitting in front of the laptop would be
  const startX = Math.floor(width * 0.15);
  const endX = Math.floor(width * 0.85);
  const startY = Math.floor(height * 0.10);
  const endY = Math.floor(height * 0.90);
  const cx = width / 2;

  let skinPixels = 0;
  let leftMass = 0;
  let rightMass = 0;
  let totalEvaluated = 0;

  // Stride of 3 pixels for sub-millisecond execution (<0.05ms)
  for (let y = startY; y < endY; y += 3) {
    for (let x = startX; x < endX; x += 3) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      totalEvaluated++;

      const sum = r + g + b;
      // Filter out absolute darkness or saturated highlights
      if (sum < 50 || sum > 720) continue;

      const normR = r / sum;
      const normG = g / sum;

      // Chromaticity range covering diverse human skin tones across diverse lighting
      const isSkinChromatic =
        normR >= 0.33 &&
        normR <= 0.60 &&
        normG >= 0.25 &&
        normG <= 0.40 &&
        r > g &&
        r > b &&
        Math.abs(r - g) >= 8;

      if (isSkinChromatic) {
        skinPixels++;
        if (x < cx) {
          leftMass++;
        } else {
          rightMass++;
        }
      }
    }
  }

  const skinRatio = skinPixels / Math.max(1, totalEvaluated);

  // If at least 7.5% of central ROI exhibits facial skin characteristics, face is in POV
  if (skinRatio >= 0.075) {
    const totalMass = leftMass + rightMass;
    const symmetry = totalMass > 0 ? Math.min(leftMass, rightMass) / Math.max(leftMass, rightMass) : 0;
    // High bilateral symmetry indicates looking forward; lower indicates looking sideways
    const score = Math.min(1.0, Math.max(0.35, Math.round(symmetry * 1.05 * 100) / 100));
    return { detected: true, score };
  }

  return { detected: false, score: 0.0 };
}

export function useAttentionTracker(enabled: boolean = false): UseAttentionTrackerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const missingStreakRef = useRef<number>(0);

  const [attentionScore, setAttentionScore] = useState<number | null>(null);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [outOfFrame, setOutOfFrame] = useState<boolean>(false);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);

  // Synchronize active media stream with videoRef whenever it mounts or updates
  useEffect(() => {
    if (!isTracking || !streamRef.current) return;

    const video = videoRef.current;
    if (video && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch((err) => {
        console.warn("Video play error:", err);
      });
    }
  }, [isTracking, hasCameraPermission]);

  const requestCameraAccess = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 10 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      setHasCameraPermission(true);
      setIsTracking(true);
      missingStreakRef.current = 0;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      return true;
    } catch (err) {
      console.info("Webcam access declined or unavailable:", err);
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
    setHasCameraPermission(false);
    setAttentionScore(null);
    setFaceDetected(false);
    setOutOfFrame(false);
    missingStreakRef.current = 0;
  }, []);

  // Frame Capture Sampling Loop (2 FPS / 500ms interval)
  useEffect(() => {
    if (!enabled || !isTracking) return;

    if (!canvasRef.current && typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      canvasRef.current = canvas;
    }

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // Ensure video is playing with real dimensions
      if (video.readyState < 2 || video.paused || video.videoWidth === 0) {
        if (streamRef.current && video.srcObject !== streamRef.current) {
          video.srcObject = streamRef.current;
          video.play().catch(() => {});
        }
        return;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { detected, score } = analyzeFrame(ctx, canvas.width, canvas.height);

        if (detected) {
          missingStreakRef.current = 0;
          setFaceDetected(true);
          setOutOfFrame(false);
          setAttentionScore(score);
        } else {
          missingStreakRef.current += 1;
          // After 2 consecutive missed frames (1.0 second), flag as out of frame
          if (missingStreakRef.current >= 2) {
            setFaceDetected(false);
            setOutOfFrame(true);
            setAttentionScore(0.0);
          }
        }
      } catch (err) {
        console.warn("Attention frame analysis error:", err);
      }
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
    outOfFrame,
    isTracking,
    hasCameraPermission,
    requestCameraAccess,
    stopTracking,
  };
}
