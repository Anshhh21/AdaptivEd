/**
 * AdaptivEd Centralized API Configuration.
 * Dynamically resolves backend base URL from NEXT_PUBLIC_API_URL or defaults to localhost.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export function getWsTelemetryUrl(learnerId: string): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const base = process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, "");
    return `${base}/api/v1/ws/telemetry/${learnerId}`;
  }

  if (typeof window !== "undefined") {
    // If NEXT_PUBLIC_API_URL is configured as https://..., use wss:// with that host
    if (process.env.NEXT_PUBLIC_API_URL) {
      try {
        const u = new URL(process.env.NEXT_PUBLIC_API_URL);
        const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
        return `${wsProto}//${u.host}/api/v1/ws/telemetry/${learnerId}`;
      } catch {
        // Fallback below
      }
    }

    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
    return `${protocol}//${host}/api/v1/ws/telemetry/${learnerId}`;
  }

  return `ws://localhost:8000/api/v1/ws/telemetry/${learnerId}`;
}
