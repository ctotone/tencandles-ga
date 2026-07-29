/**
 * Cycle de vie des demandes d'Instant.
 *
 * Une demande peut être mise en attente pendant un conflit, publiée dans le
 * chat, suspendue par un nouveau conflit, puis republiée jusqu'à ce qu'un MJ
 * ou le propriétaire du personnage choisisse Réussite ou Échec.
 */

import {
  INSTANT_REQUEST_STATUSES,
  INSTANT_STATUSES
} from "../constants.js";

import {
  getCollectiveState,
  saveCollectiveState
} from "../state/game-state.js";

import {
  notifyRequester
} from "../notifications.js";

import {
  clone
} from "../utils.js";

import {
  tryLockPartyLifecycle,
  unlockPartyLifecycle
} from "../management/party-lock.js";

import {
  createInstantMessage,
  renderInstantCard,
  updateInstantRequestMessages
} from "./chat.js";

let instantPublicationPromise = null;

function requesterCanUseActor(requester, actor) {
  return Boolean(
    requester?.isGM ||
    actor?.testUserPermission(requester, "OWNER")
  );
}

async function getCharacterActor({
  actorUuid = null,
  actorId = null
} = {}) {
  let actor = null;

  if (actorUuid) {
    actor = await fromUuid(actorUuid);
  }

  if (!actor && actorId) {
    actor = game.actors.get(actorId);
  }

  return Boolean(
    actor?.documentName === "Actor" &&
    actor.type === "character"
  )
    ? actor
    : null;
}

export function getInstantRequestForActor(
  state,
  actor
) {
  if (!actor) return null;

  return (state?.instantRequests ?? []).find(
    (request) =>
      request.actorUuid === actor.uuid ||
      request.actorId === actor.id
  ) ?? null;
}

export function suspendInstantRequestsInState(state) {
  const nextState = clone(state);
  const suspendedRequests = [];
  const timestamp = Date.now();

  nextState.instantRequests = (
    nextState.instantRequests ?? []
  ).map((request) => {
    if (
      request.status !==
      INSTANT_REQUEST_STATUSES.AWAITING
    ) {
      return request;
    }

    const suspended = {
      ...request,
      status: INSTANT_REQUEST_STATUSES.SUSPENDED,
      updatedAt: timestamp
    };

    suspendedRequests.push(clone(suspended));
    return suspended;
  });

  return {
    state: nextState,
    suspendedRequests
  };
}

export async function refreshSuspendedInstantMessages(
  requests,
  state = getCollectiveState()
) {
  await Promise.allSettled(
    (requests ?? []).map((request) =>
      updateInstantRequestMessages(
        request,
        { state }
      )
    )
  );
}

async function publishSingleInstantRequest(requestId) {
  let state = getCollectiveState();
  if (state.activeResolution) return false;

  const index = state.instantRequests.findIndex(
    (request) => request.id === requestId
  );
  if (index < 0) return false;

  const current = state.instantRequests[index];
  if (
    ![
      INSTANT_REQUEST_STATUSES.QUEUED,
      INSTANT_REQUEST_STATUSES.SUSPENDED
    ].includes(current.status)
  ) {
    return false;
  }

  const awaiting = {
    ...current,
    status: INSTANT_REQUEST_STATUSES.AWAITING,
    activeMessageId: null,
    updatedAt: Date.now()
  };

  state.instantRequests[index] = awaiting;
  await saveCollectiveState(state);

  let message = null;

  try {
    message = await createInstantMessage(awaiting);
  } catch (error) {
    console.error(
      "tencandles-ga | Publication de la carte d’Instant impossible.",
      error
    );

    const failedState = getCollectiveState();
    const failedIndex = failedState.instantRequests.findIndex(
      (request) => request.id === requestId
    );

    if (failedIndex >= 0) {
      failedState.instantRequests[failedIndex] = {
        ...failedState.instantRequests[failedIndex],
        status: INSTANT_REQUEST_STATUSES.QUEUED,
        activeMessageId: null,
        updatedAt: Date.now()
      };
      await saveCollectiveState(failedState);
    }

    return false;
  }

  if (!message?.id) return false;

  state = getCollectiveState();
  const latestIndex = state.instantRequests.findIndex(
    (request) => request.id === requestId
  );

  if (latestIndex < 0) {
    await message.update({
      content: await renderInstantCard(
        awaiting,
        { cancelled: true }
      )
    });
    return false;
  }

  const latest = state.instantRequests[latestIndex];
  const finalStatus = Boolean(
    state.activeResolution ||
    latest.status === INSTANT_REQUEST_STATUSES.SUSPENDED
  )
    ? INSTANT_REQUEST_STATUSES.SUSPENDED
    : INSTANT_REQUEST_STATUSES.AWAITING;

  const savedRequest = {
    ...latest,
    status: finalStatus,
    activeMessageId: message.id,
    messageIds: [
      ...new Set([
        ...(latest.messageIds ?? []),
        message.id
      ])
    ],
    updatedAt: Date.now()
  };

  state.instantRequests[latestIndex] = savedRequest;
  await saveCollectiveState(state);

  if (finalStatus === INSTANT_REQUEST_STATUSES.SUSPENDED) {
    await updateInstantRequestMessages(
      savedRequest,
      { state: getCollectiveState() }
    );
  }

  return true;
}

