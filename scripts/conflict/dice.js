/**
 * Évaluation des pools de dés et animation Dice So Nice facultative.
 */

import {
  SOCKET_NAME,
  TOTAL_CANDLES
} from "../constants.js";

import {
  clampInteger
} from "../utils.js";

import { effectiveBlueResults } from "./speed.js";

function getActiveDieResults(die) {
  return (die?.results ?? [])
    .filter((result) => result.active !== false)
    .map((result) => result.result);
}

function getRollClass() {
  return (
    CONFIG.Dice.rolls?.[0] ??
    foundry.dice.Roll.defaultImplementation ??
    foundry.dice.Roll
  );
}

function createD6Roll(formula, actorId = null) {
  const data = actorId ? { actorId } : {};
  const RollClass = getRollClass();

  if (typeof RollClass.create === "function") {
    return RollClass.create(formula, data);
  }

  return new RollClass(formula, data);
}

function serializeRoll(roll) {
  const data = roll.toJSON();

  return typeof data === "string"
    ? data
    : JSON.stringify(data);
}

function deserializeRoll(serializedRoll) {
  const RollClass = getRollClass();
  const json = typeof serializedRoll === "string"
    ? serializedRoll
    : JSON.stringify(serializedRoll);

  if (typeof RollClass.fromJSON === "function") {
    return RollClass.fromJSON(json);
  }

  const data = JSON.parse(json);

  if (typeof RollClass.fromData === "function") {
    return RollClass.fromData(data);
  }

  throw new Error(
    game.i18n.localize("ETC.Errors.RollDeserialize")
  );
}

/**
 * Creates an animation-only copy of an evaluated roll. The original roll,
 * its serialized data, and Hope die remain physically accurate.
 */
function makeDisplayRoll(roll, speedBlue) {
  if (!speedBlue) return roll;
  const raw = getActiveDieResults(roll.dice[0]);
  const effective = effectiveBlueResults(raw, true);
  if (raw.every((value, i) => value === effective[i])) return roll;

  const displayRoll = deserializeRoll(serializeRoll(roll));
  const die = displayRoll.dice[0];
  let index = 0;
  for (const result of die.results) {
    if (result.active === false) continue;
    result.result = effective[index++];
  }
  // Keep the animation roll's cached total consistent with its visible faces.
  if (typeof displayRoll._total === "number") {
    displayRoll._total += effective.reduce((a, b) => a + b, 0) -
      raw.reduce((a, b) => a + b, 0);
  }
  return displayRoll;
}

async function showRollIn3DLocal(roll, userId) {
  const dice3d = game.dice3d;
  const diceSoNiceActive =
    game.modules.get("dice-so-nice")?.active === true;

  if (
    !diceSoNiceActive ||
    typeof dice3d?.showForRoll !== "function"
  ) {
    return false;
  }

  if (
    typeof dice3d.isEnabled === "function" &&
    !dice3d.isEnabled()
  ) {
    return false;
  }

  const roller = game.users.get(userId) ?? game.user;

  try {
    const displayed = await dice3d.showForRoll(
      roll,
      roller,
      false,
      null,
      false
    );

    return displayed !== false;
  } catch (error) {
    console.warn(
      "tencandles-ga | Animation Dice So Nice indisponible.",
      error
    );
    return false;
  }
}

async function showRollIn3D(roll, userId) {
  game.socket.emit(SOCKET_NAME, {
    type: "dice3d-roll",
    sourceId: game.user.id,
    userId,
    serializedRoll: serializeRoll(roll)
  });

  return showRollIn3DLocal(roll, userId);
}

export async function handleDice3DRollMessage(data) {
  if (!data || data.type !== "dice3d-roll") return false;
  if (data.sourceId === game.user.id) return false;
  if (!data.serializedRoll || !data.userId) return false;

  try {
    const roll = deserializeRoll(data.serializedRoll);
    return showRollIn3DLocal(roll, data.userId);
  } catch (error) {
    console.error(
      "tencandles-ga | Reconstruction du jet 3D impossible.",
      error
    );
    return false;
  }
}

