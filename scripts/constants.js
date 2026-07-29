export const SYSTEM_ID = "tencandles-ga";

export const TOTAL_CANDLES = 10;

export const COLLECTIVE_STATE_KEY = "collectiveState";
export const COLLECTIVE_STATE_SCHEMA_VERSION = 4;

export const SOCKET_NAME = `system.${SYSTEM_ID}`;

export const GAME_STAGES = Object.freeze({
  SCENE: "scene",
  BALL_OF_TRUTHS: "ball-of-truths"
});

export const PRESENTATION_MODES = Object.freeze({
  OFFICIAL: "official",
  PERSONAL: "personal"
});

export const RESOLUTION_STATUSES = Object.freeze({
  WAITING_GM: "waiting-gm",
  PENDING_VALIDATION: "pending-validation",
  RESOLVED: "resolved",
  CANCELLED: "cancelled"
});

export const INSTANT_STATUSES = Object.freeze({
  IDLE: "idle",
  SUCCESS: "success",
  FAILURE: "failure"
});

export const INSTANT_REQUEST_STATUSES = Object.freeze({
  QUEUED: "queued",
  AWAITING: "awaiting",
  SUSPENDED: "suspended"
});

export const DEFAULT_CANVAS_TEMPLATE_ID = "official-dark";

export const COLLECTIVE_STATE_CHANGED_HOOK =
  `${SYSTEM_ID}.collectiveStateChanged`;
