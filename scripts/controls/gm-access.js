/**
 * Accès ergonomiques réservés au MJ vers la régie Ten Candles.
 */

import { SYSTEM_ID } from "../constants.js";
import { TenCandlesStateControl } from "../apps/game-state-control.js";

const ACTOR_DIRECTORY_BUTTON_ID =
  `${SYSTEM_ID}-actor-directory-state-control`;

let stateControlOpening = false;

function openGMStateControl(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!game.user?.isGM || stateControlOpening) return;

  stateControlOpening = true;

  try {
    TenCandlesStateControl.open();
  } finally {
    globalThis.setTimeout(() => {
      stateControlOpening = false;
    }, 250);
  }
}

/**
 * Ajoute un groupe Ten Candles dans les contrôles de scène.
 * Le groupe et son outil sont exclusivement visibles pour les MJ.
 */
export function registerGMStateControlSceneControl(controls) {
  if (!game.user?.isGM) return;

  const controlName = `${SYSTEM_ID}-gm`;
  if (controls[controlName]) return;

  const noteOrder = Number(controls.notes?.order);
  const targetOrder = Number.isFinite(noteOrder)
    ? noteOrder + 1
    : Math.max(
        0,
        ...Object.values(controls).map((control) => {
          const order = Number(control?.order);
          return Number.isFinite(order) ? order : 0;
        })
      ) + 1;

  // Réserve une place immédiatement après les Notes lorsque ce contrôle existe.
  if (Number.isFinite(noteOrder)) {
    for (const control of Object.values(controls)) {
      const order = Number(control?.order);
      if (Number.isFinite(order) && order > noteOrder) {
        control.order = order + 1;
      }
    }
  }

  const toolName = `${SYSTEM_ID}-open-state-control`;

  controls[controlName] = {
    name: controlName,
    title: game.i18n.localize("ETC.GMAccess.SceneControlTitle"),
    icon: "fa-solid fa-fire-flame-curved",
    order: targetOrder,
    visible: true,
    tools: {
      [toolName]: {
        name: toolName,
        title: game.i18n.localize("ETC.GMAccess.OpenStateControl"),
        icon: "fa-solid fa-gear",
        order: 0,
        button: true,
        visible: true,
        onChange: openGMStateControl
      }
    }
  };
}

function resolveActorDirectoryElement(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  if (Array.isArray(element) && element[0] instanceof HTMLElement) {
    return element[0];
  }

  return null;
}

/**
 * Ajoute un bouton rectangulaire au-dessus de la liste des Actors.
 */
export function mountGMStateControlActorDirectoryButton(
  application,
  element
) {
  if (!game.user?.isGM) return;

  const root = resolveActorDirectoryElement(element);
  if (!root) return;

  // Sécurité supplémentaire si le hook générique était déclenché pour
  // une autre application que le véritable ActorDirectory.
  const isActorDirectory =
    application?.constructor?.name === "ActorDirectory"
    || application?.tabName === "actors"
    || application?.options?.documentName === "Actor";

  if (!isActorDirectory) return;
  if (root.querySelector(`#${ACTOR_DIRECTORY_BUTTON_ID}`)) return;

  const directoryList = root.matches?.(".directory-list")
    ? root
    : root.querySelector(".directory-list");

  if (!directoryList?.parentElement) return;

  const wrapper = document.createElement("div");
  wrapper.id = ACTOR_DIRECTORY_BUTTON_ID;
  wrapper.className = "ets-actor-directory-gm-access";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ets-actor-directory-gm-access__button";
  button.title = game.i18n.localize(
    "ETC.GMAccess.ActorDirectoryHint"
  );
  button.setAttribute(
    "aria-label",
    game.i18n.localize("ETC.GMAccess.OpenStateControl")
  );
  button.innerHTML = [
    '<i class="fa-solid fa-gear" aria-hidden="true"></i>',
    `<span>${game.i18n.localize(
      "ETC.GMAccess.ActorDirectoryButton"
    )}</span>`
  ].join("");

  button.addEventListener("click", openGMStateControl);
  wrapper.append(button);
  directoryList.before(wrapper);
}
