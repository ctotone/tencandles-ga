/**
 * État collectif persistant du monde.
 *
 * Cette couche constitue l'unique source de vérité pour les bougies, les pools,
 * la phase et les résolutions. Les Actors, le chat et le canevas ne stockent
 * jamais de copie mécanique de ces valeurs.
 */

import {
  COLLECTIVE_STATE_CHANGED_HOOK,
  COLLECTIVE_STATE_KEY,
  COLLECTIVE_STATE_SCHEMA_VERSION,
  DEFAULT_CANVAS_TEMPLATE_ID,
  GAME_STAGES,
  INSTANT_REQUEST_STATUSES,
  PRESENTATION_MODES,
  RESOLUTION_STATUSES,
  SYSTEM_ID,
  TOTAL_CANDLES
} from "../constants.js";

let incoherentStageRepairPromise = null;

function clone(value) {
  return foundry.utils.deepClone(value);
}

function clampInteger(value, minimum, maximum) {
  const numericValue = Number(value);
  const integerValue = Number.isFinite(numericValue)
    ? Math.trunc(numericValue)
    : minimum;

  return Math.min(maximum, Math.max(minimum, integerValue));
}

function normalizeNullableString(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function normalizeDiceResults(value) {
  return (Array.isArray(value) ? value : [])
    .map((result) => Number(result))
    .filter(
      (result) =>
        Number.isInteger(result) &&
        result >= 1 &&
        result <= 6
    )
    .slice(0, TOTAL_CANDLES);
}


function normalizeInstantRequest(rawRequest) {
  if (!rawRequest || typeof rawRequest !== "object") {
    return null;
  }

  const request = clone(rawRequest);

  request.id = normalizeNullableString(request.id);
  if (!request.id) return null;

  request.actorId = normalizeNullableString(request.actorId);
  request.actorUuid = normalizeNullableString(request.actorUuid);
  request.actorName = normalizeNullableString(request.actorName);
  request.instantText = normalizeNullableString(request.instantText);
  request.requesterId = normalizeNullableString(request.requesterId);

  request.status = Object.values(
    INSTANT_REQUEST_STATUSES
  ).includes(request.status)
    ? request.status
    : INSTANT_REQUEST_STATUSES.QUEUED;

  request.messageIds = [
    ...new Set(
      (Array.isArray(request.messageIds)
        ? request.messageIds
        : []
      )
        .map(normalizeNullableString)
        .filter(Boolean)
    )
  ];

  request.activeMessageId = normalizeNullableString(
    request.activeMessageId
  );

  if (
    request.activeMessageId &&
    !request.messageIds.includes(request.activeMessageId)
  ) {
    request.messageIds.push(request.activeMessageId);
  }

  if (
    !request.activeMessageId &&
    request.messageIds.length > 0
  ) {
    request.activeMessageId =
      request.messageIds.at(-1) ?? null;
  }

  if (
    request.status === INSTANT_REQUEST_STATUSES.AWAITING &&
    !request.activeMessageId
  ) {
    request.status = INSTANT_REQUEST_STATUSES.QUEUED;
  }

  request.createdAt =
    normalizeTimestamp(request.createdAt) ??
    Date.now();
  request.updatedAt =
    normalizeTimestamp(request.updatedAt) ??
    request.createdAt;

  return request;
}

function normalizeResolution(rawResolution) {
  if (
    !rawResolution ||
    typeof rawResolution !== "object"
  ) {
    return null;
  }

  const resolution = foundry.utils.deepClone(
    rawResolution
  );

  resolution.id = normalizeNullableString(
    resolution.id
  );

  if (!resolution.id) return null;

  resolution.status = Object.values(
    RESOLUTION_STATUSES
  ).includes(resolution.status)
    ? resolution.status
    : RESOLUTION_STATUSES.WAITING_GM;

  resolution.chatMessageId = normalizeNullableString(
    resolution.chatMessageId
  );

  resolution.playerId = normalizeNullableString(
    resolution.playerId
  );
  resolution.playerName = normalizeNullableString(
    resolution.playerName
  );

  resolution.actorId = normalizeNullableString(
    resolution.actorId
  );
  resolution.actorUuid = normalizeNullableString(
    resolution.actorUuid
  );
  resolution.actorName = normalizeNullableString(
    resolution.actorName
  );

  resolution.litCandlesAtRoll = clampInteger(
    resolution.litCandlesAtRoll,
    0,
    TOTAL_CANDLES
  );

  resolution.bluePoolSize = clampInteger(
    resolution.bluePoolSize,
    0,
    TOTAL_CANDLES
  );
  resolution.blueResults = normalizeDiceResults(
    resolution.blueResults
  ).slice(0, resolution.bluePoolSize);

  resolution.momentUsed = Boolean(
    resolution.momentUsed
  );
  resolution.momentResult =
    resolution.momentUsed
      ? clampInteger(
          resolution.momentResult,
          1,
          6
        )
      : null;

  resolution.redPoolSize = clampInteger(
    resolution.redPoolSize,
    0,
    TOTAL_CANDLES
  );
  resolution.redResults = normalizeDiceResults(
    resolution.redResults
  ).slice(0, resolution.redPoolSize);

  resolution.gmRollCompleted = Boolean(
    resolution.gmRollCompleted
  );
  resolution.gmRollSkipped = Boolean(
    resolution.gmRollSkipped
  );

  const rerolls = {
    vice: false,
    virtue: false,
    limit: false,
    ...(resolution.rerolls ?? {})
  };

  resolution.rerolls = {
    vice: Boolean(rerolls.vice),
    virtue: Boolean(rerolls.virtue),
    limit: Boolean(rerolls.limit)
  };

  const resources = {
    canUseVice: false,
    canUseVirtue: false,
    canUseMoment: false,
    canUseLimit: false,
    ...(resolution.resources ?? {})
  };

  resolution.resources = {
    canUseVice: Boolean(resources.canUseVice),
    canUseVirtue: Boolean(resources.canUseVirtue),
    canUseMoment: Boolean(resources.canUseMoment),
    canUseLimit: Boolean(resources.canUseLimit)
  };

  resolution.limitAvailableAtStart = Boolean(
    resolution.limitAvailableAtStart
  );

  resolution.finalSuccess =
    typeof resolution.finalSuccess === "boolean"
      ? resolution.finalSuccess
      : null;

  resolution.narrator = ["player", "gm"].includes(
    resolution.narrator
  )
    ? resolution.narrator
    : null;

  resolution.blueDiceLost = clampInteger(
    resolution.blueDiceLost,
    0,
    resolution.bluePoolSize
  );

  resolution.characterDeparture = Boolean(
    resolution.characterDeparture
  );

  resolution.narrationSeized = Boolean(
    resolution.narrationSeized
  );
  resolution.narrationSeizedAt = resolution.narrationSeized
    ? normalizeTimestamp(resolution.narrationSeizedAt)
    : null;
  resolution.narrationSeizedCandles = resolution.narrationSeized
    ? clampInteger(
        resolution.narrationSeizedCandles,
        0,
        TOTAL_CANDLES
      )
    : null;

  resolution.ballInterrupted = Boolean(
    resolution.ballInterrupted
  );

  resolution.ballMessageId = normalizeNullableString(
    resolution.ballMessageId
  );

  resolution.history = Array.isArray(
    resolution.history
  )
    ? resolution.history
    : [];

  resolution.createdAt =
    normalizeTimestamp(resolution.createdAt) ??
    Date.now();

  resolution.updatedAt =
    normalizeTimestamp(resolution.updatedAt) ??
    resolution.createdAt;

  return resolution;
}

export function createDefaultCollectiveState() {
  return {
    schemaVersion: COLLECTIVE_STATE_SCHEMA_VERSION,

    // Identité de la partie actuelle dans ce monde.
    gameId: null,
    createdAt: null,
    updatedAt: null,

    // État mécanique partagé.
    stage: GAME_STAGES.SCENE,
    litCandles: TOTAL_CANDLES,
    bluePoolRemaining: TOTAL_CANDLES,

    // Une seule résolution peut être active.
    activeResolution: null,
    lastResolution: null,

    // Demandes d’Instant non encore résolues, dans leur ordre de création.
    instantRequests: [],

    // Références préparées pour les futures phases.
    activeSceneId: null,
    canvasTemplateId: DEFAULT_CANVAS_TEMPLATE_ID,
    presentationMode: PRESENTATION_MODES.OFFICIAL
  };
}

export function createInitialCollectiveState() {
  const now = Date.now();

  return {
    ...createDefaultCollectiveState(),
    gameId: foundry.utils.randomID(),
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeCollectiveState(rawState) {
  const state = foundry.utils.mergeObject(
    createDefaultCollectiveState(),
    rawState ?? {},
    {
      inplace: false,
      insertKeys: true,
      insertValues: true,
      overwrite: true
    }
  );

  state.schemaVersion = COLLECTIVE_STATE_SCHEMA_VERSION;
  state.gameId = normalizeNullableString(state.gameId);
  state.createdAt = normalizeTimestamp(state.createdAt);
  state.updatedAt = normalizeTimestamp(state.updatedAt);

  state.stage = Object.values(GAME_STAGES).includes(state.stage)
    ? state.stage
    : GAME_STAGES.SCENE;

  state.litCandles = clampInteger(
    state.litCandles,
    0,
    TOTAL_CANDLES
  );

  // Des résultats de 1 peuvent réduire temporairement le pool joueur,
  // mais celui-ci ne peut jamais dépasser le nombre de bougies allumées.
  state.bluePoolRemaining = clampInteger(
    state.bluePoolRemaining,
    0,
    state.litCandles
  );

  state.activeResolution = normalizeResolution(
    state.activeResolution
  );

  state.lastResolution = normalizeResolution(
    state.lastResolution
  );

  const seenInstantRequestIds = new Set();
  state.instantRequests = (Array.isArray(state.instantRequests)
    ? state.instantRequests
    : []
  )
    .map(normalizeInstantRequest)
    .filter((request) => {
      if (!request || seenInstantRequestIds.has(request.id)) {
        return false;
      }

      seenInstantRequestIds.add(request.id);
      return true;
    })
    .map((request) => {
      if (
        state.activeResolution &&
        request.status === INSTANT_REQUEST_STATUSES.AWAITING
      ) {
        return {
          ...request,
          status: INSTANT_REQUEST_STATUSES.SUSPENDED
        };
      }

      return request;
    })
    .sort((left, right) => left.createdAt - right.createdAt);

  state.activeSceneId = normalizeNullableString(state.activeSceneId);
  state.canvasTemplateId =
    normalizeNullableString(state.canvasTemplateId) ??
    DEFAULT_CANVAS_TEMPLATE_ID;

  state.presentationMode = Object.values(PRESENTATION_MODES).includes(
    state.presentationMode
  )
    ? state.presentationMode
    : PRESENTATION_MODES.OFFICIAL;

  return state;
}

export function registerCollectiveStateSetting() {
  game.settings.register(SYSTEM_ID, COLLECTIVE_STATE_KEY, {
    name: "ETC.Settings.CollectiveState.Name",
    hint: "ETC.Settings.CollectiveState.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: createDefaultCollectiveState(),
    onChange: (value) => {
      Hooks.callAll(
        COLLECTIVE_STATE_CHANGED_HOOK,
        normalizeCollectiveState(clone(value))
      );
    }
  });
}

export function getCollectiveState() {
  return normalizeCollectiveState(
    clone(game.settings.get(SYSTEM_ID, COLLECTIVE_STATE_KEY))
  );
}

export function isActiveGM() {
  return Boolean(
    game.user?.isGM &&
    game.users?.activeGM?.id === game.user.id
  );
}

export function isBallOfTruthsStateCoherent(state) {
  if (state?.stage !== GAME_STAGES.BALL_OF_TRUTHS) {
    return true;
  }

  const resolution = state.lastResolution;

  return Boolean(
    !state.activeResolution &&
    Number(state.litCandles) > 1 &&
    resolution &&
    resolution.status === RESOLUTION_STATUSES.RESOLVED &&
    resolution.finalSuccess === false &&
    !resolution.characterDeparture
  );
}

export async function repairIncoherentGameStage({
  state = getCollectiveState(),
  notify = true
} = {}) {
  if (!isActiveGM()) return state;

  const candidate = normalizeCollectiveState(clone(state));
  if (isBallOfTruthsStateCoherent(candidate)) {
    return candidate;
  }

  if (incoherentStageRepairPromise) {
    return incoherentStageRepairPromise;
  }

  incoherentStageRepairPromise = (async () => {
    const latest = getCollectiveState();

    if (isBallOfTruthsStateCoherent(latest)) {
      return latest;
    }

    await saveCollectiveState({
      ...latest,
      stage: GAME_STAGES.SCENE
    });

    if (notify) {
      ui.notifications.warn(
        game.i18n.localize(
          "ETC.Notifications.IncoherentBallRecovered"
        )
      );
    }

    return getCollectiveState();
  })().finally(() => {
    incoherentStageRepairPromise = null;
  });

  return incoherentStageRepairPromise;
}

export function canSeizeNarration(
  state = getCollectiveState(),
  resolution = state?.activeResolution ?? null
) {
  if (
    !resolution ||
    state?.activeResolution?.id !== resolution.id ||
    state.stage !== GAME_STAGES.SCENE ||
    Number(state.litCandles) <= 1 ||
    Number(resolution.litCandlesAtRoll) <= 1 ||
    !resolution.gmRollCompleted ||
    resolution.gmRollSkipped ||
    resolution.status === RESOLUTION_STATUSES.RESOLVED ||
    resolution.status === RESOLUTION_STATUSES.CANCELLED ||
    resolution.narrationSeized
  ) {
    return false;
  }

  const blueSixes = (resolution.blueResults ?? [])
    .filter((result) => Number(result) === 6)
    .length;
  const redSixes = (resolution.redResults ?? [])
    .filter((result) => Number(result) === 6)
    .length;
  const momentSuccess = Boolean(
    resolution.momentUsed &&
    [5, 6].includes(Number(resolution.momentResult))
  );
  const momentSixes = Boolean(
    resolution.momentUsed &&
    Number(resolution.momentResult) === 6
  )
    ? 1
    : 0;
  const playerSixes = blueSixes + momentSixes;
  const playerSucceeded =
    blueSixes > 0 || momentSuccess;

  return Boolean(
    playerSucceeded &&
    redSixes > playerSixes
  );
}

export function getCollectiveStateView() {
  const state = getCollectiveState();
  const activeGM = game.users?.activeGM ?? null;
  const ballOfTruthsActive = Boolean(
    state.stage === GAME_STAGES.BALL_OF_TRUTHS &&
    isBallOfTruthsStateCoherent(state)
  );
  const canStartConflict = Boolean(
    activeGM &&
    !state.activeResolution &&
    state.stage === GAME_STAGES.SCENE &&
    state.bluePoolRemaining > 0
  );

  return {
    ...state,

    totalCandles: TOTAL_CANDLES,
    redPoolSize: TOTAL_CANDLES - state.litCandles,
    bluePoolMaximum: state.litCandles,

    hasActiveResolution: Boolean(state.activeResolution),
    hasLastResolution: Boolean(state.lastResolution),
    pendingInstantCount: state.instantRequests.length,

    gameIdShort: state.gameId?.slice(0, 8) ?? "—",
    createdAtLabel: state.createdAt
      ? new Date(state.createdAt).toLocaleString()
      : "—",

    activeGMName: activeGM?.name ?? "—",
    canStartConflict,
    canRollGM: Boolean(
      isActiveGM() &&
      state.activeResolution &&
      state.activeResolution.redPoolSize > 0 &&
      !state.activeResolution.gmRollCompleted
    ),
    canValidateResolution: Boolean(
      isActiveGM() &&
      state.activeResolution
    ),
    canStartNextScene: Boolean(
      isActiveGM() && ballOfTruthsActive
    ),
    truthsRequired: ballOfTruthsActive
      ? Math.max(0, state.litCandles - 1)
      : 0,
    nextSceneCandles: ballOfTruthsActive
      ? Math.max(0, state.litCandles - 1)
      : state.litCandles,
    canEditMechanics: Boolean(
      isActiveGM() &&
      !state.activeResolution &&
      state.stage === GAME_STAGES.SCENE
    ),
    canEditActorResources: Boolean(
      isActiveGM() &&
      !state.activeResolution
    ),
    canCreateNewGame: isActiveGM(),
    canSeizeNarration: Boolean(
      isActiveGM() &&
      canSeizeNarration(state)
    ),
    stageLabel: game.i18n.localize(
      state.stage === GAME_STAGES.BALL_OF_TRUTHS
        ? "ETC.GameStage.BallOfTruths"
        : "ETC.GameStage.Scene"
    ),
    isOfficialPresentation:
      state.presentationMode === PRESENTATION_MODES.OFFICIAL,
    isPersonalPresentation:
      state.presentationMode === PRESENTATION_MODES.PERSONAL,
    canModify: isActiveGM()
  };
}

export async function saveCollectiveState(state) {
  if (!isActiveGM()) {
    throw new Error(
      game.i18n.localize("ETC.Notifications.ActiveGMOnly")
    );
  }

  const normalized = normalizeCollectiveState({
    ...state,
    updatedAt: Date.now()
  });

  return game.settings.set(
    SYSTEM_ID,
    COLLECTIVE_STATE_KEY,
    normalized
  );
}

export async function ensureCollectiveStateInitialized() {
  const state = getCollectiveState();

  if (state.gameId) return state;
  if (!isActiveGM()) return state;

  return saveCollectiveState(createInitialCollectiveState());
}

export async function updateCollectiveState(changes) {
  const current = getCollectiveState();

  return saveCollectiveState({
    ...current,
    ...clone(changes)
  });
}

export async function setLitCandles(value) {
  return updateCollectiveState({
    litCandles: value
  });
}

export async function setBluePoolRemaining(value) {
  return updateCollectiveState({
    bluePoolRemaining: value
  });
}

export async function restoreBluePool() {
  const state = getCollectiveState();

  return updateCollectiveState({
    bluePoolRemaining: state.litCandles
  });
}

export async function setGameStage(stage) {
  return updateCollectiveState({ stage });
}

export async function setPresentationMode(presentationMode) {
  if (!Object.values(PRESENTATION_MODES).includes(presentationMode)) {
    throw new Error(
      game.i18n.localize(
        "ETC.Presentation.InvalidMode"
      )
    );
  }

  return updateCollectiveState({
    presentationMode
  });
}
