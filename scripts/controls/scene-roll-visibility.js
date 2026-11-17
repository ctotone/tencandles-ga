/** Préférence de visibilité du bouton flottant, par scène (Foundry V14). */
import { SYSTEM_ID } from "../constants.js";
import {
  SCENE_ROLL_BUTTON_FLAG,
  isFloatingRollHiddenOnScene,
  refreshPlayerRollControls
} from "../conflict/controls.js";

function sceneFromEntry(target) {
  // Les entrées du DocumentDirectory V14 portent data-entry-id.
  const entry = target?.closest?.("[data-entry-id]") ?? target;
  return game.scenes?.get(entry?.dataset?.entryId) ?? null;
}

async function changeVisibility(event, target, hidden) {
  if (!game.user?.isGM) return;
  const scene = sceneFromEntry(target);
  if (!scene) return;

  try {
    await scene.setFlag(SYSTEM_ID, SCENE_ROLL_BUTTON_FLAG, hidden);
    refreshPlayerRollControls();
  } catch (error) {
    console.error(`${SYSTEM_ID} | Impossible de changer la visibilité du bouton de dés.`, error);
    ui.notifications?.error(game.i18n.localize("ETC.Controls.VisibilityUpdateFailed"));
  }
}

export function registerSceneRollVisibilityContextOptions(application, options) {
  if (!game.user?.isGM) return;
  if (!(application instanceof foundry.applications.sidebar.tabs.SceneDirectory)) return;

  // Deux options complémentaires : 'visible' est réévalué à l'ouverture,
  // y compris lorsque le ContextMenu réutilise sa liste d'options.
  options.push({
    label: "ETC.Controls.HideRollButton",
    icon: "fa-solid fa-eye-slash",
    visible: (target) => {
      const scene = sceneFromEntry(target);
      return !!scene && !isFloatingRollHiddenOnScene(scene);
    },
    onClick: (event, target) => changeVisibility(event, target, true)
  }, {
    label: "ETC.Controls.ShowRollButton",
    icon: "fa-solid fa-eye",
    visible: (target) => {
      const scene = sceneFromEntry(target);
      return !!scene && isFloatingRollHiddenOnScene(scene);
    },
    onClick: (event, target) => changeVisibility(event, target, false)
  });
}
