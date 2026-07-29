import {
  COLLECTIVE_STATE_CHANGED_HOOK,
  INSTANT_REQUEST_STATUSES,
  PRESENTATION_MODES,
  SOCKET_NAME,
  SYSTEM_ID
} from "./constants.js";

import { TenCandlesCharacterData } from "./data/character-data.js";
import { TenCandlesCharacterSheet } from "./sheets/character-sheet.js";
import { TenCandlesStateControl } from "./apps/game-state-control.js";

import { registerSystemFonts } from "./fonts.js";

import {
  ensureCollectiveStateInitialized,
  getCollectiveState,
  getCollectiveStateView,
  isActiveGM,
  isBallOfTruthsStateCoherent,
  registerCollectiveStateSetting,
  repairIncoherentGameStage,
  saveCollectiveState,
  setPresentationMode
} from "./state/game-state.js";

import {
  activateResolutionCardActions,
  refreshNarrationSeizeCard,
  registerDepartureMessageHistorySetting
} from "./conflict/chat.js";

import {
  activateInstantCardActions
} from "./instant/chat.js";

import {
  discardInstantRequestForActor,
  publishQueuedInstantRequests
} from "./instant/manager.js";

import {
  cancelActiveResolution
} from "./conflict/resolution.js";

import {
  createNewGame
} from "./management/game-manager.js";

import {
  isPartyLifecycleLocked
} from "./management/party-lock.js";

import {
  mountFloatingPlayerRollButton,
  refreshPlayerRollControls,
  registerPlayerRollSceneControl
} from "./conflict/controls.js";

import {
  mountGMStateControlActorDirectoryButton,
  registerGMStateControlSceneControl
} from "./controls/gm-access.js";

import {
  onSocketMessage,
  requestAction,
  requestGMRoll,
  requestPlayerRoll
} from "./conflict/socket.js";

import {
  getOfficialCanvasStatus,
  initializeOfficialCanvas,
  repairOfficialCanvas,
  viewOfficialCanvas
} from "./canvas/installer.js";

import {
  queueOfficialCanvasSync,
  syncOfficialCanvas
} from "./canvas/sync.js";

export { SYSTEM_ID };

const MANAGED_CANVAS_ROLES = new Set([
  "candle-flame",
  "candle-light",
  "blue-die",
  "red-die"
]);

const DEFAULT_CHARACTER_AVATAR =
  `systems/${SYSTEM_ID}/assets/actor/avatar-ten-candles.webp`;

let managedCanvasWarningPending = false;

async function repairIncoherentStageSafely(state = undefined) {
  try {
    return await repairIncoherentGameStage({
      ...(state ? { state } : {}),
      notify: true
    });
  } catch (error) {
    console.error(
      `${SYSTEM_ID} | Réparation de la phase incohérente impossible.`,
      error
    );

    ui.notifications.error(
      game.i18n.localize(
        "ETC.Notifications.IncoherentBallRecoveryFailed"
      )
    );

    return null;
  }
}

function warnManagedCanvasElementDeleted(document) {
  if (!isActiveGM()) return;

  const state = getCollectiveState();
  if (document.parent?.id !== state.activeSceneId) return;

  const role =
    document.getFlag?.(SYSTEM_ID, "role")
    ?? document.flags?.[SYSTEM_ID]?.role
    ?? null;

  if (!MANAGED_CANVAS_ROLES.has(role)) return;
  if (managedCanvasWarningPending) return;

  managedCanvasWarningPending = true;

  globalThis.setTimeout(() => {
    managedCanvasWarningPending = false;
  }, 500);

  ui.notifications.warn(
    game.i18n.localize(
      "ETC.Canvas.ManagedElementDeleted"
    )
  );

  for (const app of TenCandlesStateControl.instances()) {
    if (app.rendered) app.render();
  }
}

Hooks.once("init", () => {
  console.info(`${SYSTEM_ID} | Initialisation du système`);

  registerSystemFonts();

  CONFIG.Actor.dataModels.character = TenCandlesCharacterData;

  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    SYSTEM_ID,
    TenCandlesCharacterSheet,
    {
      types: ["character"],
      makeDefault: true,
      label: "ETC.Sheets.Character"
    }
  );

  registerCollectiveStateSetting();
  registerDepartureMessageHistorySetting();

  game.settings.registerMenu(
    SYSTEM_ID,
    "collectiveStateControl",
    {
      name: "ETC.Settings.StateControl.Name",
      label: "ETC.Settings.StateControl.Label",
      hint: "ETC.Settings.StateControl.Hint",
      icon: "fa-solid fa-fire-flame-curved",
      type: TenCandlesStateControl,
      restricted: true
    }
  );
});

Hooks.on("preCreateActor", (actor, data) => {
  const actorType = data?.type ?? actor.type;
  if (actorType !== "character") return;

  const requestedImage = String(
    data?.img
    ?? actor._source?.img
    ?? actor.img
    ?? ""
  ).trim();

  const coreDefaultImage = String(
    foundry.documents.Actor.DEFAULT_ICON
    ?? CONST.DEFAULT_TOKEN
    ?? ""
  ).trim();

  if (
    requestedImage &&
    requestedImage !== coreDefaultImage
  ) {
    return;
  }

  actor.updateSource({
    img: DEFAULT_CHARACTER_AVATAR
  });
});

