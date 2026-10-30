import {
  INSTANT_STATUSES,
  GAMEPLAY_MODES,
  TOTAL_CANDLES,
  CANVAS_THEMES,
  PRESENTATION_MODES
} from "../constants.js";

import {
  requestAction
} from "../conflict/socket.js";

import {
  getOfficialCanvasStatus,
  initializeOfficialCanvas,
  repairOfficialCanvas,
  viewOfficialCanvas
} from "../canvas/installer.js";

import {
  syncOfficialCanvas
} from "../canvas/sync.js";

import {
  getCollectiveStateView,
  restoreBluePool,
  setBluePoolRemaining,
  setLitCandles,
  setPresentationMode,
  setGameplaySettings,
  setCanvasTheme
} from "../state/game-state.js";

import {
  refreshPresentationChatCards
} from "../conflict/chat.js";

import {
  getWorldCharacterActors,
  updateCharacterResourceStates,
  transferHopeDieGM
} from "../management/actor-resources.js";

import {
  createNewGame
} from "../management/game-manager.js";

const { ApplicationV2, HandlebarsApplicationMixin } =
  foundry.applications.api;

/**
 * Régie MJ centralisée du système Ten Candles.
 */
export class TenCandlesStateControl extends HandlebarsApplicationMixin(
  ApplicationV2
) {
  selectedActorId = null;

  static DEFAULT_OPTIONS = {
    id: "evil-tencandles-state-control",
    classes: [
      "tencandles-ga",
      "etc-state-control"
    ],
    tag: "section",
    position: {
      width: 1040,
      height: 780
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-fire-flame-curved"
    }
  };

  static PARTS = {
    main: {
      template:
        "systems/tencandles-ga/templates/apps/game-state-control.hbs"
    }
  };

  get title() {
    return game.i18n.localize("ETC.StateControl.Title");
  }

  static open() {
    const existing = [...this.instances()].find((app) => app.rendered);

    if (existing) {
      existing.bringToFront();
      existing.render();
      return existing;
    }

    const app = new this();
    app.render(true);
    return app;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = getCollectiveStateView();
    const characters = getWorldCharacterActors();

    let selectedActor = this.selectedActorId
      ? game.actors.get(this.selectedActorId)
      : null;

    if (selectedActor?.type !== "character") {
      selectedActor = null;
      this.selectedActorId = null;
    }

    return {
      ...context,
      state,
      canvas: getOfficialCanvasStatus(state),
      canvasThemes: {
        classicSelected: state.canvasTheme === CANVAS_THEMES.CLASSIC,
        postApoSelected: state.canvasTheme === CANVAS_THEMES.POST_APO,
        futurSelected: state.canvasTheme === CANVAS_THEMES.FUTUR,
        foretEnfantSelected: state.canvasTheme === CANVAS_THEMES.FORET_ENFANT,
        medievalSelected: state.canvasTheme === CANVAS_THEMES.MEDIEVAL,
        magieSelected: state.canvasTheme === CANVAS_THEMES.MAGIE,
        lovecraftSelected: state.canvasTheme === CANVAS_THEMES.LOVECRAFT,
        westernSelected: state.canvasTheme === CANVAS_THEMES.WESTERN,
        halloweenSelected: state.canvasTheme === CANVAS_THEMES.HALLOWEEN,
        canEdit: state.canModify && !state.hasActiveResolution
      },
      gameplay: {
        classicSelected: state.gameplayMode !== GAMEPLAY_MODES.SPEED,
        speedSelected: state.gameplayMode === GAMEPLAY_MODES.SPEED,
        canEdit: state.canModify && !state.hasActiveResolution,
        candleOptions: Array.from({length: TOTAL_CANDLES}, (_, index) => {
          const number = TOTAL_CANDLES - index;
          return {value: number, label: number, selected: state.speedLastCandle === number};
        })
      },
      presentation: {
        description: game.i18n.localize(
          state.presentationMode === PRESENTATION_MODES.PERSONAL
            ? "ETC.Presentation.PersonalDescription"
            : "ETC.Presentation.OfficialDescription"
        )
      },
      presentationModes: {
        official: {
          value: PRESENTATION_MODES.OFFICIAL,
          label: game.i18n.localize(
            "ETC.Presentation.Official"
          ),
          selected:
            state.presentationMode ===
            PRESENTATION_MODES.OFFICIAL
        },
        personal: {
          value: PRESENTATION_MODES.PERSONAL,
          label: game.i18n.localize(
            "ETC.Presentation.Personal"
          ),
          selected:
            state.presentationMode ===
            PRESENTATION_MODES.PERSONAL
        }
      },
      actorManagement: {
        characters: characters.map((actor) => ({
          id: actor.id,
          name: actor.name,
          selected: actor.id === selectedActor?.id
        })),
        hasCharacters: characters.length > 0,
        hasSelectedActor: Boolean(selectedActor),
        selectedActorName: selectedActor?.name ?? null,
        viceAvailable: Boolean(
          selectedActor?.system?.vice?.available
        ),
        virtueAvailable: Boolean(
          selectedActor?.system?.virtue?.available
        ),
        momentStatus:
          selectedActor?.system?.momentStatus ??
          INSTANT_STATUSES.IDLE,
        brinkConsumed: Boolean(selectedActor?.system?.brink?.burned),
        hopeDiceCount: selectedActor?.system?.hopeDiceCount ?? 0,
        transferRecipients: characters.filter(actor => actor.id !== selectedActor?.id).map(actor => ({id:actor.id,name:actor.name})),
        momentOptions: [
          {
            value: INSTANT_STATUSES.IDLE,
            label: game.i18n.localize(
              "ETC.ActorManagement.InstantIdle"
            ),
            selected:
              (selectedActor?.system?.momentStatus ??
                INSTANT_STATUSES.IDLE) ===
              INSTANT_STATUSES.IDLE
          },
          {
            value: INSTANT_STATUSES.SUCCESS,
            label: game.i18n.localize(
              "ETC.ActorManagement.InstantSuccess"
            ),
            selected:
              selectedActor?.system?.momentStatus ===
              INSTANT_STATUSES.SUCCESS
          },
          {
            value: INSTANT_STATUSES.FAILURE,
            label: game.i18n.localize(
              "ETC.ActorManagement.InstantFailure"
            ),
            selected:
              selectedActor?.system?.momentStatus ===
              INSTANT_STATUSES.FAILURE
          }
        ],
        canEdit: Boolean(
          selectedActor &&
          state.canEditActorResources
        ),
        blockedByConflict: state.hasActiveResolution,
        readOnly: !state.canModify
      },
      narrationSeize: {
        visible: state.canSeizeNarration,
        actorName:
          state.activeResolution?.actorName ?? "—",
        nextCandles: Math.max(0, state.litCandles - 1)
      },
      ball: {
        truthsRequiredLabel: game.i18n.format(
          state.truthsRequired === 1
            ? "ETC.StateControl.TruthRequired"
            : "ETC.StateControl.TruthsRequired",
          {
            count: state.truthsRequired
          }
        )
      }
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    for (const button of this.element.querySelectorAll(
      "[data-state-action]"
    )) {
      button.addEventListener("click", (event) => {
        void this.#onStateAction(event);
      });
    }

    const presentationSelect = this.element.querySelector(
      'select[name="presentationMode"]'
    );

    presentationSelect?.addEventListener(
      "change",
      (event) => {
        void this.#onPresentationModeChange(event);
      }
    );

    for (const input of this.element.querySelectorAll(
      'select[name="gameplayMode"], select[name="speedLastCandle"]'
    )) {
      input.addEventListener("change", () => { void this.#onGameplayChange(); });
    }

    this.element.querySelector('select[name="canvasTheme"]')?.addEventListener(
      "change", (event) => { void this.#onCanvasThemeChange(event); }
    );

    const actorSelect = this.element.querySelector(
      'select[name="managedActorId"]'
    );

    actorSelect?.addEventListener("change", (event) => {
      this.selectedActorId =
        event.currentTarget.value || null;
      this.render();
    });
  }

  async #onStateAction(event) {
    event.preventDefault();

    const button = event.currentTarget;
    const action = button?.dataset?.stateAction;
    const state = getCollectiveStateView();

    if (!action || button.disabled) return;

    button.disabled = true;

    try {
      switch (action) {
        case "candles-decrease":
          await setLitCandles(state.litCandles - 1);
          break;

        case "candles-increase":
          await setLitCandles(state.litCandles + 1);
          break;

        case "blue-decrease":
          await setBluePoolRemaining(state.bluePoolRemaining - 1);
          break;

        case "blue-increase":
          await setBluePoolRemaining(state.bluePoolRemaining + 1);
          break;

        case "blue-restore":
          await restoreBluePool();
          break;

        case "gm-roll":
          await requestAction(
            "gm-roll",
            {
              resolutionId:
                state.activeResolution?.id ?? null
            }
          );
          break;

        case "validate-resolution":
          await requestAction(
            "validate-resolution",
            {
              resolutionId:
                state.activeResolution?.id ?? null
            }
          );
          break;

        case "seize-narration":
          await requestAction(
            "seize-narration",
            {
              resolutionId:
                state.activeResolution?.id ?? null
            }
          );
          break;

        case "start-next-scene":
          await requestAction(
            "start-next-scene",
            {
              resolutionId:
                state.lastResolution?.id ?? null,
              messageId:
                state.lastResolution?.ballMessageId ?? null
            }
          );
          break;

        case "cancel-resolution":
          await requestAction(
            "cancel-resolution",
            {
              resolutionId:
                state.activeResolution?.id ?? null
            }
          );
          break;

        case "hope-transfer":
          await this.#transferHope();
          break;

        case "actor-resources-save":
          await this.#saveActorResources();
          break;

        case "create-new-game":
          if (await this.#confirmNewGame()) {
            await createNewGame();
            this.render();
          }
          break;

        case "canvas-view":
          await viewOfficialCanvas();
          break;

        case "canvas-sync":
          await syncOfficialCanvas(undefined, {
            notify: true
          });
          break;

        case "canvas-repair":
          await repairOfficialCanvas({
            activate: false,
            notify: true
          });
          break;

        default:
          return;
      }
    } catch (error) {
      console.error(
        "tencandles-ga | Échec d'une action de la régie MJ",
        error
      );
      ui.notifications.error(error.message);
      this.render();
    } finally {
      globalThis.setTimeout(() => {
        if (button.isConnected) button.disabled = false;
      }, 350);
    }
  }

  async #transferHope() {
    const toId = this.element.querySelector('select[name="hopeRecipientId"]')?.value;
    if (!this.selectedActorId || !toId) return false;
    const giver = game.actors.get(this.selectedActorId);
    const recipient = game.actors.get(toId);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("ETC.Hope.TransferTitle")},
      content: `<p>${game.i18n.format("ETC.Hope.TransferConfirm", {from: giver?.name ?? "?", to: recipient?.name ?? "?"})}</p>`
    });
    if (!confirmed) return false;
    const {giver: from, receiver: to} = await transferHopeDieGM(this.selectedActorId, toId);
    ui.notifications.info(game.i18n.format("ETC.Hope.Transferred", {from:from.name, to:to.name}));
    this.render();
    return true;
  }

  async #saveActorResources() {
    if (!this.selectedActorId) return false;

    const getBooleanValue = (name) =>
      this.element.querySelector(
        `select[name="${name}"]`
      )?.value === "true";

    const actor = await updateCharacterResourceStates(
      this.selectedActorId,
      {
        viceAvailable:
          getBooleanValue("viceAvailable"),
        virtueAvailable:
          getBooleanValue("virtueAvailable"),
        momentStatus:
          this.element.querySelector(
            'select[name="momentStatus"]'
          )?.value ?? INSTANT_STATUSES.IDLE,
        brinkConsumed: getBooleanValue("brinkConsumed")
      }
    );

    ui.notifications.info(
      game.i18n.format(
        "ETC.ActorManagement.Saved",
        { name: actor.name }
      )
    );

    this.render();
    return true;
  }

  async #confirmNewGame() {
    const DialogV2 = foundry.applications.api.DialogV2;

    const result = await DialogV2.wait({
      window: {
        title: game.i18n.localize(
          "ETC.NewGame.ConfirmTitle"
        )
      },
      content: [
        '<div class="ets-dialog etc-new-game-confirmation">',
        `<p>${game.i18n.localize(
          "ETC.NewGame.ConfirmIntro"
        )}</p>`,
        "<ul>",
        `<li>${game.i18n.localize(
          "ETC.NewGame.ConfirmEndCurrent"
        )}</li>`,
        `<li>${game.i18n.localize(
          "ETC.NewGame.ConfirmInterrupt"
        )}</li>`,
        `<li>${game.i18n.localize(
          "ETC.NewGame.ConfirmArchive"
        )}</li>`,
        `<li>${game.i18n.localize(
          "ETC.NewGame.ConfirmReset"
        )}</li>`,
        "</ul>",
        `<p><strong>${game.i18n.localize(
          "ETC.NewGame.ConfirmActorsSafe"
        )}</strong></p>`,
        `<p>${game.i18n.localize(
          "ETC.NewGame.ConfirmIrreversible"
        )}</p>`,
        "</div>"
      ].join(""),
      buttons: [
        {
          action: "cancel",
          label: game.i18n.localize(
            "ETC.Common.Cancel"
          ),
          icon: "fa-solid fa-xmark",
          default: true,
          callback: () => false
        },
        {
          action: "create",
          label: game.i18n.localize(
            "ETC.NewGame.CreateButton"
          ),
          icon: "fa-solid fa-fire-flame-curved",
          class: "etc-new-game-confirm__create",
          callback: () => true
        }
      ],
      close: () => false
    });

    return result === true;
  }

  async #onCanvasThemeChange(event) {
    const previousTheme = getCollectiveStateView().canvasTheme;
    try {
      await setCanvasTheme(event.currentTarget.value);
      // Réutilise la réparation officielle : rôles et index restent identiques.
      // Le sync final restaure les états des bougies et des dés de la partie.
      const state = getCollectiveStateView();
      if (state.activeSceneId && state.presentationMode === PRESENTATION_MODES.OFFICIAL) {
        await repairOfficialCanvas({ activate: false, notify: false });
      }
      this.render();
    } catch (error) {
      console.error("tencandles-ga | Changement de thème impossible", error);
      try { await setCanvasTheme(previousTheme); } catch (rollbackError) {
        console.error("tencandles-ga | Restauration du thème impossible", rollbackError);
      }
      ui.notifications.error(error.message);
      this.render();
    }
  }

  async #onGameplayChange() {
    const mode = this.element.querySelector('select[name="gameplayMode"]')?.value;
    // Le seuil est masqué en mode Classique : réutiliser celui de l’état collectif.
    const threshold = this.element.querySelector('select[name="speedLastCandle"]')?.value
      ?? getCollectiveStateView().speedLastCandle;
    try {
      await setGameplaySettings(mode, threshold);
      this.render();
    } catch (error) {
      console.error("tencandles-ga | Réglage Speed impossible", error);
      ui.notifications.error(error.message);
      this.render();
    }
  }

  async #onPresentationModeChange(event) {
    const presentationMode =
      event.currentTarget.value;

    try {
      await setPresentationMode(
        presentationMode
      );

      if (
        presentationMode ===
        PRESENTATION_MODES.OFFICIAL
      ) {
        await initializeOfficialCanvas();
      }

      await refreshPresentationChatCards();

      ui.notifications.info(
        game.i18n.localize(
          presentationMode === PRESENTATION_MODES.PERSONAL
            ? "ETC.Presentation.ChangedPersonal"
            : "ETC.Presentation.ChangedOfficial"
        )
      );
    } catch (error) {
      console.error(
        "tencandles-ga | Échec de modification du mode de présentation",
        error
      );
      ui.notifications.error(error.message);
      this.render();
    }
  }
}
