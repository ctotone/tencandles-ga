import {
  DEFAULT_CANVAS_TEMPLATE_ID,
  SYSTEM_ID
} from "../constants.js";

import {
  SCENE_TITLE_FONT_FAMILY
} from "../fonts.js";

export const OFFICIAL_CANVAS_TEMPLATE_VERSION = 3;
export const OFFICIAL_CANVAS_FLAG = "official-canvas";

const OFFICIAL_CANVAS_TEMPLATE_PATH =
  `systems/${SYSTEM_ID}/assets/scene/official-scene.json`;

let cachedTemplate = null;

function clone(value) {
  return foundry.utils.deepClone(value);
}

/**
 * Charge le modèle JSON autonome du canevas officiel.
 */
export async function loadOfficialCanvasTemplate() {
  if (cachedTemplate) return clone(cachedTemplate);

  const response = await fetch(
    OFFICIAL_CANVAS_TEMPLATE_PATH,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      game.i18n.format(
        "ETC.Canvas.TemplateLoadFailed",
        {
          status: response.status
        }
      )
    );
  }

  cachedTemplate = await response.json();
  return clone(cachedTemplate);
}

/**
 * Prépare le modèle avant sa création comme document Scene de monde.
 */
export async function prepareOfficialCanvasSceneData({
  gameId = null
} = {}) {
  const sceneData = await loadOfficialCanvasTemplate();

  delete sceneData._id;
  delete sceneData._stats;
  delete sceneData.active;
  delete sceneData.folder;
  delete sceneData.navOrder;
  delete sceneData.sort;

  sceneData.name = game.i18n.localize(
    "ETC.Canvas.OfficialSceneName"
  );
  sceneData.navigation = true;
  sceneData.active = false;
  sceneData.folder = null;
  sceneData.ownership = {
    default: 0
  };

  sceneData.flags ??= {};
  sceneData.flags[SYSTEM_ID] = {
    template: OFFICIAL_CANVAS_FLAG,
    templateId: DEFAULT_CANVAS_TEMPLATE_ID,
    templateVersion: OFFICIAL_CANVAS_TEMPLATE_VERSION,
    gameId
  };

  for (const drawing of sceneData.drawings ?? []) {
    drawing.author = game.user.id;

    if (
      drawing.flags?.[SYSTEM_ID]?.role ===
      "scene-title"
    ) {
      drawing.fontFamily =
        SCENE_TITLE_FONT_FAMILY;
    }
  }

  return sceneData;
}
