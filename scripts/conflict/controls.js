/**
 * Bouton flottant et outil Tokens pour lancer le pool joueur.
 */

import {
  GAME_STAGES,
  SYSTEM_ID
} from "../constants.js";

import {
  getCollectiveState
} from "../state/game-state.js";

import {
  requestPlayerRoll
} from "./socket.js";

const FLOATING_ROLL_BUTTON_ID =
  `${SYSTEM_ID}-floating-roll`;

let floatingRollBusy = false;
let sceneControlRollBusy = false;

async function triggerPlayerRollFromSceneControl(event) {
  event?.preventDefault?.();

  if (sceneControlRollBusy) return;

  sceneControlRollBusy = true;

  try {
    await requestPlayerRoll();
  } finally {
    window.setTimeout(() => {
      sceneControlRollBusy = false;
    }, 650);
  }
}

function getRollButtonState() {
  const activeGM = game.users.activeGM;
  const state = getCollectiveState();

  if (floatingRollBusy) {
    return {
      disabled: true,
      title: game.i18n.localize(
        "ETC.Controls.Busy"
      )
    };
  }

  if (!activeGM) {
    return {
      disabled: true,
      title: game.i18n.localize(
        "ETC.Controls.NoActiveGM"
      )
    };
  }

  if (state.activeResolution) {
    return {
      disabled: true,
      title: game.i18n.localize(
        "ETC.Controls.ConflictActive"
      )
    };
  }

  if (state.stage !== GAME_STAGES.SCENE) {
    return {
      disabled: true,
      title: game.i18n.localize(
        "ETC.Controls.BallActive"
      )
    };
  }

  if (state.bluePoolRemaining <= 0) {
    return {
      disabled: true,
      title: game.i18n.localize(
        "ETC.Controls.NoPlayerDice"
      )
    };
  }

  return {
    disabled: false,
    title: game.i18n.localize(
      "ETC.Controls.StartConflict"
    )
  };
}

export function refreshPlayerRollControls() {
  const button = document.getElementById(
    FLOATING_ROLL_BUTTON_ID
  );

  if (!button) return;

  const state = getRollButtonState();

  button.disabled = state.disabled;
  button.title = state.title;
  button.setAttribute(
    "aria-label",
    state.title
  );
  button.setAttribute(
    "aria-busy",
    floatingRollBusy ? "true" : "false"
  );
  button.classList.toggle(
    "ets-floating-roll--busy",
    floatingRollBusy
  );
}

export function mountFloatingPlayerRollButton() {
  let button = document.getElementById(
    FLOATING_ROLL_BUTTON_ID
  );

  if (!button) {
    button = document.createElement("button");
    button.id = FLOATING_ROLL_BUTTON_ID;
    button.type = "button";
    button.className = "ets-floating-roll";
    button.innerHTML = `
      <i class="fa-solid fa-dice-d6" aria-hidden="true"></i>
      <span>${game.i18n.localize(
        "ETC.Controls.RollDice"
      )}</span>
    `;

    button.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        if (
          button.disabled ||
          floatingRollBusy
        ) {
          return;
        }

        floatingRollBusy = true;
        refreshPlayerRollControls();

        try {
          await requestPlayerRoll();
        } finally {
          window.setTimeout(() => {
            floatingRollBusy = false;
            refreshPlayerRollControls();
          }, 650);
        }
      }
    );

    document.body.append(button);
  }

  refreshPlayerRollControls();
}

export function registerPlayerRollSceneControl(
  controls
) {
  const tokenControl = controls.tokens;

  if (!tokenControl?.tools) {
    console.warn(
      `${SYSTEM_ID} | Contrôles Tokens introuvables.`
    );
    return;
  }

  tokenControl.tools[
    "tencandles-ga-player-roll"
  ] = {
    name: "tencandles-ga-player-roll",
    title: game.i18n.localize(
      "ETC.Controls.PlayerRoll"
    ),
    icon: "fa-solid fa-dice-d6",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: true,

    // Callback documenté pour les SceneControlTool de Foundry V14.
    onChange: triggerPlayerRollFromSceneControl,

    // Compatibilité avec le chemin de clic immédiat accepté par le core.
    // Le verrou ci-dessus empêche un double jet si les deux callbacks sont émis.
    onClick: triggerPlayerRollFromSceneControl
  };
}
