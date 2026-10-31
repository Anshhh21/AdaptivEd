/**
 * AdaptivEd Client Telemetry and Cognitive State Contracts.
 * Strict type parity with backend app.ml.scoring schemas.
 */

export type CognitiveState = "OPTIMAL" | "SKIMMING" | "OVERLOADED" | "NEUTRAL";

export type FocusBlockReason =
  | "NOT_FULLSCREEN"
  | "TAB_HIDDEN"
  | "WINDOW_BLURRED"
  | null;

export interface ChunkTelemetryPayload {
  chunk_id: string;
  lesson_id: string;
  dwell_time_ms: number;
  active_dwell_time_ms: number;
  scroll_up_regressions: number;
  text_highlights_count: number;
  code_copies_count: number;
  attention_score: number | null;
}

export interface BCSEvaluationResponse {
  score: number;
  dwell_ratio: number;
  raw_comprehension: number;
  regression_penalty: number;
  attention_modifier: number;
  cognitive_state: CognitiveState;
  requires_speed_check: boolean;
  requires_adaptation: boolean;
}

export interface FullscreenLockState {
  isFullscreen: boolean;
  isTabVisible: boolean;
  isWindowFocused: boolean;
  isLockedInFocus: boolean;
  blockReason: FocusBlockReason;
}