export async function publishQueuedInstantRequests() {
  if (instantPublicationPromise) {
    return instantPublicationPromise;
  }

  instantPublicationPromise = (async () => {
    const state = getCollectiveState();
    if (state.activeResolution) return false;

    const queuedIds = (state.instantRequests ?? [])
      .filter((request) =>
        [
          INSTANT_REQUEST_STATUSES.QUEUED,
          INSTANT_REQUEST_STATUSES.SUSPENDED
        ].includes(request.status)
      )
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((request) => request.id);

    for (const requestId of queuedIds) {
      const latest = getCollectiveState();
      if (latest.activeResolution) break;
      await publishSingleInstantRequest(requestId);
    }

    return true;
  })().finally(() => {
    instantPublicationPromise = null;
  });

  return instantPublicationPromise;
}

export async function handleRequestInstant(
  requesterId,
  actorUuid
) {
  const requester = game.users.get(requesterId);
  if (!requester) return false;

  const actor = await getCharacterActor({ actorUuid });

  if (!actor) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Notifications.InvalidActor")
    );
    return false;
  }

  if (!requesterCanUseActor(requester, actor)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Notifications.NotOwner")
    );
    return false;
  }

  if (actor.system.momentStatus !== INSTANT_STATUSES.IDLE) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Instant.AlreadyResolved")
    );
    return false;
  }

  const lifecycleOwner = `instant-request:${actor.id}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Notifications.PartyActionBusy")
    );
    return false;
  }

  try {
    const state = getCollectiveState();

    if (getInstantRequestForActor(state, actor)) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.AlreadyPending")
      );
      return false;
    }

    const now = Date.now();
    const request = {
      id: foundry.utils.randomID(),
      actorId: actor.id,
      actorUuid: actor.uuid,
      actorName: actor.name,
      instantText: actor.system.moment.text,
      requesterId,
      status: INSTANT_REQUEST_STATUSES.QUEUED,
      messageIds: [],
      activeMessageId: null,
      createdAt: now,
      updatedAt: now
    };

    await saveCollectiveState({
      ...state,
      instantRequests: [
        ...(state.instantRequests ?? []),
        request
      ]
    });

    if (state.activeResolution) {
      notifyRequester(
        requesterId,
        "info",
        game.i18n.localize("ETC.Instant.QueuedNotification")
      );
      return true;
    }

    await publishQueuedInstantRequests();

    const latestRequest = getCollectiveState().instantRequests.find(
      (candidate) => candidate.id === request.id
    );
    const published = Boolean(
      latestRequest?.status === INSTANT_REQUEST_STATUSES.AWAITING &&
      latestRequest?.activeMessageId
    );

    notifyRequester(
      requesterId,
      published ? "info" : "warn",
      game.i18n.localize(
        published
          ? "ETC.Instant.PublishedNotification"
          : "ETC.Instant.PublishFailed"
      )
    );

    return published;
  } finally {
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function handleCancelInstantRequest(
  requesterId,
  requestId
) {
  const requester = game.users.get(requesterId);
  if (!requester) return false;

  const lifecycleOwner = `instant-cancel:${requestId}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Notifications.PartyActionBusy")
    );
    return false;
  }

  try {
    const state = getCollectiveState();
    const request = state.instantRequests.find(
      (candidate) => candidate.id === requestId
    );

    if (!request) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.RequestMissing")
      );
      return false;
    }

    const actor = await getCharacterActor({
      actorUuid: request.actorUuid,
      actorId: request.actorId
    });

    if (!actor || !requesterCanUseActor(requester, actor)) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Notifications.NotOwner")
      );
      return false;
    }

    if ((request.messageIds ?? []).length > 0) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.CannotCancelPublished")
      );
      return false;
    }

    await saveCollectiveState({
      ...state,
      instantRequests: state.instantRequests.filter(
        (candidate) => candidate.id !== requestId
      )
    });

    notifyRequester(
      requesterId,
      "info",
      game.i18n.localize("ETC.Instant.CancelledNotification")
    );

    return true;
  } finally {
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function handleResolveInstant(
  requesterId,
  requestId,
  result
) {
  const requester = game.users.get(requesterId);
  if (!requester) return false;

  if (![INSTANT_STATUSES.SUCCESS, INSTANT_STATUSES.FAILURE].includes(result)) {
    return false;
  }

  const lifecycleOwner = `instant-resolve:${requestId}`;

  if (!tryLockPartyLifecycle(lifecycleOwner)) {
    notifyRequester(
      requesterId,
      "warn",
      game.i18n.localize("ETC.Notifications.PartyActionBusy")
    );
    return false;
  }

  try {
    const state = getCollectiveState();
    const request = state.instantRequests.find(
      (candidate) => candidate.id === requestId
    );

    if (!request) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.RequestMissing")
      );
      return false;
    }

    if (state.activeResolution) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.WaitForConflictEnd")
      );
      return false;
    }

    if (request.status !== INSTANT_REQUEST_STATUSES.AWAITING) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.RequestNotReady")
      );
      return false;
    }

    const actor = await getCharacterActor({
      actorUuid: request.actorUuid,
      actorId: request.actorId
    });

    if (!actor || !requesterCanUseActor(requester, actor)) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Notifications.NotOwner")
      );
      return false;
    }

    if (actor.system.momentStatus !== INSTANT_STATUSES.IDLE) {
      notifyRequester(
        requesterId,
        "warn",
        game.i18n.localize("ETC.Instant.AlreadyResolved")
      );
      return false;
    }

    await actor.update({
      "system.moment.status": result
    });

    await saveCollectiveState({
      ...state,
      instantRequests: state.instantRequests.filter(
        (candidate) => candidate.id !== requestId
      )
    });

    await updateInstantRequestMessages(
      request,
      { resolvedStatus: result }
    );

    notifyRequester(
      requesterId,
      "info",
      game.i18n.format(
        result === INSTANT_STATUSES.SUCCESS
          ? "ETC.Instant.SuccessNotification"
          : "ETC.Instant.FailureNotification",
        { name: actor.name }
      )
    );

    return true;
  } finally {
    unlockPartyLifecycle(lifecycleOwner);
  }
}

export async function discardInstantRequestForActor(
  actor,
  { cancelled = true } = {}
) {
  if (!actor) return false;

  const state = getCollectiveState();
  const request = getInstantRequestForActor(state, actor);
  if (!request) return false;

  await saveCollectiveState({
    ...state,
    instantRequests: state.instantRequests.filter(
      (candidate) => candidate.id !== request.id
    )
  });

  if (cancelled) {
    await updateInstantRequestMessages(
      request,
      { cancelled: true, state }
    );
  }

  return true;
}

export async function interruptInstantRequests(
  state = getCollectiveState()
) {
  await Promise.allSettled(
    (state.instantRequests ?? []).map((request) =>
      updateInstantRequestMessages(
        request,
        { cancelled: true, state }
      )
    )
  );

  return true;
}
