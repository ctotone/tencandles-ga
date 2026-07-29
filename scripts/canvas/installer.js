/**
 * Création, association et réparation du canevas officiel.
 */

import {
  DEFAULT_CANVAS_TEMPLATE_ID,
  PRESENTATION_MODES,
  SYSTEM_ID
} from "../constants.js";

import {
  getCollectiveState,
  isActiveGM,
  saveCollectiveState
} from "../state/game-state.js";

import {
  OFFICIAL_CANVAS_FLAG,
  OFFICIAL_CANVAS_TEMPLATE_VERSION,
  prepareOfficialCanvasSceneData
} from "./template.js";

import {
  syncOfficialCanvas
} from "./sync.js";

let installerPromise = null;
let missingSceneWarningShown = false;

function getSystemFlag(document, key) {
  return (
    document.getFlag?.(SYSTEM_ID, key)
    ?? document.flags?.[SYSTEM_ID]?.[key]
    ?? null
  );
}

function getNamespacedFlag(document, namespace, key) {
  // Une migration peut devoir lire les flags d'un module désactivé.
  // document.getFlag valide le namespace et lève alors une erreur.
  // La lecture directe des données brutes reste sûre et suffisante ici.
  return document?.flags?.[namespace]?.[key] ?? null;
}

function isLegacyOfficialCanvasScene(scene) {
  return Boolean(
    scene
    && !getSystemFlag(scene, "archived")
    && getNamespacedFlag(
      scene,
      "evil-tencandles-roll",
      "template"
    ) === OFFICIAL_CANVAS_FLAG
    && getNamespacedFlag(
      scene,
      "evil-tencandles-roll",
      "templateId"
    ) === "le-monde-est-sombre"
  );
}


function getLegacyOfficialCanvasScenes() {
  return game.scenes.filter(
    isLegacyOfficialCanvasScene
  );
}


function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function chooseLegacyCanvasAction(
  legacyScenes
) {
  const DialogV2 =
    foundry.applications.api.DialogV2;

  if (!DialogV2?.wait) {
    return "adopt";
  }

  const primaryScene = legacyScenes[0];
  const sceneName = escapeHTML(
    primaryScene?.name ?? ""
  );

  return DialogV2.wait({
    window: {
      title: game.i18n.localize(
        "ETC.Canvas.LegacyChoiceTitle"
      )
    },
    content: [
      '<div class="ets-dialog ets-legacy-canvas-dialog">',
      `<p>${game.i18n.format(
        "ETC.Canvas.LegacyChoiceBody",
        {
          name: sceneName,
          count: legacyScenes.length
        }
      )}</p>`,
      `<p>${game.i18n.localize(
        "ETC.Canvas.LegacyChoiceHelp"
      )}</p>`,
      "</div>"
    ].join(""),
    buttons: [
      {
        action: "adopt",
        label: game.i18n.localize(
          "ETC.Canvas.LegacyChoiceAdopt"
        ),
        icon: "fa-solid fa-link",
        default: true,
        callback: () => "adopt"
      },
      {
        action: "create",
        label: game.i18n.localize(
          "ETC.Canvas.LegacyChoiceCreate"
        ),
        icon: "fa-solid fa-plus",
        callback: () => "create"
      },
      {
        action: "personal",
        label: game.i18n.localize(
          "ETC.Canvas.LegacyChoicePersonal"
        ),
        icon: "fa-solid fa-display",
        callback: () => "personal"
      }
    ],
    close: () => "cancel"
  });
}

async function adoptLegacyOfficialCanvas(
  legacyScene,
  state
) {
  await legacyScene.update({
    [`flags.${SYSTEM_ID}.template`]:
      OFFICIAL_CANVAS_FLAG,
    [`flags.${SYSTEM_ID}.templateId`]:
      DEFAULT_CANVAS_TEMPLATE_ID,
    [`flags.${SYSTEM_ID}.templateVersion`]:
      OFFICIAL_CANVAS_TEMPLATE_VERSION,
    [`flags.${SYSTEM_ID}.gameId`]:
      state.gameId
  });

  await associateSceneWithState(legacyScene);

  const repaired = await repairOfficialCanvas({
    activate: false,
    notify: false
  });

  ui.notifications.info(
    game.i18n.localize(
      "ETC.Canvas.LegacySceneAdopted"
    )
  );

  return repaired;
}

export function isOfficialCanvasScene(
  scene,
  { includeArchived = false } = {}
) {
  const matchesTemplate = Boolean(
    scene
    && getSystemFlag(scene, "template") === OFFICIAL_CANVAS_FLAG
    && getSystemFlag(scene, "templateId") === DEFAULT_CANVAS_TEMPLATE_ID
  );

  if (!matchesTemplate) return false;
  if (includeArchived) return true;

  return !Boolean(getSystemFlag(scene, "archived"));
}

