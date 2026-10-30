import {
  DEFAULT_CANVAS_TEMPLATE_ID,
  CANVAS_THEMES,
  SYSTEM_ID
} from "../constants.js";

export const OFFICIAL_CANVAS_TEMPLATE_VERSION = 3;
export const OFFICIAL_CANVAS_FLAG = "official-canvas";

const CANVAS_TEMPLATE_PATHS = Object.freeze({
  [CANVAS_THEMES.CLASSIC]: `systems/${SYSTEM_ID}/assets/scene/official-scene.json`,
  [CANVAS_THEMES.POST_APO]: `systems/${SYSTEM_ID}/assets/scene/post-apo-scene.json`,
  [CANVAS_THEMES.FUTUR]: `systems/${SYSTEM_ID}/assets/scene/futur-scene.json`,
  [CANVAS_THEMES.FORET_ENFANT]: `systems/${SYSTEM_ID}/assets/scene/foret-enfant-scene.json`,
  [CANVAS_THEMES.MEDIEVAL]: `systems/${SYSTEM_ID}/assets/scene/medieval-scene.json`,
  [CANVAS_THEMES.LOVECRAFT]: `systems/${SYSTEM_ID}/assets/scene/lovecraft-scene.json`,
  [CANVAS_THEMES.MAGIE]: `systems/${SYSTEM_ID}/assets/scene/magie-scene.json`,
  [CANVAS_THEMES.WESTERN]: `systems/${SYSTEM_ID}/assets/scene/western-scene.json`,
  [CANVAS_THEMES.HALLOWEEN]: `systems/${SYSTEM_ID}/assets/scene/halloween-scene.json`
});

const cachedTemplates = new Map();

function clone(value) {
  return foundry.utils.deepClone(value);
}

/**
 * Charge le modèle JSON autonome du canevas officiel.
 */
export async function loadOfficialCanvasTemplate(theme = CANVAS_THEMES.CLASSIC) {
  if (!Object.hasOwn(CANVAS_TEMPLATE_PATHS, theme)) throw new Error("Invalid canvas theme");
  if (cachedTemplates.has(theme)) return clone(cachedTemplates.get(theme));

  const response = await fetch(
    CANVAS_TEMPLATE_PATHS[theme],
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

  const data = await response.json();
  cachedTemplates.set(theme, data);
  return clone(data);
}

/**
 * Prépare le modèle avant sa création comme document Scene de monde.
 */
export async function prepareOfficialCanvasSceneData({
  gameId = null,
  theme = CANVAS_THEMES.CLASSIC
} = {}) {
  const sceneData = await loadOfficialCanvasTemplate(theme);

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
    themeId: theme,
    gameId
  };

  for (const drawing of sceneData.drawings ?? []) {
    drawing.author = game.user.id;
    // La police du titre appartient désormais au modèle visuel du thème.
  }

  return sceneData;
}
