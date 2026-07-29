/**
 * Création, rendu et mise à jour des cartes de conflit et de transition.
 */

import {
  GAME_STAGES,
  PRESENTATION_MODES,
  RESOLUTION_STATUSES,
  SYSTEM_ID,
  TOTAL_CANDLES
} from "../constants.js";

import {
  canSeizeNarration,
  getCollectiveState
} from "../state/game-state.js";

import {
  analyzeResolution
} from "./dice.js";

const RESOLUTION_TEMPLATE_PATH =
  "systems/tencandles-ga/templates/chat/resolution-card.hbs";

const BALL_TEMPLATE_PATH =
  "systems/tencandles-ga/templates/chat/ball-of-truths-card.hbs";

const DEPARTURE_TEMPLATE_PATH =
  "systems/tencandles-ga/templates/chat/character-departure-card.hbs";

const DARKNESS_TEMPLATE_PATH =
  "systems/tencandles-ga/templates/chat/darkness-progression-card.hbs";

const NEW_GAME_TEMPLATE_PATH =
  "systems/tencandles-ga/templates/chat/new-game-card.hbs";

const DARKNESS_MESSAGE_KEYS = Object.freeze({
  9: "ETC.Atmosphere.Darkness9",
  8: "ETC.Atmosphere.Darkness8",
  7: "ETC.Atmosphere.Darkness7",
  6: "ETC.Atmosphere.Darkness6",
  5: "ETC.Atmosphere.Darkness5",
  4: "ETC.Atmosphere.Darkness4",
  3: "ETC.Atmosphere.Darkness3",
  2: "ETC.Atmosphere.Darkness2",
  1: "ETC.Atmosphere.Darkness1"
});

const CHARACTER_DEPARTURE_MESSAGE_KEYS = Object.freeze(
  Array.from(
    { length: 10 },
    (_value, index) =>
      `ETC.Atmosphere.Departure${index + 1}`
  )
);

const DEPARTURE_MESSAGE_HISTORY_KEY =
  "departureMessageHistory";

function normalizeDepartureMessageHistory(value) {
  const usedIndices = Array.isArray(value?.usedIndices)
    ? value.usedIndices
    : [];

  return {
    usedIndices: [
      ...new Set(
        usedIndices
          .map((index) => Number(index))
          .filter(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index <
                CHARACTER_DEPARTURE_MESSAGE_KEYS.length
          )
      )
    ]
  };
}

function prepareDepartureMessageDraw(
  history,
  randomValue = Math.random()
) {
  const normalizedHistory =
    normalizeDepartureMessageHistory(history);

  const allIndices = CHARACTER_DEPARTURE_MESSAGE_KEYS.map(
    (_key, index) => index
  );

  const currentCycle =
    normalizedHistory.usedIndices.length >=
    allIndices.length
      ? []
      : normalizedHistory.usedIndices;

  const unusedIndices = allIndices.filter(
    (index) => !currentCycle.includes(index)
  );

  const safeRandomValue = Math.min(
    0.999999999999,
    Math.max(0, Number(randomValue) || 0)
  );

  const selectedIndex = unusedIndices[
    Math.floor(safeRandomValue * unusedIndices.length)
  ];

  return {
    selectedIndex,
    previousHistory: normalizedHistory,
    nextHistory: {
      usedIndices: [
        ...currentCycle,
        selectedIndex
      ]
    }
  };
}

export function registerDepartureMessageHistorySetting() {
  game.settings.register(
    SYSTEM_ID,
    DEPARTURE_MESSAGE_HISTORY_KEY,
    {
      name: "Historique des textes de départ",
      hint:
        "Empêche un texte de départ d’être réutilisé avant que les autres aient été tirés.",
      scope: "world",
      config: false,
      type: Object,
      default: {
        usedIndices: []
      }
    }
  );
}