export function getOfficialCanvasScenes() {
  return game.scenes.filter((scene) =>
    isOfficialCanvasScene(scene)
  );
}

function formatArchiveTimestamp(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");

  return [
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  ].join(" ");
}

function getUniqueArchiveSceneName(timestamp, sceneId) {
  const baseName = game.i18n.format(
    "ETC.Canvas.ArchivedSceneName",
    { date: formatArchiveTimestamp(timestamp) }
  );

  const usedNames = new Set(
    game.scenes
      .filter((scene) => scene.id !== sceneId)
      .map((scene) => scene.name)
  );

  if (!usedNames.has(baseName)) return baseName;

  let suffix = 2;
  while (usedNames.has(`${baseName} (${suffix})`)) {
    suffix += 1;
  }

  return `${baseName} (${suffix})`;
}

export async function archiveAssociatedOfficialCanvas(
  state = getCollectiveState(),
  { endedAt = Date.now() } = {}
) {
  if (!isActiveGM()) return null;
  if (!state?.activeSceneId) return null;

  const scene = game.scenes.get(state.activeSceneId);
  if (!isOfficialCanvasScene(scene)) return null;

  const archivedName = getUniqueArchiveSceneName(
    endedAt,
    scene.id
  );

  await scene.update({
    name: archivedName,
    navigation: false,
    [`flags.${SYSTEM_ID}.archived`]: true,
    [`flags.${SYSTEM_ID}.archivedAt`]: endedAt,
    [`flags.${SYSTEM_ID}.archivedGameId`]:
      state.gameId ?? null
  });

  return scene;
}

function needsOfficialCanvasTemplateUpgrade(scene) {
  const currentVersion = Number(
    getSystemFlag(scene, "templateVersion") ?? 0
  );

  return (
    !Number.isFinite(currentVersion)
    || currentVersion <
      OFFICIAL_CANVAS_TEMPLATE_VERSION
  );
}

export function getAssociatedOfficialCanvas(
  state = getCollectiveState()
) {
  if (!state.activeSceneId) return null;

  const scene = game.scenes.get(state.activeSceneId);
  return isOfficialCanvasScene(scene) ? scene : null;
}

function runSerializedInstaller(task) {
  if (installerPromise) return installerPromise;

  installerPromise = Promise.resolve()
    .then(task)
    .finally(() => {
      installerPromise = null;
    });

  return installerPromise;
}

async function associateSceneWithState(scene) {
  const state = getCollectiveState();

  if (
    state.activeSceneId === scene.id
    && state.canvasTemplateId === DEFAULT_CANVAS_TEMPLATE_ID
  ) {
    return state;
  }

  return saveCollectiveState({
    ...state,
    activeSceneId: scene.id,
    canvasTemplateId: DEFAULT_CANVAS_TEMPLATE_ID
  });
}

async function activateAndViewScene(scene) {
  const activated = await scene.activate({
    pullUsers: true,
    updateData: {
      navigation: true
    }
  });

  // L'activation avec pullUsers déclenche déjà le changement de scène pour
  // l'ensemble des utilisateurs. Un appel immédiat à view() demanderait au MJ
  // un second changement pendant le chargement des ressources du canevas.
  return game.scenes.get(activated.id) ?? activated;
}

async function createOfficialCanvasInternal({
  activate = false,
  notify = true
} = {}) {
  const state = getCollectiveState();
  const sceneData = await prepareOfficialCanvasSceneData({
    gameId: state.gameId
  });

  const scene = await foundry.documents.Scene.create(
    sceneData,
    {
      renderSheet: false,
      keepEmbeddedIds: true
    }
  );

  if (!scene) {
    throw new Error(
      game.i18n.localize(
        "ETC.Canvas.SceneCreationFailed"
      )
    );
  }

  await associateSceneWithState(scene);
  await syncOfficialCanvas(
    getCollectiveState(),
    {
      notify: false,
      scene
    }
  );

  const finalScene = activate
    ? await activateAndViewScene(scene)
    : scene;

  if (notify) {
    ui.notifications.info(
      game.i18n.format(
        "ETC.Canvas.SceneCreated",
        {
          name: finalScene.name
        }
      )
    );
  }

  return finalScene;
}

export async function createOfficialCanvas(options = {}) {
  if (!isActiveGM()) return null;

  return runSerializedInstaller(
    () => createOfficialCanvasInternal(options)
  );
}

function getRoleIndex(document) {
  const role =
    getSystemFlag(document, "role")
    ?? getNamespacedFlag(
      document,
      "evil-tencandles-roll",
      "role"
    );

  const index = Number(
    getSystemFlag(document, "index")
    ?? getNamespacedFlag(
      document,
      "evil-tencandles-roll",
      "index"
    )
  );

  return {
    role,
    index: Number.isInteger(index) ? index : null
  };
}

