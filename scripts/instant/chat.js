/**
 * Cartes publiques utilisées pour enregistrer l'issue narrative d'un Instant.
 */

import {
  INSTANT_REQUEST_STATUSES,
  INSTANT_STATUSES,
  SYSTEM_ID
} from "../constants.js";

import {
  getCollectiveState
} from "../state/game-state.js";

const INSTANT_TEMPLATE_PATH =
  "systems/tencandles-ga/templates/chat/instant-card.hbs";

export async function renderInstantCard(
  request,
  {
    resolvedStatus = null,
    cancelled = false,
    state = getCollectiveState()
  } = {}
) {
  const resolvedSuccess =
    resolvedStatus === INSTANT_STATUSES.SUCCESS;
  const resolvedFailure =
    resolvedStatus === INSTANT_STATUSES.FAILURE;
  const blockedByConflict = Boolean(
    !resolvedStatus &&
    !cancelled &&
    (
      state.activeResolution ||
      request.status === INSTANT_REQUEST_STATUSES.SUSPENDED
    )
  );
  const awaitingDecision = Boolean(
    !resolvedStatus &&
    !cancelled &&
    !blockedByConflict &&
    request.status === INSTANT_REQUEST_STATUSES.AWAITING
  );

  return foundry.applications.handlebars.renderTemplate(
    INSTANT_TEMPLATE_PATH,
    {
      request,
      awaitingDecision,
      blockedByConflict,
      resolvedSuccess,
      resolvedFailure,
      cancelled
    }
  );
}

export async function createInstantMessage(request) {
  const content = await renderInstantCard(request);

  return foundry.documents.ChatMessage.create({
    content,
    speaker: {
      actor: request.actorId,
      alias: request.actorName
    },
    flags: {
      [SYSTEM_ID]: {
        type: "instant",
        instantRequestId: request.id,
        actorId: request.actorId,
        actorUuid: request.actorUuid
      }
    }
  });
}

export async function updateInstantRequestMessages(
  request,
  options = {}
) {
  const messageIds = Array.isArray(request?.messageIds)
    ? request.messageIds
    : [];

  const tasks = messageIds.map(async (messageId) => {
    const message = game.messages.get(messageId);
    if (!message) return false;

    await message.update({
      content: await renderInstantCard(
        request,
        options
      )
    });

    return true;
  });

  await Promise.allSettled(tasks);
  return true;
}

export function activateInstantCardActions(
  message,
  html
) {
  const requestId = message.getFlag(
    SYSTEM_ID,
    "instantRequestId"
  );

  if (!requestId) return;

  const card = html.querySelector(
    "[data-instant-request-id]"
  );
  if (!card) return;

  const actorId = message.getFlag(
    SYSTEM_ID,
    "actorId"
  );
  const actor = actorId
    ? game.actors.get(actorId)
    : null;

  const canResolve = Boolean(
    game.user.isGM ||
    actor?.testUserPermission(game.user, "OWNER")
  );

  const actions = card.querySelector(
    "[data-instant-actions]"
  );

  actions?.classList.toggle(
    "is-readonly",
    !canResolve
  );

  for (const button of card.querySelectorAll(
    "[data-instant-action]"
  )) {
    if (!canResolve) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    }

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      if (button.disabled || !canResolve) return;

      const result = button.dataset.instantAction;
      if (![INSTANT_STATUSES.SUCCESS, INSTANT_STATUSES.FAILURE].includes(result)) {
        return;
      }

      button.disabled = true;

      try {
        const {
          requestAction
        } = await import("../conflict/socket.js");

        await requestAction("resolve-instant", {
          requestId,
          result
        });
      } finally {
        globalThis.setTimeout(() => {
          if (button.isConnected) {
            button.disabled = false;
          }
        }, 650);
      }
    });
  }
}
