/**
 * Cycle de conflit Ten Candles : jets, ressources, validation définitive,
 * conséquences collectives et transition vers la scène suivante.
 */

import {
  GAME_STAGES,
  RESOLUTION_STATUSES,
  TOTAL_CANDLES
} from "../constants.js";

import {
  canSeizeNarration,
  getCollectiveState,
  saveCollectiveState
} from "../state/game-state.js";

import {
  consumeActorResource,
  getActorResourceState,
  getResolutionActor
} from "../resources.js";

import {
  clone
} from "../utils.js";

import {
  tryLockPartyLifecycle,
  unlockPartyLifecycle
} from "../management/party-lock.js";

import {
  notifyRequester
} from "../notifications.js";

import {
  publishQueuedInstantRequests,
  refreshSuspendedInstantMessages,
  suspendInstantRequestsInState
} from "../instant/manager.js";

import {
  analyzeResolution,
  countValue,
  rollD6Pool,
  rollPlayerD6Pool
} from "./dice.js";

import {
  createBallOfTruthsMessage,
  createCharacterDepartureMessage,
  createDarknessProgressionMessage,
  createResolutionMessage,
  updateBallOfTruthsMessage,
  updateResolutionMessage
} from "./chat.js";

let playerRollInProgress = false;
const resolutionActionLocks = new Set();

function requesterCanUseActor(
  requester,
  actor
) {
  return Boolean(
    requester?.isGM ||
    actor.testUserPermission(requester, "OWNER")
  );
}

function requesterCanControlResolution(
  requester,
  resolution
) {
  return Boolean(
    requester?.isGM ||
    requester?.id === resolution?.playerId
  );
}

function lockResolutionAction(resolutionId) {
  if (!resolutionId) return false;
  if (resolutionActionLocks.has(resolutionId)) return false;

  resolutionActionLocks.add(resolutionId);
  return true;
}

function unlockResolutionAction(resolutionId) {
  if (resolutionId) {
    resolutionActionLocks.delete(resolutionId);
  }
}

function getActionContext(
  requesterId,
  resolutionId,
  {
    gmOnly = false
  } = {}
) {
  const requester = game.users.get(requesterId);

  if (!requester) return null;

  const state = getCollectiveState();
  const resolution = state.activeResolution;

  if (
    !resolution ||
    resolution.id !== resolutionId
  ) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.NoActiveResolution"
      )
    );
    return null;
  }

  const allowed = gmOnly
    ? requester.isGM
    : requesterCanControlResolution(
        requester,
        resolution
      );

  if (!allowed) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.CannotControlResolution"
      )
    );
    return null;
  }

  return {
    requester,
    state,
    resolution
  };
}

async function saveAndRefreshResolution(
  state,
  resolution
) {
  resolution.updatedAt = Date.now();

  await saveCollectiveState({
    ...state,
    activeResolution: resolution
  });

  try {
    await updateResolutionMessage(resolution);
  } catch (error) {
    console.error(
      "tencandles-ga | Mise à jour de la carte de conflit impossible.",
      error
    );
  }

  return true;
}