function indexByRole(documents) {
  const map = new Map();

  for (const document of documents) {
    const { role, index } = getRoleIndex(document);
    if (!role || !index) continue;
    map.set(`${role}:${index}`, document);
  }

  return map;
}

function prepareEmbeddedUpdate(templateData, existingId) {
  const update = foundry.utils.deepClone(templateData);
  update._id = existingId;
  delete update._stats;
  return update;
}

function prepareEmbeddedCreate(templateData, {
  keepId = false
} = {}) {
  const create = foundry.utils.deepClone(templateData);
  delete create._stats;
  if (!keepId) delete create._id;
  return create;
}

async function repairEmbeddedCollection(
  scene,
  {
    documentName,
    existingDocuments,
    templateDocuments,
    keepIdsForMissing = false
  }
) {
  const existing = indexByRole(existingDocuments);
  const updates = [];
  const creates = [];

  for (const templateData of templateDocuments) {
    const role = templateData.flags?.[SYSTEM_ID]?.role;
    const index = Number(
      templateData.flags?.[SYSTEM_ID]?.index
    );

    if (!role || !Number.isInteger(index)) continue;

    const current =
      existing.get(`${role}:${index}`)
      ?? existingDocuments.find(
        (document) => document.id === templateData._id
      )
      ?? null;

    if (current) {
      updates.push(
        prepareEmbeddedUpdate(
          templateData,
          current.id
        )
      );
    } else {
      creates.push(
        prepareEmbeddedCreate(
          templateData,
          {
            keepId: keepIdsForMissing
          }
        )
      );
    }
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments(
      documentName,
      updates,
      {
        diff: true,
        render: canvas.scene?.id === scene.id
      }
    );
  }

  if (creates.length) {
    await scene.createEmbeddedDocuments(
      documentName,
      creates,
      {
        keepId: keepIdsForMissing,
        render: canvas.scene?.id === scene.id
      }
    );
  }

  return {
    updated: updates.length,
    created: creates.length
  };
}

export async function repairOfficialCanvas({
  activate = false,
  notify = true
} = {}) {
  if (!isActiveGM()) return null;

  return runSerializedInstaller(async () => {
    const state = getCollectiveState();
    let scene = getAssociatedOfficialCanvas(state);

    if (!scene) {
      scene = await createOfficialCanvasInternal({
        activate,
        notify
      });
      return scene;
    }

    const template = await prepareOfficialCanvasSceneData({
      gameId: state.gameId
    });

    await scene.update({
      name: template.name,
      navigation: true,
      thumb: template.thumb,
      width: template.width,
      height: template.height,
      padding: template.padding,
      shiftX: template.shiftX,
      shiftY: template.shiftY,
      initial: template.initial,
      initialLevel: template.initialLevel,
      grid: template.grid,
      tokenVision: template.tokenVision,
      fog: template.fog,
      environment: template.environment,
      transition: template.transition,
      flags: template.flags
    }, {
      diff: true,
      render: canvas.scene?.id === scene.id
    });

    const reports = [];

    reports.push(
      await repairEmbeddedCollection(
        scene,
        {
          documentName: "Level",
          existingDocuments: [...scene.levels],
          templateDocuments: template.levels ?? [],
          keepIdsForMissing: true
        }
      )
    );

    reports.push(
      await repairEmbeddedCollection(
        scene,
        {
          documentName: "Drawing",
          existingDocuments: [...scene.drawings],
          templateDocuments: template.drawings ?? []
        }
      )
    );

    reports.push(
      await repairEmbeddedCollection(
        scene,
        {
          documentName: "AmbientLight",
          existingDocuments: [...scene.lights],
          templateDocuments: template.lights ?? []
        }
      )
    );

    reports.push(
      await repairEmbeddedCollection(
        scene,
        {
          documentName: "Tile",
          existingDocuments: [...scene.tiles],
          templateDocuments: template.tiles ?? []
        }
      )
    );

    scene = game.scenes.get(scene.id) ?? scene;

    await associateSceneWithState(scene);
    await syncOfficialCanvas(
      getCollectiveState(),
      {
        notify: false,
        scene
      }
    );

    if (activate) {
      scene = await activateAndViewScene(scene);
    }

    if (notify) {
      const updated = reports.reduce(
        (sum, report) => sum + report.updated,
        0
      );
      const created = reports.reduce(
        (sum, report) => sum + report.created,
        0
      );

      ui.notifications.info(
        game.i18n.format(
          "ETC.Canvas.SceneRepaired",
          {
            updated,
            created
          }
        )
      );
    }

    return scene;
  });
}

