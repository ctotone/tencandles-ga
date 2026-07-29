/**
 * Communication joueur vers MJ actif.
 */

import {
  SOCKET_NAME,
  SYSTEM_ID
} from "../constants.js";

import {
  isActiveGM
} from "../state/game-state.js";

import {
  chooseCharacterActorForRoll
} from "../actor-selection.js";

import {
  handleDice3DRollMessage
} from "./dice.js";

import {
  handleCancelResolution,
  handleGMRoll,
  handleLimit,
  handlePlayerRoll,
  handleSeizeNarration,
  handleStartNextScene,
  handleValidation,
  handleViceOrVirtue
} from "./resolution.js";

import {
  notifyRequester
} from "../notifications.js";

import {
  handleCancelInstantRequest,
  handleRequestInstant,
  handleResolveInstant
} from "../instant/manager.js";

export async function requestPlayerRoll(
  actorUuid = null
) {
  let selectedActorUuid = actorUuid;

  if (!selectedActorUuid) {
    const actor =
      await chooseCharacterActorForRoll();

    if (!actor) return false;

    selectedActorUuid = actor.uuid;
  }

  return requestAction("player-roll", {
    actorUuid: selectedActorUuid
  });
}

export async function requestGMRoll(
  resolutionId = null
) {
  return requestAction("gm-roll", {
    resolutionId
  });
}

async function handleGMRequest(data) {
  const requesterId = data.requesterId;
  const resolutionId =
    data.payload?.resolutionId ?? null;

  switch (data.action) {
    case "player-roll":
      return handlePlayerRoll(
        requesterId,
        data.payload?.actorUuid
      );

    case "gm-roll":
      return handleGMRoll(
        requesterId,
        resolutionId
      );

    case "use-vice":
      return handleViceOrVirtue(
        requesterId,
        resolutionId,
        "vice"
      );

    case "use-virtue":
      return handleViceOrVirtue(
        requesterId,
        resolutionId,
        "virtue"
      );

    case "use-limit":
      return handleLimit(
        requesterId,
        resolutionId
      );

    case "validate-resolution":
      return handleValidation(
        requesterId,
        resolutionId
      );

    case "seize-narration":
      return handleSeizeNarration(
        requesterId,
        resolutionId
      );

    case "start-next-scene":
      return handleStartNextScene(
        requesterId,
        {
          resolutionId,
          messageId:
            data.payload?.messageId ?? null
        }
      );

    case "cancel-resolution":
      return handleCancelResolution(
        requesterId,
        resolutionId
      );

    case "request-instant":
      return handleRequestInstant(
        requesterId,
        data.payload?.actorUuid ?? null
      );

    case "cancel-instant-request":
      return handleCancelInstantRequest(
        requesterId,
        data.payload?.requestId ?? null
      );

    case "resolve-instant":
      return handleResolveInstant(
        requesterId,
        data.payload?.requestId ?? null,
        data.payload?.result ?? null
      );

    default:
      console.warn(
        `${SYSTEM_ID} | Action socket inconnue :`,
        data.action
      );
      return false;
  }
}

export async function onSocketMessage(data) {
  if (!data || typeof data !== "object") return;

  if (data.type === "notification") {
    if (data.targetId !== game.user.id) return;

    const level = [
      "info",
      "warn",
      "error"
    ].includes(data.level)
      ? data.level
      : "info";

    ui.notifications[level]?.(data.message);
    return;
  }

  if (data.type === "dice3d-roll") {
    await handleDice3DRollMessage(data);
    return;
  }

  if (data.type !== "request") return;
  if (!isActiveGM()) return;

  try {
    await handleGMRequest(data);
  } catch (error) {
    console.error(
      `${SYSTEM_ID} | Erreur de traitement socket :`,
      error
    );

    notifyRequester(
      data.requesterId,
      "error",
      game.i18n.localize(
        "ETC.Notifications.ResolutionError"
      )
    );
  }
}

export async function requestAction(
  action,
  payload = {}
) {
  const activeGM = game.users.activeGM;

  if (!activeGM) {
    ui.notifications.error(
      game.i18n.localize(
        "ETC.Notifications.NoActiveGM"
      )
    );
    return false;
  }

  const request = {
    type: "request",
    action,
    requesterId: game.user.id,
    payload
  };

  if (isActiveGM()) {
    return handleGMRequest(request);
  }

  game.socket.emit(SOCKET_NAME, request);
  return true;
}
