import {
  INSTANT_STATUSES,
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
  setPresentationMode
} from "../state/game-state.js";

import {
  refreshPresentationChatCards
} from "../conflict/chat.js";

import {
  getWorldCharacterActors,
  updateCharacterResourceStates
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
          )?.value ?? INSTANT_STATUSES.IDLE
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
