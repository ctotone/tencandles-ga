/**
 * Flammes animées du canevas officiel (Foundry v14).
 *
 * L'affectation des quatre WebM est fixe par index de bougie. Les décalages
 * sont locaux à chaque navigateur : aucune horloge réseau ni changement de
 * l'état collectif n'est nécessaire. Le thème Forêt enfant (fire_3.png)
 * et les scènes sans flammes sont volontairement exclus.
 */

import { SYSTEM_ID } from "../constants.js";

const CANDLE_PATH = `systems/${SYSTEM_ID}/assets/scene/candles/`;
// Deux ou trois bougies par animation, et des phases distinctes (secondes).
// Les vidéos fournies ont une durée de 30 secondes.
export const FLAME_ANIMATIONS = Object.freeze([
  { file: "fireloop_1.webm", offset: 0.8 },
  { file: "fireloop_2.webm", offset: 6.2 },
  { file: "fireloop_3.webm", offset: 12.8 },
  { file: "fireloop_4.webm", offset: 19.4 },
  { file: "fireloop_1.webm", offset: 13.1 },
  { file: "fireloop_2.webm", offset: 22.8 },
  { file: "fireloop_3.webm", offset: 2.7 },
  { file: "fireloop_4.webm", offset: 7.9 },
  { file: "fireloop_1.webm", offset: 25.6 },
  { file: "fireloop_2.webm", offset: 15.3 }
]);

export function flameAnimationForIndex(index) {
  return Number.isInteger(index) && index >= 1 && index <= FLAME_ANIMATIONS.length
    ? FLAME_ANIMATIONS[index - 1]
    : null;
}

export function isManagedAnimatedFlame(document) {
  const flags = document?.flags?.[SYSTEM_ID];
  const index = Number(flags?.index);
  const animation = flameAnimationForIndex(index);
  return Boolean(
    animation &&
    flags?.role === "candle-flame" &&
    document?.texture?.src === `${CANDLE_PATH}${animation.file}`
  );
}

// Chaque Tile doit posséder son propre élément vidéo : sinon deux seeks
// simultanés sur une source commune se neutraliseraient.
let sourceOwners = new Map();
let applied = new WeakMap();
let processing = new WeakSet();

async function playFlame(tile) {
  if (processing.has(tile)) return;
  processing.add(tile);
  try {
  if (!tile?.isVideo || !isManagedAnimatedFlame(tile.document)) return;
  if (tile.scene?.id !== canvas.scene?.id) return;

  const animation = flameAnimationForIndex(Number(tile.document.flags[SYSTEM_ID].index));
  let source = tile.sourceElement;
  if (!source || source.tagName !== "VIDEO") return;
  if (applied.get(tile) === source) return;

  const owner = sourceOwners.get(source);
  if (owner && owner !== tile) {
    // Le cœur Foundry sait cloner une texture vidéo pour une lecture indépendante.
    // La plupart des Tiles sont déjà indépendants ; le clone n'est nécessaire
    // que si deux Tiles se retrouvent réellement avec la même source HTML.
    try {
      const cloned = await game.video.cloneTexture(source);
      if (tile.scene?.id !== canvas.scene?.id || !tile.mesh) {
        cloned.destroy?.(true);
        return;
      }
      tile.texture = cloned;
      tile.mesh.texture = cloned;
      source = tile.sourceElement;
      if (!source || source.tagName !== "VIDEO" || source === owner?.sourceElement) {
        console.warn(`${SYSTEM_ID} | Impossible d'isoler la vidéo de la flamme ${tile.id}.`);
        return;
      }
    } catch (error) {
      console.warn(`${SYSTEM_ID} | Clonage vidéo de la flamme impossible.`, error);
      return;
    }
  }

  sourceOwners.set(source, tile);
  applied.set(tile, source);

  const start = () => {
    if (tile.scene?.id !== canvas.scene?.id || tile.sourceElement !== source) return;
    const duration = source.duration;
    const offset = Number.isFinite(duration) && duration > 0
      ? animation.offset % duration
      : animation.offset;

    Promise.resolve(game.video.play(source, {
      playing: true,
      loop: true,
      volume: 0,
      offset
    })).catch((error) => {
      console.warn(`${SYSTEM_ID} | Lecture vidéo d'une flamme impossible.`, error);
    });
  };

  // Ne pas perdre le décalage si la vidéo est encore en chargement.
  if (source.readyState >= 1) start();
  else source.addEventListener("loadedmetadata", start, { once: true });
  } finally {
    processing.delete(tile);
  }
}

export function registerFlameAnimationHooks() {
  Hooks.on("drawTile", (tile) => {
    void playFlame(tile);
  });

  Hooks.on("canvasReady", () => {
    for (const tile of canvas.tiles?.placeables ?? []) {
      void playFlame(tile);
    }
  });

  Hooks.on("canvasTearDown", () => {
    sourceOwners = new Map();
    applied = new WeakMap();
    processing = new WeakSet();
  });
}
