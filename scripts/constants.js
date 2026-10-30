export const SYSTEM_ID = "tencandles-ga";

export const TOTAL_CANDLES = 10;

export const COLLECTIVE_STATE_KEY = "collectiveState";
export const COLLECTIVE_STATE_SCHEMA_VERSION = 4;

export const SOCKET_NAME = `system.${SYSTEM_ID}`;

export const GAME_STAGES = Object.freeze({
  SCENE: "scene",
  BALL_OF_TRUTHS: "ball-of-truths"
});

export const GAMEPLAY_MODES = Object.freeze({
  CLASSIC: "classic",
  SPEED: "speed"
});

export const DEFAULT_SPEED_LAST_CANDLE = 6;

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
export const CANVAS_THEMES = Object.freeze({ CLASSIC: "classic", POST_APO: "post-apo", FUTUR: "futur", FORET_ENFANT: "foret-enfant", MEDIEVAL: "medieval", MAGIE: "magie", LOVECRAFT: "lovecraft", WESTERN: "western", HALLOWEEN: "halloween" });

export const COLLECTIVE_STATE_CHANGED_HOOK =
  `${SYSTEM_ID}.collectiveStateChanged`;