export async function rollD6Pool(
  numberOfDice,
  {
    userId = game.user.id,
    actorId = null,
    speedBlue = false
  } = {}
) {
  const count = clampInteger(
    numberOfDice,
    0,
    TOTAL_CANDLES
  );

  if (count === 0) {
    return {
      results: [],
      serializedRoll: null
    };
  }

  const roll = createD6Roll(`${count}d6`, actorId);

  await roll.evaluate({ allowInteractive: false });
  await showRollIn3D(makeDisplayRoll(roll, speedBlue), userId);

  return {
    results: getActiveDieResults(roll.dice[0]),
    serializedRoll: serializeRoll(roll)
  };
}

/**
 * Le dé d'Espoir est lancé dans la même animation que le pool joueur, mais
 * reste isolé dans les données pour préserver ses règles de succès et
 * son historique ; la Limite relance les deux pools simultanément.
 */
export async function rollPlayerD6Pool(
  numberOfDice,
  {
    includeHope = false,
    hopeDice = includeHope ? 1 : 0,
    userId = game.user.id,
    actorId = null,
    speedBlue = false
  } = {}
) {
  const count = clampInteger(
    numberOfDice,
    0,
    TOTAL_CANDLES
  );

  const hopeCount = clampInteger(hopeDice, 0, TOTAL_CANDLES);
  if (count === 0) {
    return {
      blueResults: [],
      hopeResults: [],
      hopeResult: null,
      serializedRoll: null
    };
  }

  const formula = hopeCount > 0
    ? `${count}d6 + ${hopeCount}d6`
    : `${count}d6`;

  const roll = createD6Roll(formula, actorId);

  await roll.evaluate({ allowInteractive: false });
  await showRollIn3D(makeDisplayRoll(roll, speedBlue), userId);

  const hopeResults = hopeCount > 0 ? getActiveDieResults(roll.dice[1]) : [];
  return {
    blueResults: getActiveDieResults(roll.dice[0]),
    hopeResults,
    hopeResult: hopeResults[0] ?? null,
    serializedRoll: serializeRoll(roll)
  };
}

export function getHopeResults(resolution) {
  if (Array.isArray(resolution?.hopeResults) && resolution.hopeResults.length > 0) {
    return resolution.hopeResults;
  }
  return resolution?.momentUsed && resolution?.momentResult != null
    ? [resolution.momentResult] : [];
}

export function countValue(results, value) {
  return (results ?? []).filter(
    (result) => result === value
  ).length;
}

export function analyzeResolution(resolution) {
  const blueSixes = countValue(
    resolution?.blueResults,
    6
  );

  const blueOnes = countValue(
    resolution?.blueResults,
    1
  );

  const redSixes = countValue(
    resolution?.redResults,
    6
  );

  const hopeResults = getHopeResults(resolution);
  const momentSuccess = hopeResults.some(result => [5, 6].includes(Number(result)));
  const momentSixes = countValue(hopeResults.map(Number), 6);

  const playerSixes = blueSixes + momentSixes;
  const provisionalSuccess =
    blueSixes > 0 || momentSuccess;

  const provisionalNarrator = Boolean(
    resolution?.gmRollCompleted &&
    provisionalSuccess
  )
    ? (
        redSixes >= playerSixes
          ? "gm"
          : "player"
      )
    : null;

  return {
    blueSixes,
    blueOnes,
    redSixes,
    momentSuccess,
    momentSixes,
    playerSixes,
    provisionalSuccess,
    provisionalNarrator
  };
}

export function analyzePlayerRoll(results) {
  const resolution = {
    blueResults: results,
    redResults: [],
    momentUsed: false,
    momentResult: null,
    gmRollCompleted: false
  };

  const analysis = analyzeResolution(resolution);

  return {
    sixes: analysis.blueSixes,
    ones: analysis.blueOnes,
    provisionalSuccess:
      analysis.provisionalSuccess
  };
}