export async function handlePlayerRoll(
  requesterId,
  actorUuid
) {
  const requester = game.users.get(requesterId);

  if (!requester) return false;

  if (playerRollInProgress) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Notifications.RollBusy")
    );
    return false;
  }

  const lifecycleOwner = `player-roll:${requesterId}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.PartyActionBusy"
      )
    );
    return false;
  }

  playerRollInProgress = true;

  try {
    const actor = actorUuid
      ? await fromUuid(actorUuid)
      : null;

    if (
      !actor ||
      actor.documentName !== "Actor" ||
      actor.type !== "character"
    ) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.InvalidActor"
        )
      );
      return false;
    }

    if (!requesterCanUseActor(requester, actor)) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.NotOwner"
        )
      );
      return false;
    }

    const state = getCollectiveState();

    if (state.activeResolution) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.ActiveResolution"
        )
      );
      return false;
    }

    if (state.stage !== GAME_STAGES.SCENE) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.BallActive"
        )
      );
      return false;
    }

    if (state.bluePoolRemaining <= 0) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.NoPlayerDice"
        )
      );
      return false;
    }

    const resources = getActorResourceState(actor);
    const bluePoolSize = state.bluePoolRemaining;

    const {
      blueResults,
      hopeResult
    } = await rollPlayerD6Pool(
      bluePoolSize,
      {
        includeHope: resources.canUseMoment,
        userId: requesterId,
        actorId: actor.id
      }
    );

    const redPoolSize =
      TOTAL_CANDLES - state.litCandles;

    const now = Date.now();

    const resolution = {
      id: foundry.utils.randomID(),
      status: redPoolSize > 0
        ? RESOLUTION_STATUSES.WAITING_GM
        : RESOLUTION_STATUSES.PENDING_VALIDATION,

      chatMessageId: null,

      playerId: requester.id,
      playerName: requester.name,

      actorId: actor.id,
      actorUuid: actor.uuid,
      actorName: actor.name,

      litCandlesAtRoll: state.litCandles,

      bluePoolSize,
      blueResults,

      momentUsed: hopeResult !== null,
      momentResult: hopeResult,

      redPoolSize,
      redResults: [],
      gmRollCompleted: redPoolSize === 0,
      gmRollSkipped: false,

      rerolls: {
        vice: false,
        virtue: false,
        limit: false
      },

      resources,

      // Une Limite déverrouillée pendant ce conflit ne devient utilisable
      // qu'au conflit suivant.
      limitAvailableAtStart:
        Boolean(resources.canUseLimit),

      finalSuccess: null,
      narrator: null,
      blueDiceLost: 0,
      narrationSeized: false,
      narrationSeizedAt: null,
      narrationSeizedCandles: null,
      ballInterrupted: false,

      history: [
        {
          type: "player-roll",
          results: clone(blueResults),
          timestamp: now
        },
        ...(hopeResult !== null
          ? [
              {
                type: "hope-roll",
                result: hopeResult,
                timestamp: now
              }
            ]
          : [])
      ],

      createdAt: now,
      updatedAt: now
    };

    // Toute carte d’Instant encore active est suspendue pendant le conflit.
    const {
      state: stateWithSuspendedInstants,
      suspendedRequests
    } = suspendInstantRequestsInState(state);

    // Sauvegarde mécanique avant la projection dans le chat.
    await saveCollectiveState({
      ...stateWithSuspendedInstants,
      activeResolution: resolution
    });

    await refreshSuspendedInstantMessages(
      suspendedRequests,
      getCollectiveState()
    );

    if (state.lastResolution?.finalSuccess === true) {
      try {
        await updateResolutionMessage(
          state.lastResolution
        );
      } catch (error) {
        console.error(
          "tencandles-ga | Expiration visuelle de l’ancienne option de narration impossible.",
          error
        );
      }
    }

    try {
      const message =
        await createResolutionMessage(resolution);

      resolution.chatMessageId =
        message?.id ?? null;
      resolution.updatedAt = Date.now();

      const latestState = getCollectiveState();

      if (
        latestState.activeResolution?.id ===
        resolution.id
      ) {
        await saveCollectiveState({
          ...latestState,
          activeResolution: resolution
        });
      } else {
        // Une annulation très rapide ne doit pas ressusciter la résolution.
        resolution.status =
          RESOLUTION_STATUSES.CANCELLED;

        await updateResolutionMessage(resolution);
      }
    } catch (error) {
      console.error(
        "tencandles-ga | Carte de conflit non créée.",
        error
      );

      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.ChatCardFailed"
        )
      );
    }

    const analysis = analyzeResolution(
      resolution
    );

    if (hopeResult !== null) {
    }

    return true;
  } finally {
    playerRollInProgress = false;
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function handleGMRoll(
  requesterId,
  resolutionId
) {
  const context = getActionContext(
    requesterId,
    resolutionId,
    { gmOnly: true }
  );

  if (!context) return false;

  const {
    state,
    resolution
  } = context;

  if (!lockResolutionAction(resolution.id)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.ResolutionBusy"
      )
    );
    return false;
  }

  try {
    if (
      resolution.redPoolSize <= 0 ||
      resolution.gmRollCompleted
    ) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.GMRollUnavailable"
        )
      );
      return false;
    }

    const {
      results
    } = await rollD6Pool(
      resolution.redPoolSize,
      {
        userId: requesterId
      }
    );

    resolution.redResults = results;
    resolution.gmRollCompleted = true;
    resolution.status =
      RESOLUTION_STATUSES.PENDING_VALIDATION;

    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: "gm-roll",
        results: clone(results),
        timestamp: Date.now()
      }
    ];

    await saveAndRefreshResolution(
      state,
      resolution
    );

    const analysis =
      analyzeResolution(resolution);

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
  }
}

export async function handleViceOrVirtue(
  requesterId,
  resolutionId,
  resource
) {
  const context = getActionContext(
    requesterId,
    resolutionId
  );

  if (!context) return false;

  const {
    state,
    resolution
  } = context;

  if (!lockResolutionAction(resolution.id)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.ResolutionBusy"
      )
    );
    return false;
  }

  try {
    const actor = await getResolutionActor(
      resolution
    );

    if (!actor) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.ActorMissing"
        )
      );
      return false;
    }

    const resourceKey = resource === "vice"
      ? "canUseVice"
      : "canUseVirtue";

    if (!resolution.resources[resourceKey]) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.ResourceUnavailable"
        )
      );
      return false;
    }

    if (
      resolution.rerolls.vice ||
      resolution.rerolls.virtue
    ) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.ViceVirtueAlreadyUsed"
        )
      );
      return false;
    }

    const oneCount = countValue(
      resolution.blueResults,
      1
    );

    if (oneCount === 0) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.NoOnesToReroll"
        )
      );
      return false;
    }

    const {
      results: replacements
    } = await rollD6Pool(
      oneCount,
      {
        userId: resolution.playerId,
        actorId: resolution.actorId
      }
    );

    let replacementIndex = 0;

    resolution.blueResults =
      resolution.blueResults.map((result) => {
        if (result !== 1) return result;

        const replacement =
          replacements[replacementIndex];

        replacementIndex += 1;
        return replacement;
      });

    await consumeActorResource(
      actor,
      resource
    );

    resolution.rerolls[resource] = true;

    // L’instantané du conflit reste inchangé pour les autres ressources.
    resolution.resources[resourceKey] = false;

    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: resource,
        results: clone(replacements),
        timestamp: Date.now()
      }
    ];

    await saveAndRefreshResolution(
      state,
      resolution
    );

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
  }
}

export async function handleLimit(
  requesterId,
  resolutionId
) {
  const context = getActionContext(
    requesterId,
    resolutionId
  );

  if (!context) return false;

  const {
    state,
    resolution
  } = context;

  if (!lockResolutionAction(resolution.id)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.ResolutionBusy"
      )
    );
    return false;
  }

  try {
    const actor = await getResolutionActor(
      resolution
    );

    if (!actor) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.ActorMissing"
        )
      );
      return false;
    }

    if (!resolution.limitAvailableAtStart) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.LimitNextConflict"
        )
      );
      return false;
    }

    if (resolution.rerolls.limit) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.LimitAlreadyUsed"
        )
      );
      return false;
    }

    const {
      results
    } = await rollD6Pool(
      resolution.bluePoolSize,
      {
        userId: resolution.playerId,
        actorId: resolution.actorId
      }
    );

    resolution.blueResults = results;
    resolution.rerolls.limit = true;

    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: "limit",
        results: clone(results),
        timestamp: Date.now()
      }
    ];

    // Le dé d'Espoir est volontairement conservé.
    await saveAndRefreshResolution(
      state,
      resolution
    );

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
  }
}

export async function handleValidation(
  requesterId,
  resolutionId
) {
  const context = getActionContext(
    requesterId,
    resolutionId,
    { gmOnly: true }
  );

  if (!context) return false;

  const {
    state,
    resolution
  } = context;

  const lifecycleOwner = `validate:${resolution.id}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.PartyActionBusy"
      )
    );
    return false;
  }

  if (!lockResolutionAction(resolution.id)) {
    unlockPartyLifecycle(lifecycleOwner);
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.ResolutionBusy"
      )
    );
    return false;
  }

  try {
    const gmRollSkipped = Boolean(
      resolution.redPoolSize > 0 &&
      !resolution.gmRollCompleted
    );

    if (gmRollSkipped) {
      resolution.gmRollSkipped = true;
      resolution.redResults = [];
      resolution.history = [
        ...(resolution.history ?? []),
        {
          type: "gm-roll-skipped",
          timestamp: Date.now()
        }
      ];
    }

    const analysis =
      analyzeResolution(resolution);

    const finalSuccess = Boolean(
      analysis.provisionalSuccess
    );

    const narrator = finalSuccess
      ? (
          analysis.redSixes >
          analysis.playerSixes
            ? "gm"
            : "player"
        )
      : null;

    const characterDeparture = Boolean(
      !finalSuccess &&
      Number(resolution.litCandlesAtRoll) === 1
    );

    resolution.status =
      RESOLUTION_STATUSES.RESOLVED;
    resolution.finalSuccess = finalSuccess;
    resolution.narrator = narrator;
    resolution.characterDeparture =
      characterDeparture;

    // À la dernière bougie, l'échec fait quitter le personnage. L'unique dé
    // reste disponible pour les autres personnages encore présents.
    resolution.blueDiceLost = characterDeparture
      ? 0
      : analysis.blueOnes;

    resolution.updatedAt = Date.now();
    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: "validation",
        success: finalSuccess,
        narrator,
        blueDiceLost:
          resolution.blueDiceLost,
        characterDeparture,
        gmRollSkipped,
        timestamp: resolution.updatedAt
      }
    ];

    if (characterDeparture) {
      state.bluePoolRemaining = 1;
      state.stage = GAME_STAGES.SCENE;
    } else {
      state.bluePoolRemaining = Math.max(
        0,
        resolution.bluePoolSize -
          resolution.blueDiceLost
      );

      state.stage = finalSuccess
        ? GAME_STAGES.SCENE
        : GAME_STAGES.BALL_OF_TRUTHS;
    }

    state.lastResolution = clone(resolution);
    state.activeResolution = null;

    await saveCollectiveState(state);

    try {
      await updateResolutionMessage(resolution);
    } catch (error) {
      console.error(
        "tencandles-ga | Mise à jour de la résolution validée impossible.",
        error
      );
    }

    if (characterDeparture) {
      try {
        await createCharacterDepartureMessage(
          resolution
        );
      } catch (error) {
        console.error(
          "tencandles-ga | Message de départ du personnage impossible.",
          error
        );
      }
    } else if (!finalSuccess) {
      try {
        const message =
          await createBallOfTruthsMessage(
            resolution
          );

        if (message?.id) {
          resolution.ballMessageId = message.id;

          const latestState =
            getCollectiveState();

          if (
            latestState.lastResolution?.id ===
            resolution.id
          ) {
            await saveCollectiveState({
              ...latestState,
              lastResolution: clone(resolution)
            });
          }
        }
      } catch (error) {
        console.error(
          "tencandles-ga | Carte du Bal des vérités impossible.",
          error
        );

        notifyRequester(
          requesterId,
          "warn",
          game.i18n.localize(
            "ETC.Notifications.BallCardFailed"
          )
        );
      }
    }

    await publishQueuedInstantRequests();

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function handleSeizeNarration(
  requesterId,
  resolutionId
) {
  const requester = game.users.get(requesterId);

  if (!requester?.isGM) return false;

  const state = getCollectiveState();
  const resolution = state.activeResolution;

  if (
    !resolution ||
    resolution.id !== resolutionId ||
    !canSeizeNarration(state, resolution)
  ) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.NarrationSeizeUnavailable"
      )
    );
    return false;
  }

  const lifecycleOwner = `seize-narration:${resolution.id}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.PartyActionBusy"
      )
    );
    return false;
  }

  if (!lockResolutionAction(resolution.id)) {
    unlockPartyLifecycle(lifecycleOwner);
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.ResolutionBusy"
      )
    );
    return false;
  }

  try {
    // Le bouton spécial valide la résolution et applique immédiatement
    // l'extinction volontaire choisie par le joueur.
    const analysis = analyzeResolution(resolution);
    const previousCandles = state.litCandles;
    const nextCandles = Math.max(0, previousCandles - 1);
    const timestamp = Date.now();

    resolution.status =
      RESOLUTION_STATUSES.RESOLVED;
    resolution.finalSuccess = true;
    resolution.narrator = "player";
    resolution.characterDeparture = false;
    resolution.blueDiceLost = analysis.blueOnes;
    resolution.narrationSeized = true;
    resolution.narrationSeizedAt = timestamp;
    resolution.narrationSeizedCandles = nextCandles;
    resolution.updatedAt = timestamp;
    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: "validation",
        success: true,
        narrator: "player",
        blueDiceLost: resolution.blueDiceLost,
        characterDeparture: false,
        gmRollSkipped: false,
        narrationSeized: true,
        timestamp
      },
      {
        type: "narration-seized",
        candlesBefore: previousCandles,
        candlesAfter: nextCandles,
        timestamp
      }
    ];

    state.litCandles = nextCandles;
    state.bluePoolRemaining = nextCandles;
    state.stage = GAME_STAGES.SCENE;
    state.activeResolution = null;
    state.lastResolution = clone(resolution);

    await saveCollectiveState(state);

    try {
      await updateResolutionMessage(resolution);
    } catch (error) {
      console.error(
        "tencandles-ga | Mise à jour de la reprise de narration impossible.",
        error
      );
    }

    try {
      const message = await createBallOfTruthsMessage(
        resolution,
        {
          completed: true,
          litCandles: nextCandles,
          bluePoolRemaining: nextCandles
        }
      );

      if (message?.id) {
        resolution.ballMessageId = message.id;

        const latestState = getCollectiveState();
        if (latestState.lastResolution?.id === resolution.id) {
          await saveCollectiveState({
            ...latestState,
            lastResolution: clone(resolution)
          });
        }
      }
    } catch (error) {
      console.error(
        "tencandles-ga | Carte du Bal après reprise de narration impossible.",
        error
      );

      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.NarrationSeizeBallCardFailed"
        )
      );
    }

    try {
      await createDarknessProgressionMessage(
        getCollectiveState()
      );
    } catch (error) {
      console.error(
        "tencandles-ga | Message de progression après reprise de narration impossible.",
        error
      );
    }

    await publishQueuedInstantRequests();

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function handleStartNextScene(
  requesterId,
  {
    resolutionId = null,
    messageId = null
  } = {}
) {
  const requester = game.users.get(requesterId);

  if (!requester?.isGM) return false;

  const state = getCollectiveState();
  const resolution = state.lastResolution;

  if (state.stage !== GAME_STAGES.BALL_OF_TRUTHS) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.NotBallActive"
      )
    );
    return false;
  }

  if (
    !resolution ||
    resolution.finalSuccess !== false ||
    resolution.characterDeparture ||
    (
      resolutionId &&
      resolution.id !== resolutionId
    )
  ) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.InvalidBallTransition"
      )
    );
    return false;
  }

  if (state.litCandles <= 1) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.LastCandleDeparture"
      )
    );
    return false;
  }

  const lifecycleOwner = `start-next-scene:${resolution.id}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.PartyActionBusy"
      )
    );
    return false;
  }

  if (!lockResolutionAction(resolution.id)) {
    unlockPartyLifecycle(lifecycleOwner);
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.ResolutionBusy"
      )
    );
    return false;
  }

  try {
    const previousCandles = state.litCandles;

    state.litCandles = Math.max(
      0,
      state.litCandles - 1
    );
    state.bluePoolRemaining =
      state.litCandles;
    state.stage = GAME_STAGES.SCENE;

    resolution.updatedAt = Date.now();
    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: "ball-of-truths-completed",
        truths: state.litCandles,
        candlesBefore: previousCandles,
        candlesAfter: state.litCandles,
        timestamp: resolution.updatedAt
      }
    ];

    state.lastResolution = clone(resolution);

    await saveCollectiveState(state);

    try {
      await updateBallOfTruthsMessage(
        resolution,
        state,
        messageId
      );
    } catch (error) {
      console.error(
        "tencandles-ga | Mise à jour de la carte du Bal impossible.",
        error
      );
    }

    try {
      await createDarknessProgressionMessage(
        state
      );
    } catch (error) {
      console.error(
        "tencandles-ga | Message de progression des ténèbres impossible.",
        error
      );
    }

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function cancelActiveResolution({
  requestedResolutionId = null,
  publishInstantRequests = true
} = {}) {
  const state = getCollectiveState();
  const resolution = state.activeResolution;

  if (!resolution) return false;

  if (
    requestedResolutionId &&
    resolution.id !== requestedResolutionId
  ) {
    return false;
  }

  if (!lockResolutionAction(resolution.id)) {
    return false;
  }

  try {
    resolution.status =
      RESOLUTION_STATUSES.CANCELLED;
    resolution.updatedAt = Date.now();
    resolution.history = [
      ...(resolution.history ?? []),
      {
        type: "cancelled",
        timestamp: resolution.updatedAt
      }
    ];

    await saveCollectiveState({
      ...state,
      activeResolution: null,
      lastResolution: resolution
    });

    await updateResolutionMessage(resolution);

    if (publishInstantRequests) {
      await publishQueuedInstantRequests();
    }

    return true;
  } finally {
    unlockResolutionAction(resolution.id);
  }
}

export async function handleCancelResolution(
  requesterId,
  resolutionId = null
) {
  const requester = game.users.get(requesterId);

  if (!requester?.isGM) return false;

  const lifecycleOwner = `cancel-resolution:${
    resolutionId ?? "active"
  }`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize(
        "ETC.Notifications.PartyActionBusy"
      )
    );
    return false;
  }

  try {
    const cancelled = await cancelActiveResolution({
      requestedResolutionId: resolutionId
    });

    if (!cancelled) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize(
          "ETC.Notifications.NoActiveResolution"
        )
      );
      return false;
    }

    return true;
  } finally {
    unlockPartyLifecycle(lifecycleOwner);
  }
}