Hooks.on(COLLECTIVE_STATE_CHANGED_HOOK, (state) => {
  if (
    isActiveGM() &&
    !isBallOfTruthsStateCoherent(state)
  ) {
    void repairIncoherentStageSafely(state);
    return;
  }

  for (const app of TenCandlesStateControl.instances()) {
    if (app.rendered) app.render();
  }

  for (const sheet of TenCandlesCharacterSheet.instances()) {
    if (sheet.rendered) sheet.render();
  }

  refreshPlayerRollControls();

  if (isActiveGM()) {
    if (
      !state.activeResolution &&
      !isPartyLifecycleLocked() &&
      (state.instantRequests ?? []).some((request) =>
        [
          INSTANT_REQUEST_STATUSES.QUEUED,
          INSTANT_REQUEST_STATUSES.SUSPENDED
        ].includes(request.status)
      )
    ) {
      void publishQueuedInstantRequests().catch((error) => {
        console.error(
          `${SYSTEM_ID} | Republication des Instants impossible.`,
          error
        );
      });
    }

    void refreshNarrationSeizeCard(state).catch((error) => {
      console.error(
        `${SYSTEM_ID} | Actualisation de l’option de narration impossible.`,
        error
      );
    });
    void queueOfficialCanvasSync(state, {
      notify: false
    });
  }
});

Hooks.once("ready", async () => {
  game.socket.on(SOCKET_NAME, onSocketMessage);

  await ensureCollectiveStateInitialized();
  await repairIncoherentStageSafely();

  if (isActiveGM()) {
    const readyState = getCollectiveState();
    if (
      !readyState.activeResolution &&
      (readyState.instantRequests ?? []).some((request) =>
        [
          INSTANT_REQUEST_STATUSES.QUEUED,
          INSTANT_REQUEST_STATUSES.SUSPENDED
        ].includes(request.status)
      )
    ) {
      await publishQueuedInstantRequests();
    }

    try {
      await initializeOfficialCanvas();
    } catch (error) {
      console.error(
        `${SYSTEM_ID} | Initialisation du canevas officiel impossible.`,
        error
      );

      ui.notifications.warn(
        game.i18n.localize(
          "ETC.Canvas.InitializationFailed"
        )
      );
    }
  }

  game.evilTenCandles = {
    state: {
      get: getCollectiveState,
      getView: getCollectiveStateView,
      setPresentationMode
    },

    requestPlayerRoll,
    requestGMRoll,
    requestAction,
    cancelActiveResolution,
    validateActiveResolution: (resolutionId) =>
      requestAction("validate-resolution", { resolutionId }),
    startNextScene: (payload = {}) =>
      requestAction("start-next-scene", payload),
    seizeNarration: (resolutionId) =>
      requestAction("seize-narration", { resolutionId }),
    createNewGame,

    canvas: {
      getStatus: getOfficialCanvasStatus,
      view: viewOfficialCanvas,
      sync: (options = {}) =>
        syncOfficialCanvas(undefined, options),
      repair: repairOfficialCanvas
    },

    openStateControl: () => TenCandlesStateControl.open()
  };

  mountFloatingPlayerRollButton();

  console.info(`${SYSTEM_ID} | Système prêt`);
});

Hooks.on(
  "getSceneControlButtons",
  (controls) => {
    registerPlayerRollSceneControl(controls);
    registerGMStateControlSceneControl(controls);
  }
);

Hooks.on(
  "renderActorDirectory",
  mountGMStateControlActorDirectoryButton
);

function refreshStateControlForActorChange() {
  for (const app of TenCandlesStateControl.instances()) {
    if (app.rendered) app.render();
  }
}

Hooks.on("createActor", refreshStateControlForActorChange);
Hooks.on("updateActor", refreshStateControlForActorChange);
Hooks.on("deleteActor", (actor) => {
  refreshStateControlForActorChange();

  if (isActiveGM()) {
    void discardInstantRequestForActor(actor).catch((error) => {
      console.error(
        `${SYSTEM_ID} | Nettoyage de l’Instant du personnage supprimé impossible.`,
        error
      );
    });
  }
});

Hooks.on(
  "renderChatMessageHTML",
  (message, html) => {
    activateResolutionCardActions(message, html);
    activateInstantCardActions(message, html);
  }
);

Hooks.on("userConnected", () => {
  refreshPlayerRollControls();

  for (const app of TenCandlesStateControl.instances()) {
    if (app.rendered) app.render();
  }

  for (const sheet of TenCandlesCharacterSheet.instances()) {
    if (sheet.rendered) sheet.render();
  }
});

Hooks.on("canvasReady", () => {
  mountFloatingPlayerRollButton();

  if (isActiveGM()) {
    void queueOfficialCanvasSync(
      getCollectiveState(),
      {
        notify: false
      }
    );
  }
});

Hooks.on("deleteScene", (scene) => {
  if (!isActiveGM()) return;

  const state = getCollectiveState();
  if (state.activeSceneId !== scene.id) return;

  if (
    state.presentationMode ===
    PRESENTATION_MODES.PERSONAL
  ) {
    void saveCollectiveState({
      ...state,
      activeSceneId: null
    });
    return;
  }

  ui.notifications.warn(
    game.i18n.localize(
      "ETC.Canvas.SceneDeleted"
    )
  );

  for (const app of TenCandlesStateControl.instances()) {
    if (app.rendered) app.render();
  }
});

Hooks.on("deleteTile", warnManagedCanvasElementDeleted);
Hooks.on("deleteAmbientLight", warnManagedCanvasElementDeleted);