function prepareDice(
  results,
  color
) {
  return (results ?? []).map((value) => {
    const classes = [
      "ets-die",
      `ets-die--${color}`
    ];

    if (
      color === "hope" &&
      [5, 6].includes(value)
    ) {
      classes.push("is-hope-success");
    } else if (value === 6) {
      classes.push("is-success");
    } else if (
      color === "blue" &&
      value === 1
    ) {
      classes.push("is-danger");
    } else {
      classes.push("is-neutral");
    }

    return {
      value,
      cssClass: classes.join(" "),
      title: game.i18n.format(
        "ETC.Chat.DieResult",
        { value }
      )
    };
  });
}

function getFinalNarratorLabel(resolution) {
  if (!resolution.finalSuccess) return null;

  if (resolution.narrator === "gm") {
    return game.i18n.localize(
      "ETC.Chat.FinalGMNarrates"
    );
  }

  return game.i18n.format(
    "ETC.Chat.FinalPlayerNarrates",
    {
      name: resolution.actorName
    }
  );
}


function prepareCollectiveSummary(
  state = getCollectiveState()
) {
  return {
    visible:
      state.presentationMode ===
      PRESENTATION_MODES.PERSONAL,
    litCandles: state.litCandles,
    bluePoolRemaining:
      state.bluePoolRemaining
  };
}

export async function renderResolutionCard(
  resolution
) {
  const state = getCollectiveState();
  const analysis =
    analyzeResolution(resolution);

  const cancelled =
    resolution.status ===
    RESOLUTION_STATUSES.CANCELLED;

  const resolved =
    resolution.status ===
    RESOLUTION_STATUSES.RESOLVED;

  const awaitingGM =
    resolution.status ===
    RESOLUTION_STATUSES.WAITING_GM;

  const pendingValidation =
    resolution.status ===
    RESOLUTION_STATUSES.PENDING_VALIDATION;

  const viceOrVirtueUsed = Boolean(
    resolution.rerolls?.vice ||
    resolution.rerolls?.virtue
  );

  const showViceButton = Boolean(
    resolution.resources?.canUseVice
  );

  const showVirtueButton = Boolean(
    resolution.resources?.canUseVirtue
  );

  const showLimitButton = Boolean(
    resolution.limitAvailableAtStart
  );

  const viceVirtueDisabled = Boolean(
    viceOrVirtueUsed ||
    analysis.blueOnes === 0
  );

  const limitDisabled = Boolean(
    resolution.rerolls?.limit
  );

  const hasPlayerActions = Boolean(
    !cancelled &&
    !resolved &&
    (
      showViceButton ||
      showVirtueButton ||
      showLimitButton
    )
  );

  const hasGMActions = Boolean(
    !cancelled &&
    !resolved
  );

  const hasHope = Boolean(
    resolution.momentUsed &&
    resolution.momentResult !== null
  );

  const hasGMPool =
    resolution.redPoolSize > 0;

  const gmRollPending = Boolean(
    hasGMPool &&
    !resolution.gmRollCompleted &&
    !resolution.gmRollSkipped &&
    !resolved
  );

  const gmRollSkipped = Boolean(
    resolved &&
    resolution.gmRollSkipped
  );

  const provisionalNarratorLabel =
    analysis.provisionalNarrator === "gm"
      ? game.i18n.localize(
          "ETC.Chat.ProvisionalGMNarrates"
        )
      : analysis.provisionalNarrator === "player"
        ? game.i18n.format(
            "ETC.Chat.ProvisionalPlayerNarrates",
            {
              name: resolution.actorName
            }
          )
        : null;

  const finalNarratorLabel =
    getFinalNarratorLabel(resolution);

  const narrationSeizeLabel =
    game.i18n.format(
      "ETC.Chat.NarrationSeizeCompact",
      {
        name: resolution.actorName
      }
    );

  return foundry.applications.handlebars.renderTemplate(
    RESOLUTION_TEMPLATE_PATH,
    {
      resolution,

      blueDice: prepareDice(
        resolution.blueResults,
        "blue"
      ),
      redDice: prepareDice(
        resolution.redResults,
        "red"
      ),
      gmPlaceholderDice: prepareDice(
        Array.from(
          { length: resolution.redPoolSize },
          () => 6
        ),
        "red"
      ),
      hopeDice: hasHope
        ? prepareDice(
            [resolution.momentResult],
            "hope"
          )
        : [],

      analysis,

      cancelled,
      resolved,
      awaitingGM,
      pendingValidation,

      hasHope,
      hasGMPool,
      gmRollPending,
      gmRollSkipped,

      showViceButton,
      showVirtueButton,
      showLimitButton,
      viceVirtueDisabled,
      limitDisabled,
      hasPlayerActions,
      hasGMActions,

      viceUsed:
        Boolean(resolution.rerolls?.vice),
      virtueUsed:
        Boolean(resolution.rerolls?.virtue),
      limitUsed:
        Boolean(resolution.rerolls?.limit),

      provisionalSuccess:
        !cancelled &&
        !resolved &&
        analysis.provisionalSuccess,
      provisionalFailure:
        !cancelled &&
        !resolved &&
        !analysis.provisionalSuccess,

      hasProvisionalNarrator:
        Boolean(provisionalNarratorLabel),
      provisionalNarratorLabel,

      finalSuccess: Boolean(
        resolved &&
        resolution.finalSuccess
      ),
      finalFailure: Boolean(
        resolved &&
        resolution.finalSuccess === false
      ),
      finalNarratorLabel,
      finalBluePoolRemaining: Math.max(
        0,
        resolution.bluePoolSize -
          resolution.blueDiceLost
      ),
      characterDeparture: Boolean(
        resolution.characterDeparture
      ),
      canSeizeNarration:
        canSeizeNarration(state, resolution),
      narrationSeizeLabel,
      narrationSeized: Boolean(
        resolution.narrationSeized
      ),
      narrationSeizedCandles:
        resolution.narrationSeizedCandles,
      collectiveSummary:
        prepareCollectiveSummary(state)
    }
  );
}

