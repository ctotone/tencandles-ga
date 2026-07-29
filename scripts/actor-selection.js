/**
 * Sélection du personnage utilisé pour un conflit.
 */

import { escapeHTML, readDialogForm } from "./utils.js";

export function getControlledCharacterActors() {
  const actors = (canvas.tokens?.controlled ?? [])
    .map((token) => token.actor)
    .filter((actor) => actor?.type === "character");

  return [
    ...new Map(
      actors.map((actor) => [actor.uuid, actor])
    ).values()
  ];
}

export function getOwnedCharacterActors(user) {
  return game.actors.filter((actor) => {
    if (actor.type !== "character") return false;
    return actor.testUserPermission(user, "OWNER");
  });
}

export async function chooseCharacterActorForRoll() {
  const controlledActors = getControlledCharacterActors();

  if (controlledActors.length === 1) {
    return controlledActors[0];
  }

  if (controlledActors.length > 1) {
    ui.notifications.warn(
      game.i18n.localize("ETC.Notifications.SelectOneToken")
    );
    return null;
  }

  const assignedActor = game.user.character;

  if (
    assignedActor?.type === "character" &&
    (
      game.user.isGM ||
      assignedActor.testUserPermission(game.user, "OWNER")
    )
  ) {
    return assignedActor;
  }

  const candidates = game.user.isGM
    ? game.actors.filter((actor) => actor.type === "character")
    : getOwnedCharacterActors(game.user);

  if (candidates.length === 0) {
    ui.notifications.warn(
      game.i18n.localize("ETC.Notifications.NoCharacter")
    );
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const options = candidates
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang))
    .map(
      (actor) =>
        `<option value="${escapeHTML(actor.uuid)}">` +
        `${escapeHTML(actor.name)}</option>`
    )
    .join("");

  const result = await foundry.applications.api.DialogV2.input({
    window: {
      title: game.i18n.localize("ETC.ActorSelection.Title")
    },
    content: `
      <div class="ets-dialog">
        <label>
          <span>${game.i18n.localize("ETC.ActorSelection.Label")}</span>
          <select name="actorUuid">
            ${options}
          </select>
        </label>
      </div>
    `,
    ok: {
      label: game.i18n.localize("ETC.Common.Choose"),
      callback: (_event, button) => {
        const fields = readDialogForm(button);
        return {
          actorUuid: fields.getValue("actorUuid")
        };
      }
    },
    rejectClose: false,
    modal: true
  });

  if (!result?.actorUuid) return null;

  const actor = await fromUuid(result.actorUuid);

  return actor?.documentName === "Actor" &&
    actor.type === "character"
    ? actor
    : null;
}