export async function viewOfficialCanvas() {
  const scene = getAssociatedOfficialCanvas();

  if (!scene) {
    ui.notifications.warn(
      game.i18n.localize(
        "ETC.Canvas.SceneMissing"
      )
    );
    return null;
  }

  await scene.view();
  return scene;
}

/**
 * Première installation lors de l'ouverture complète du monde.
 *
 * Une scène supprimée après association n'est jamais recréée automatiquement :
 * le MJ doit utiliser l'action explicite de réparation.
 */
export async function initializeOfficialCanvas() {
  if (!isActiveGM()) return null;

  const state = getCollectiveState();

  if (
    state.presentationMode ===
    PRESENTATION_MODES.PERSONAL
  ) {
    const personalCanvas =
      getAssociatedOfficialCanvas(state);

    if (personalCanvas) {
      if (needsOfficialCanvasTemplateUpgrade(personalCanvas)) {
        return repairOfficialCanvas({
          activate: false,
          notify: false
        });
      }

      await syncOfficialCanvas(state, {
        notify: false,
        scene: personalCanvas
      });

      return personalCanvas;
    }

    if (state.activeSceneId) {
      await saveCollectiveState({
        ...state,
        activeSceneId: null
      });
    }

    return null;
  }

  const associated = getAssociatedOfficialCanvas(state);

  if (associated) {
    if (needsOfficialCanvasTemplateUpgrade(associated)) {
      return repairOfficialCanvas({
        activate: false,
        notify: false
      });
    }

    const report = await syncOfficialCanvas(state, {
      notify: false,
      scene: associated
    });

    if (report?.missing?.length) {
      ui.notifications.warn(
        game.i18n.localize(
          "ETC.Canvas.ElementsMissingRepair"
        )
      );
    }

    return associated;
  }

  if (state.activeSceneId) {
    if (!missingSceneWarningShown) {
      missingSceneWarningShown = true;
      ui.notifications.warn(
        game.i18n.localize(
          "ETC.Canvas.SceneMissingRepair"
        )
      );
    }
    return null;
  }

  const existingScenes = getOfficialCanvasScenes();

  if (existingScenes.length) {
    const scene = existingScenes[0];

    await associateSceneWithState(scene);

    if (needsOfficialCanvasTemplateUpgrade(scene)) {
      await repairOfficialCanvas({
        activate: false,
        notify: false
      });
    } else {
      await syncOfficialCanvas(
        getCollectiveState(),
        {
          notify: false,
          scene
        }
      );
    }

    if (existingScenes.length > 1) {
      ui.notifications.warn(
        game.i18n.localize(
          "ETC.Canvas.MultipleOfficialScenes"
        )
      );
    }

    return scene;
  }

  const legacyScenes =
    getLegacyOfficialCanvasScenes();

  if (legacyScenes.length) {
    const choice =
      await chooseLegacyCanvasAction(
        legacyScenes
      );

    if (choice === "adopt") {
      return adoptLegacyOfficialCanvas(
        legacyScenes[0],
        state
      );
    }

    if (choice === "create") {
      return createOfficialCanvas({
        activate: !game.scenes.active,
        notify: true
      });
    }

    if (choice === "personal") {
      await saveCollectiveState({
        ...state,
        presentationMode:
          PRESENTATION_MODES.PERSONAL
      });

      ui.notifications.info(
        game.i18n.localize(
          "ETC.Presentation.ChangedPersonal"
        )
      );

      return null;
    }

    ui.notifications.warn(
      game.i18n.localize(
        "ETC.Canvas.LegacyChoiceCancelled"
      )
    );

    return null;
  }

  return createOfficialCanvas({
    activate: !game.scenes.active,
    notify: true
  });
}

export function getOfficialCanvasStatus(
  state = getCollectiveState()
) {
  const scene = getAssociatedOfficialCanvas(state);

  return {
    configured: Boolean(state.activeSceneId),
    exists: Boolean(scene),
    sceneId: state.activeSceneId,
    sceneName:
      scene?.name
      ?? game.i18n.localize("ETC.Common.None"),
    templateId: state.canvasTemplateId,
    templateVersion:
      scene
        ? Number(
            getSystemFlag(scene, "templateVersion")
            ?? OFFICIAL_CANVAS_TEMPLATE_VERSION
          )
        : OFFICIAL_CANVAS_TEMPLATE_VERSION,
    canView: Boolean(scene),
    canSync: Boolean(scene && isActiveGM()),
    canRepair: isActiveGM(),
    optional:
      state.presentationMode ===
      PRESENTATION_MODES.PERSONAL,
    statusLabel: scene
      ? game.i18n.localize("ETC.Canvas.StatusReady")
      : state.activeSceneId
        ? game.i18n.localize("ETC.Canvas.StatusMissing")
        : game.i18n.localize("ETC.Canvas.StatusNotConfigured")
  };
}