export async function createResolutionMessage(
  resolution
) {
  const content = await renderResolutionCard(
    resolution
  );

  return foundry.documents.ChatMessage.create({
    content,
    speaker: {
      actor: resolution.actorId,
      alias: resolution.actorName
    },
    flags: {
      [SYSTEM_ID]: {
        type: "resolution",
        resolutionId: resolution.id,
        playerId: resolution.playerId
      }
    }
  });
}

export async function updateResolutionMessage(
  resolution
) {
  if (!resolution?.chatMessageId) return false;

  const message = game.messages.get(
    resolution.chatMessageId
  );

  if (!message) return false;

  await message.update({
    content:
      await renderResolutionCard(resolution)
  });

  return true;
}

export async function renderBallOfTruthsCard(
  resolution,
  {
    completed = false,
    interrupted = false,
    litCandles = null,
    bluePoolRemaining = null
  } = {}
) {
  const candlesBeforeTransition = Math.max(
    0,
    Math.min(
      TOTAL_CANDLES,
      Number(resolution?.litCandlesAtRoll ?? 0)
    )
  );

  const nextLitCandles = completed
    ? Number(litCandles ?? 0)
    : Math.max(0, candlesBeforeTransition - 1);

  // Le nombre de vérités est égal au nombre de bougies restant
  // après l'extinction qui ouvre le Bal des vérités.
  const truthsRequired = nextLitCandles;

  const nextBluePool = completed
    ? Number(bluePoolRemaining ?? nextLitCandles)
    : nextLitCandles;

  return foundry.applications.handlebars.renderTemplate(
    BALL_TEMPLATE_PATH,
    {
      resolution,
      completed,
      interrupted: Boolean(
        interrupted || resolution?.ballInterrupted
      ),
      narrationSeized: Boolean(
        resolution?.narrationSeized
      ),
      truthsRequired,
      truthsLabel: game.i18n.localize(
        truthsRequired === 1
          ? "ETC.Chat.TruthToTell"
          : "ETC.Chat.TruthsToTell"
      ),
      nextLitCandles,
      nextBluePool,
      nextGMPool: TOTAL_CANDLES - nextLitCandles,
      collectiveSummary:
        prepareCollectiveSummary()
    }
  );
}

export async function createBallOfTruthsMessage(
  resolution,
  options = {}
) {
  const message =
    await foundry.documents.ChatMessage.create({
      content:
        await renderBallOfTruthsCard(
          resolution,
          options
        ),
      speaker: {
        alias: "Ten Candles"
      },
      flags: {
        [SYSTEM_ID]: {
          type: "ball-of-truths",
          resolutionId: resolution.id
        }
      }
    });

  return message;
}

