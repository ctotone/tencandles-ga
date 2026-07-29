/**
 * Corrections explicites des états mécaniques individuels depuis la régie MJ.
 */

import {
  INSTANT_STATUSES
} from "../constants.js";

import {
  getCollectiveState,
  isActiveGM
} from "../state/game-state.js";

import {
  discardInstantRequestForActor
} from "../instant/manager.js";

export function getWorldCharacterActors() {
  const locale = game.i18n?.lang ?? "fr";

  return game.actors
    .filter((actor) => actor.type === "character")
    .sort((left, right) =>
      String(left.name ?? "").localeCompare(
        String(right.name ?? ""),
        locale,
        { sensitivity: "base" }
      )
    );
}

export async function updateCharacterResourceStates(
  actorId,
  {
    viceAvailable,
    virtueAvailable,
    momentStatus
  }
) {
  if (!isActiveGM()) {
    throw new Error(
      game.i18n.localize("ETC.Notifications.ActiveGMOnly")
    );
  }

  const state = getCollectiveState();
  if (state.activeResolution) {
    throw new Error(
      game.i18n.localize(
        "ETC.ActorManagement.ConflictBlocked"
      )
    );
  }

  const actor = game.actors.get(actorId);
  if (!actor || actor.type !== "character") {
    throw new Error(
      game.i18n.localize(
        "ETC.ActorManagement.InvalidCharacter"
      )
    );
  }

  const normalizedMomentStatus = Object.values(
    INSTANT_STATUSES
  ).includes(momentStatus)
    ? momentStatus
    : INSTANT_STATUSES.IDLE;

  if (normalizedMomentStatus !== INSTANT_STATUSES.IDLE) {
    await discardInstantRequestForActor(actor);
  }

  await actor.update({
    "system.vice.available": Boolean(viceAvailable),
    "system.virtue.available": Boolean(virtueAvailable),
    "system.moment.status": normalizedMomentStatus
  });

  return actor;
}
