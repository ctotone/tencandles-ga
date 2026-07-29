/**
 * Synchronisation visuelle du canevas officiel.
 *
 * L'état collectif reste l'unique source de vérité. Une erreur visuelle ne
 * doit jamais empêcher la sauvegarde mécanique d'un conflit.
 */

import {
  SYSTEM_ID,
  TOTAL_CANDLES
} from "../constants.js";

import {
  getCollectiveState,
  isActiveGM
} from "../state/game-state.js";

function getSystemFlag(document, key) {
  return (
    document.getFlag?.(SYSTEM_ID, key)
    ?? document.flags?.[SYSTEM_ID]?.[key]
    ?? null
  );
}

function findIndexedDocuments(
  documents,
  {
    role,
    namePattern
  }
) {
  const indexed = new Map();

  for (const document of documents) {
    const roleFlag = getSystemFlag(document, "role");
    const indexFlag = Number(
      getSystemFlag(document, "index")
    );

    if (
      roleFlag === role
      && Number.isInteger(indexFlag)
      && indexFlag >= 1
      && indexFlag <= TOTAL_CANDLES
    ) {
      indexed.set(indexFlag, document);
      continue;
    }

    const match = namePattern.exec(
      String(document.name ?? "").trim()
    );

    if (!match) continue;

    const index = Number(match[1]);
    if (
      Number.isInteger(index)
      && index >= 1
      && index <= TOTAL_CANDLES
      && !indexed.has(index)
    ) {
      indexed.set(index, document);
    }
  }

  return indexed;
}

function buildTileUpdates(
  indexed,
  visibleCount,
  report,
  group,
  { forceLocked = false } = {}
) {
  const updates = [];

  for (let index = 1; index <= TOTAL_CANDLES; index += 1) {
    const document = indexed.get(index);

    if (!document) {
      report.missing.push(`${group} ${index}`);
      continue;
    }

    report.found += 1;

    const shouldBeVisible = index <= visibleCount;
    const targetAlpha = shouldBeVisible ? 1 : 0;
    const currentAlpha = Number(document.alpha ?? 1);
    const currentHidden = Boolean(document.hidden);
    const currentLocked = Boolean(document.locked);
    const targetLocked = forceLocked ? true : currentLocked;

    if (
      currentAlpha === targetAlpha
      && currentHidden === false
      && currentLocked === targetLocked
    ) {
      report.unchanged += 1;
      continue;
    }

    updates.push({
      _id: document.id,
      alpha: targetAlpha,
      hidden: false,
      ...(forceLocked ? { locked: true } : {})
    });
  }

  return updates;
}

function buildLightUpdates(indexed, visibleCount, report) {
  const updates = [];

  for (let index = 1; index <= TOTAL_CANDLES; index += 1) {
    const document = indexed.get(index);

    if (!document) {
      report.missing.push(`candle-light ${index}`);
      continue;
    }

    report.found += 1;

    const targetHidden = index > visibleCount;
    const currentHidden = Boolean(document.hidden);

    if (currentHidden === targetHidden) {
      report.unchanged += 1;
      continue;
    }

    updates.push({
      _id: document.id,
      hidden: targetHidden
    });
  }

  return updates;
}

/**
 * Synchronise les flammes, lumières et dés à partir de l'état collectif.
 */
export async function syncOfficialCanvas(
  rawState = getCollectiveState(),
  {
    notify = false,
    scene = null
  } = {}
) {
  if (!isActiveGM()) return null;

  const state = foundry.utils.deepClone(rawState);
  const officialScene =
    scene
    ?? (
      state.activeSceneId
        ? game.scenes.get(state.activeSceneId)
        : null
    );

  if (!officialScene) {
    const report = {
      sceneId: state.activeSceneId ?? null,
      found: 0,
      updated: 0,
      unchanged: 0,
      missing: ["official-scene"],
      errors: []
    };

    if (notify) {
      ui.notifications.warn(
        game.i18n.localize(
          "ETC.Canvas.SceneMissing"
        )
      );
    }

    return report;
  }

  const report = {
    sceneId: officialScene.id,
    found: 0,
    updated: 0,
    unchanged: 0,
    missing: [],
    errors: []
  };

  try {
    const tiles = [...officialScene.tiles];
    const lights = [...officialScene.lights];

    const candleFlames = findIndexedDocuments(
      tiles,
      {
        role: "candle-flame",
        namePattern: /^Flamme\s+(\d+)$/i
      }
    );

    const blueDice = findIndexedDocuments(
      tiles,
      {
        role: "blue-die",
        namePattern: /^D bleu\s+(\d+)$/i
      }
    );

    const redDice = findIndexedDocuments(
      tiles,
      {
        role: "red-die",
        namePattern: /^D rouge\s+(\d+)$/i
      }
    );

    const candleLights = findIndexedDocuments(
      lights,
      {
        role: "candle-light",
        namePattern: /^Lumière\s+(\d+)$/i
      }
    );

    const redPoolSize = Math.max(
      0,
      TOTAL_CANDLES - Number(state.litCandles)
    );

    const tileUpdates = [
      ...buildTileUpdates(
        candleFlames,
        Number(state.litCandles),
        report,
        "candle-flame",
        { forceLocked: true }
      ),
      ...buildTileUpdates(
        blueDice,
        Number(state.bluePoolRemaining),
        report,
        "blue-die"
      ),
      ...buildTileUpdates(
        redDice,
        redPoolSize,
        report,
        "red-die"
      )
    ];

    const lightUpdates = buildLightUpdates(
      candleLights,
      Number(state.litCandles),
      report
    );

    const render = canvas.scene?.id === officialScene.id;

    if (tileUpdates.length) {
      await officialScene.updateEmbeddedDocuments(
        "Tile",
        tileUpdates,
        {
          diff: true,
          render
        }
      );
      report.updated += tileUpdates.length;
    }

    if (lightUpdates.length) {
      await officialScene.updateEmbeddedDocuments(
        "AmbientLight",
        lightUpdates,
        {
          diff: true,
          render
        }
      );
      report.updated += lightUpdates.length;
    }
  } catch (error) {
    console.error(
      `${SYSTEM_ID} | Synchronisation du canevas impossible.`,
      error
    );

    report.errors.push(error.message);
  }

  console.info(
    `${SYSTEM_ID} | Synchronisation du canevas`,
    report
  );

  if (notify) {
    const key =
      report.errors.length || report.missing.length
        ? "ETC.Canvas.SyncPartial"
        : "ETC.Canvas.SyncSuccess";

    const message = game.i18n.format(
      key,
      {
        updated: report.updated,
        missing: report.missing.length
      }
    );

    if (report.errors.length) {
      ui.notifications.error(message);
    } else if (report.missing.length) {
      ui.notifications.warn(message);
    } else {
      ui.notifications.info(message);
    }
  }

  return report;
}

let syncQueue = Promise.resolve();

/**
 * Sérialise les synchronisations déclenchées par les changements d'état.
 */
export function queueOfficialCanvasSync(
  state = getCollectiveState(),
  options = {}
) {
  if (!isActiveGM()) return Promise.resolve(null);

  const snapshot = foundry.utils.deepClone(state);

  if (!snapshot.activeSceneId) {
    return Promise.resolve(null);
  }

  syncQueue = syncQueue
    .catch(() => null)
    .then(() => syncOfficialCanvas(snapshot, options));

  return syncQueue;
}