function findBallOfTruthsMessage(
  resolution,
  requestedMessageId = null
) {
  const directId =
    requestedMessageId ??
    resolution?.ballMessageId ??
    null;

  if (directId) {
    const directMessage = game.messages.get(directId);
    if (directMessage) return directMessage;
  }

  return game.messages.find((message) => (
    message.getFlag(
      SYSTEM_ID,
      "type"
    ) === "ball-of-truths" &&
    message.getFlag(
      SYSTEM_ID,
      "resolutionId"
    ) === resolution?.id
  )) ?? null;
}

export async function updateBallOfTruthsMessage(
  resolution,
  state,
  requestedMessageId = null
) {
  const message = findBallOfTruthsMessage(
    resolution,
    requestedMessageId
  );

  if (!message) return false;

  await message.update({
    content: await renderBallOfTruthsCard(
      resolution,
      {
        completed: true,
        litCandles: state.litCandles,
        bluePoolRemaining:
          state.bluePoolRemaining
      }
    )
  });

  return true;
}

export async function interruptBallOfTruthsMessage(
  resolution,
  requestedMessageId = null
) {
  if (!resolution) return false;

  resolution.ballInterrupted = true;
  resolution.updatedAt = Date.now();
  resolution.history = [
    ...(resolution.history ?? []),
    {
      type: "ball-of-truths-interrupted",
      timestamp: resolution.updatedAt
    }
  ];

  const message = findBallOfTruthsMessage(
    resolution,
    requestedMessageId
  );

  if (!message) return false;

  await message.update({
    content: await renderBallOfTruthsCard(
      resolution,
      { interrupted: true }
    )
  });

  return true;
}

export async function renderNewGameCard(state) {
  return foundry.applications.handlebars.renderTemplate(
    NEW_GAME_TEMPLATE_PATH,
    {
      gameIdShort: state.gameId?.slice(0, 8) ?? "—",
      litCandles: state.litCandles,
      bluePoolRemaining: state.bluePoolRemaining,
      redPoolSize: TOTAL_CANDLES - state.litCandles,
      presentationModeLabel: game.i18n.localize(
        state.presentationMode === PRESENTATION_MODES.PERSONAL
          ? "ETC.Presentation.Personal"
          : "ETC.Presentation.Official"
      )
    }
  );
}

export async function createNewGameMessage(state) {
  return foundry.documents.ChatMessage.create({
    content: await renderNewGameCard(state),
    speaker: { alias: "Ten Candles" },
    flags: {
      [SYSTEM_ID]: {
        type: "new-game",
        gameId: state.gameId
      }
    }
  });
}

export async function refreshNarrationSeizeCard(
  state = getCollectiveState()
) {
  const resolution =
    state?.activeResolution ??
    state?.lastResolution ??
    null;

  if (!resolution) return false;

  return updateResolutionMessage(resolution);
}

export async function renderCharacterDepartureCard(
  resolution,
  messageIndex = 0
) {
  const normalizedIndex =
    Number.isInteger(messageIndex) &&
    messageIndex >= 0 &&
    messageIndex <
      CHARACTER_DEPARTURE_MESSAGE_KEYS.length
      ? messageIndex
      : 0;

  const departureText = game.i18n.format(
    CHARACTER_DEPARTURE_MESSAGE_KEYS[normalizedIndex],
    { name: resolution.actorName }
  );

  const departureParagraphs = String(departureText)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return foundry.applications.handlebars.renderTemplate(
    DEPARTURE_TEMPLATE_PATH,
    {
      resolution,
      departureText,
      departureParagraphs,
      collectiveSummary:
        prepareCollectiveSummary()
    }
  );
}

