/**
 * Cycle de vie d'une partie Ten Candles depuis la régie MJ.
 */

import {
  GAME_STAGES,
  PRESENTATION_MODES
} from "../constants.js";

import {
  archiveAssociatedOfficialCanvas,
  createOfficialCanvas
} from "../canvas/installer.js";

import {
  createNewGameMessage,
  interruptBallOfTruthsMessage,
  updateResolutionMessage
} from "../conflict/chat.js";

import {
  interruptInstantRequests
} from "../instant/manager.js";

import {
  cancelActiveResolution
} from "../conflict/resolution.js";

import {
  createInitialCollectiveState,
  getCollectiveState,
  isActiveGM,
  saveCollectiveState
} from "../state/game-state.js";

import {
  clone
} from "../utils.js";

import {
  tryLockPartyLifecycle,
  unlockPartyLifecycle
} from "./party-lock.js";

const NEW_GAME_LOCK_OWNER = "new-game";
let newGamePromise = null;

export async function createNewGame() {
  if (!isActiveGM()) {
    throw new Error(
      game.i18n.localize("ETC.Notifications.ActiveGMOnly")
    );
  }

  if (newGamePromise) return newGamePromise;

  if (!tryLockPartyLifecycle(NEW_GAME_LOCK_OWNER)) {
    throw new Error(
      game.i18n.localize(
        "ETC.Notifications.PartyActionBusy"
      )
    );
  }

  newGamePromise = (async () => {
    const endedAt = Date.now();
    const previousState = getCollectiveState();
    const previousNarrationResolution =
      previousState.lastResolution?.finalSuccess === true
        ? clone(previousState.lastResolution)
        : null;

    if (previousState.activeResolution) {
      const cancelled = await cancelActiveResolution({
        requestedResolutionId:
          previousState.activeResolution.id,
        publishInstantRequests: false
      });

      if (!cancelled) {
        throw new Error(
          game.i18n.localize(
            "ETC.NewGame.ActiveResolutionCancellationFailed"
          )
        );
      }
    } else if (
      previousState.stage === GAME_STAGES.BALL_OF_TRUTHS &&
      previousState.lastResolution
    ) {
      try {
        await interruptBallOfTruthsMessage(
          clone(previousState.lastResolution),
          previousState.lastResolution.ballMessageId
        );
      } catch (error) {
        console.error(
          "tencandles-ga | Interruption visuelle du Bal impossible.",
          error
        );
      }
    }

    if ((previousState.instantRequests ?? []).length > 0) {
      try {
        await interruptInstantRequests(previousState);
      } catch (error) {
        console.error(
          "tencandles-ga | Interruption visuelle des Instants impossible.",
          error
        );
      }
    }

    const archivedScene =
      await archiveAssociatedOfficialCanvas(
        previousState,
        { endedAt }
      );

    const nextState = {
      ...createInitialCollectiveState(),
      presentationMode: previousState.presentationMode,
      canvasTemplateId:
        previousState.canvasTemplateId,
      activeSceneId: null
    };

    await saveCollectiveState(nextState);

    // Toute ancienne option de reprise de narration doit disparaître des cartes.
    if (previousNarrationResolution?.chatMessageId) {
      try {
        await updateResolutionMessage(
          previousNarrationResolution
        );
      } catch (error) {
        console.error(
          "tencandles-ga | Expiration d'une ancienne carte impossible.",
          error
        );
      }
    }

    let createdScene = null;
    let canvasCreationFailed = false;

    if (
      previousState.presentationMode ===
      PRESENTATION_MODES.OFFICIAL
    ) {
      try {
        createdScene = await createOfficialCanvas({
          activate: true,
          notify: false
        });
      } catch (error) {
        canvasCreationFailed = true;
        console.error(
          "tencandles-ga | Création du nouveau canevas impossible.",
          error
        );

        ui.notifications.warn(
          game.i18n.localize(
            "ETC.NewGame.CanvasCreationFailed"
          )
        );
      }
    }

    const finalState = getCollectiveState();

    try {
      await createNewGameMessage(finalState);
    } catch (error) {
      console.error(
        "tencandles-ga | Annonce de nouvelle partie impossible.",
        error
      );

      ui.notifications.warn(
        game.i18n.localize(
          "ETC.NewGame.ChatAnnouncementFailed"
        )
      );
    }

    ui.notifications.info(
      game.i18n.localize(
        "ETC.NewGame.Created"
      )
    );

    return {
      state: finalState,
      archivedScene,
      createdScene,
      canvasCreationFailed
    };
  })().finally(() => {
    newGamePromise = null;
    unlockPartyLifecycle(NEW_GAME_LOCK_OWNER);
  });

  return newGamePromise;
}