export async function createCharacterDepartureMessage(
  resolution
) {
  const history = game.settings.get(
    SYSTEM_ID,
    DEPARTURE_MESSAGE_HISTORY_KEY
  );

  const {
    selectedIndex: messageIndex,
    previousHistory,
    nextHistory
  } = prepareDepartureMessageDraw(history);

  await game.settings.set(
    SYSTEM_ID,
    DEPARTURE_MESSAGE_HISTORY_KEY,
    nextHistory
  );

  try {
    return await foundry.documents.ChatMessage.create({
      content:
        await renderCharacterDepartureCard(
          resolution,
          messageIndex
        ),
      speaker: {
        alias: "Ten Candles"
      },
      flags: {
        [SYSTEM_ID]: {
          type: "character-departure",
          resolutionId: resolution.id,
          actorUuid: resolution.actorUuid,
          messageIndex
        }
      }
    });
  } catch (error) {
    try {
      await game.settings.set(
        SYSTEM_ID,
        DEPARTURE_MESSAGE_HISTORY_KEY,
        previousHistory
      );
    } catch (rollbackError) {
      console.error(
        `${SYSTEM_ID} | Impossible de restaurer l’historique des textes de départ.`,
        rollbackError
      );
    }

    throw error;
  }
}

export async function renderDarknessProgressionCard(
  state
) {
  const darknessKey =
    DARKNESS_MESSAGE_KEYS[state.litCandles] ??
    null;

  return foundry.applications.handlebars.renderTemplate(
    DARKNESS_TEMPLATE_PATH,
    {
      litCandles: state.litCandles,
      bluePoolRemaining:
        state.bluePoolRemaining,
      redPoolSize:
        TOTAL_CANDLES - state.litCandles,
      oneCandleRemaining:
        state.litCandles === 1,
      darknessText: darknessKey
        ? game.i18n.localize(darknessKey)
        : ""
    }
  );
}

export async function createDarknessProgressionMessage(
  state
) {
  return foundry.documents.ChatMessage.create({
    content:
      await renderDarknessProgressionCard(state),
    speaker: {
      alias: "Ten Candles"
    },
    flags: {
      [SYSTEM_ID]: {
        type: "darkness-progression",
        litCandles: state.litCandles
      }
    }
  });
}

export async function refreshPresentationChatCards() {
  const state = getCollectiveState();
  const tasks = [];

  if (state.activeResolution) {
    tasks.push(
      updateResolutionMessage(
        state.activeResolution
      )
    );
  }

  if (
    state.stage === GAME_STAGES.BALL_OF_TRUTHS
    && state.lastResolution?.finalSuccess === false
    && !state.lastResolution?.characterDeparture
  ) {
    const message = findBallOfTruthsMessage(
      state.lastResolution
    );

    if (message) {
      tasks.push(
        message.update({
          content:
            await renderBallOfTruthsCard(
              state.lastResolution
            )
        })
      );
    }
  }

  await Promise.allSettled(tasks);
}

export function activateResolutionCardActions(
  message,
  html
) {
  const resolutionId = message.getFlag(
    SYSTEM_ID,
    "resolutionId"
  );

  if (!resolutionId) return;

  const card = html.querySelector(
    "[data-resolution-id]"
  );

  if (!card) return;

  const playerId =
    message.getFlag(
      SYSTEM_ID,
      "playerId"
    ) ??
    card.dataset.playerId;

  const canUsePlayerActions = Boolean(
    game.user.isGM ||
    (
      playerId &&
      game.user.id === playerId
    )
  );

  const playerActions = card.querySelector(
    "[data-player-actions]"
  );

  if (playerActions) {
    playerActions.hidden =
      !canUsePlayerActions;
  }

  for (
    const gmActions of card.querySelectorAll(
      "[data-gm-actions]"
    )
  ) {
    gmActions.hidden = !game.user.isGM;
  }

  for (
    const button of card.querySelectorAll(
      "[data-resolution-action]"
    )
  ) {
    button.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        if (button.disabled) return;

        const action =
          button.dataset.resolutionAction;

        if (!action) return;

        button.disabled = true;

        try {
          const {
            requestAction
          } = await import("./socket.js");

          await requestAction(action, {
            resolutionId,
            messageId: message.id
          });
        } finally {
          window.setTimeout(() => {
            if (button.isConnected) {
              button.disabled = false;
            }
          }, 650);
        }
      }
    );
  }
}
