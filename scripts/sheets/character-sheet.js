import {
  INSTANT_REQUEST_STATUSES,
  INSTANT_STATUSES
} from "../constants.js";

import {
  requestAction,
  requestPlayerRoll
} from "../conflict/socket.js";

import {
  getInstantRequestForActor
} from "../instant/manager.js";

import {
  getCollectiveStateView
} from "../state/game-state.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const RESOURCE_KEYS = Object.freeze([
  "virtue",
  "vice",
  "moment"
]);

function normalizeResourceOrder(system) {
  const requested = Array.isArray(system?.resourceOrderList)
    ? system.resourceOrderList
    : String(system?.resourceOrder ?? "")
      .split(",")
      .map((entry) => entry.trim());

  return [
    ...new Set([
      ...requested.filter((entry) => RESOURCE_KEYS.includes(entry)),
      ...RESOURCE_KEYS
    ])
  ].slice(0, RESOURCE_KEYS.length);
}

function getRollButtonLabel(collective) {
  const availableDice = Math.max(
    0,
    Number(collective?.bluePoolRemaining) || 0
  );
  const litCandles = Math.max(
    0,
    Number(collective?.litCandles) || 0
  );

  if (availableDice === 0) {
    return game.i18n.localize(
      "ETC.Character.NoDiceAvailable"
    );
  }

  if (availableDice === 1) {
    return game.i18n.localize(
      litCandles === 1
        ? "ETC.Character.LastCandleRoll"
        : "ETC.Character.RollOneDie"
    );
  }

  return game.i18n.format(
    "ETC.Character.RollDiceCount",
    { count: availableDice }
  );
}

/**
 * Fiche du personnage Ten Candles.
 */
export class TenCandlesCharacterSheet extends HandlebarsApplicationMixin(
  ActorSheetV2
) {
  _conceptExpanded = false;
  _draggedResourceKey = null;
  _portraitReferenceHeight = null;

  static DEFAULT_OPTIONS = {
    classes: [
      "tencandles-ga",
      "actor-sheet",
      "character-sheet"
    ],
    tag: "form",
    position: {
      width: 720,
      height: 900
    },
    window: {
      resizable: true
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template:
        "systems/tencandles-ga/templates/actor/character-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const collective = getCollectiveStateView();
    const instantRequest = getInstantRequestForActor(
      collective,
      this.actor
    );
    const momentStatus = system.momentStatus;

    const resourceContexts = {
      virtue: {
        key: "virtue",
        title: game.i18n.localize("ETC.Character.Virtue"),
        hint: game.i18n.localize("ETC.Character.VirtueHint"),
        textPath: "system.virtue.text",
        text:
          system.virtue.text ||
          game.i18n.localize("ETC.Character.VirtuePlaceholder"),
        placeholder: game.i18n.localize("ETC.Character.VirtuePlaceholder"),
        stateClass: system.virtue.available
          ? "is-available"
          : "is-consumed",
        action: "toggle-virtue",
        actionLabel: game.i18n.localize(
          system.virtue.available
            ? "ETC.Character.BurnCard"
            : "ETC.Character.CardBurned"
        ),
        actionDisabled: !this.isEditable
      },
      vice: {
        key: "vice",
        title: game.i18n.localize("ETC.Character.Vice"),
        hint: game.i18n.localize("ETC.Character.ViceHint"),
        textPath: "system.vice.text",
        text:
          system.vice.text ||
          game.i18n.localize("ETC.Character.VicePlaceholder"),
        placeholder: game.i18n.localize("ETC.Character.VicePlaceholder"),
        stateClass: system.vice.available
          ? "is-available"
          : "is-consumed",
        action: "toggle-vice",
        actionLabel: game.i18n.localize(
          system.vice.available
            ? "ETC.Character.BurnCard"
            : "ETC.Character.CardBurned"
        ),
        actionDisabled: !this.isEditable
      },
      moment: {
        key: "moment",
        title: game.i18n.localize("ETC.Character.Moment"),
        hint: game.i18n.localize("ETC.Character.MomentHint"),
        textPath: "system.moment.text",
        text:
          system.moment.text ||
          game.i18n.localize("ETC.Character.MomentPlaceholder"),
        placeholder: game.i18n.localize("ETC.Character.MomentPlaceholder"),
        stateClass: instantRequest
          ? "is-pending"
          : momentStatus === INSTANT_STATUSES.SUCCESS
            ? "is-success"
            : momentStatus === INSTANT_STATUSES.FAILURE
              ? "is-failure"
              : "is-idle",
        action: instantRequest
          ? "cancel-instant"
          : momentStatus === INSTANT_STATUSES.IDLE
            ? "trigger-instant"
            : "reset-instant",
        actionLabel: game.i18n.localize(
          instantRequest
            ? "ETC.Character.InstantPending"
            : momentStatus === INSTANT_STATUSES.SUCCESS
              ? "ETC.Character.HopeGained"
              : momentStatus === INSTANT_STATUSES.FAILURE
                ? "ETC.Character.HopeLost"
                : "ETC.Character.TriggerInstant"
        ),
        actionDisabled: Boolean(
          !this.isEditable ||
          (
            instantRequest &&
            (
              (instantRequest.messageIds ?? []).length > 0 ||
              instantRequest.status !== INSTANT_REQUEST_STATUSES.QUEUED
            )
          )
        ),
        requestId: instantRequest?.id ?? null
      }
    };

    return {
      ...context,
      actor: this.actor,
      system,
      editable: this.isEditable,
      canRollActor: Boolean(
        game.user.isGM ||
        this.actor.testUserPermission(game.user, "OWNER")
      ),
      collective,
      rollButtonLabel: getRollButtonLabel(collective),
      resourceCards: normalizeResourceOrder(system).map((key) => ({
        ...resourceContexts[key],
        draggable: this.isEditable
      })),
      brink: {
        text:
          system.brink.text ||
          game.i18n.localize("ETC.Character.BrinkPlaceholder"),
        available: system.brinkAvailable,
        stateClass: system.brinkAvailable
          ? "is-unlocked"
          : "is-locked",
        statusLabel: game.i18n.localize(
          system.brinkAvailable
            ? "ETC.Character.BrinkAvailable"
            : "ETC.Character.BrinkLocked"
        ),
        statusHelp: game.i18n.localize(
          "ETC.Character.BrinkHint"
        )
      }
    };
  }

  async _onClose(options) {
    this._conceptExpanded = false;
    return super._onClose(options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const rollButton = this.element.querySelector(
      ".ets-sheet-roll"
    );

    rollButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (rollButton.disabled) return;

      rollButton.disabled = true;

      try {
        await requestPlayerRoll(this.actor.uuid);
      } finally {
        globalThis.setTimeout(() => {
          if (rollButton.isConnected) {
            rollButton.disabled = false;
          }
        }, 650);
      }
    });

    for (const button of this.element.querySelectorAll(
      "[data-resource-action]"
    )) {
      button.addEventListener("click", (event) => {
        void this.#onResourceAction(event);
      });
    }

    this.#activateResourceOrdering();
    this.#activateDynamicNarrativeText();
    this.#activateConceptField();
  }

  async #onResourceAction(event) {
    event.preventDefault();

    const button = event.currentTarget;
    const action = button.dataset.resourceAction;
    if (!action || button.disabled || !this.isEditable) return;

    button.disabled = true;

    try {
      switch (action) {
        case "toggle-vice":
          await this.#togglePersistentResource("vice");
          break;

        case "toggle-virtue":
          await this.#togglePersistentResource("virtue");
          break;

        case "trigger-instant":
          await this.#requestInstant();
          break;

        case "cancel-instant":
          await this.#cancelQueuedInstant(button.dataset.requestId);
          break;

        case "reset-instant":
          await this.#resetInstant();
          break;

        default:
          return;
      }
    } finally {
      globalThis.setTimeout(() => {
        if (button.isConnected) {
          button.disabled = false;
        }
      }, 350);
    }
  }

  async #togglePersistentResource(resource) {
    const current = Boolean(
      this.actor.system?.[resource]?.available
    );
    const next = !current;
    const label = game.i18n.localize(
      resource === "vice"
        ? "ETC.Character.Vice"
        : "ETC.Character.Virtue"
    );

    const confirmed = await this.#confirmResourceChange({
      title: game.i18n.format(
        next
          ? "ETC.Character.RestoreConfirmTitle"
          : "ETC.Character.BurnConfirmTitle",
        { resource: label }
      ),
      body: game.i18n.format(
        next
          ? "ETC.Character.RestoreConfirmBody"
          : "ETC.Character.BurnConfirmBody",
        { resource: label }
      ),
      confirmLabel: game.i18n.localize(
        next
          ? "ETC.Character.RestoreCard"
          : "ETC.Character.BurnCard"
      )
    });

    if (!confirmed) return false;

    await this.actor.update({
      [`system.${resource}.available`]: next
    });

    return true;
  }

  async #requestInstant() {
    const state = getCollectiveStateView();
    const queued = Boolean(state.activeResolution);

    const confirmed = await this.#confirmResourceChange({
      title: game.i18n.localize("ETC.Instant.ConfirmTitle"),
      body: game.i18n.localize(
        queued
          ? "ETC.Instant.ConfirmQueuedBody"
          : "ETC.Instant.ConfirmImmediateBody"
      ),
      confirmLabel: game.i18n.localize(
        queued
          ? "ETC.Instant.QueueButton"
          : "ETC.Instant.PublishButton"
      ),
      includeConflictWarning: false
    });

    if (!confirmed) return false;

    return requestAction("request-instant", {
      actorUuid: this.actor.uuid
    });
  }

  async #cancelQueuedInstant(requestId) {
    if (!requestId) return false;

    const confirmed = await this.#confirmResourceChange({
      title: game.i18n.localize("ETC.Instant.CancelConfirmTitle"),
      body: game.i18n.localize("ETC.Instant.CancelConfirmBody"),
      confirmLabel: game.i18n.localize("ETC.Instant.CancelRequestButton"),
      includeConflictWarning: false
    });

    if (!confirmed) return false;

    return requestAction("cancel-instant-request", {
      requestId
    });
  }

  async #resetInstant() {
    const confirmed = await this.#confirmResourceChange({
      title: game.i18n.localize("ETC.Instant.ResetConfirmTitle"),
      body: game.i18n.localize("ETC.Instant.ResetConfirmBody"),
      confirmLabel: game.i18n.localize("ETC.Instant.ResetButton")
    });

    if (!confirmed) return false;

    await this.actor.update({
      "system.moment.status": INSTANT_STATUSES.IDLE
    });

    return true;
  }

  async #confirmResourceChange({
    title,
    body,
    confirmLabel,
    includeConflictWarning = true
  }) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const conflictWarning = Boolean(
      includeConflictWarning &&
      getCollectiveStateView().activeResolution
    );

    const content = [
      '<div class="ets-dialog etc-resource-confirmation">',
      `<p>${body}</p>`,
      conflictWarning
        ? [
            '<div class="etc-resource-confirmation__warning">',
            '<i class="fa-solid fa-triangle-exclamation"></i>',
            '<div>',
            `<span>${game.i18n.localize("ETC.Character.NextConflictWarningImmediate")}</span>`,
            `<span>${game.i18n.localize("ETC.Character.NextConflictWarningNextRoll")}</span>`,
            "</div>",
            "</div>"
          ].join("")
        : "",
      "</div>"
    ].join("");

    const result = await DialogV2.wait({
      window: { title },
      position: { width: 460 },
      content,
      buttons: [
        {
          action: "cancel",
          label: game.i18n.localize("ETC.Common.Cancel"),
          icon: "fa-solid fa-xmark",
          default: true,
          callback: () => false
        },
        {
          action: "confirm",
          label: confirmLabel,
          icon: "fa-solid fa-check",
          callback: () => true
        }
      ],
      close: () => false
    });

    return result === true;
  }

  #activateResourceOrdering() {
    const cards = [
      ...this.element.querySelectorAll(
        ".etc-resource[data-resource-key]"
      )
    ];

    for (const card of cards) {
      card.addEventListener("dragstart", (event) => {
        if (!this.isEditable) return;

        this._draggedResourceKey = card.dataset.resourceKey;
        card.classList.add("is-dragging");
        event.dataTransfer?.setData(
          "text/plain",
          this._draggedResourceKey
        );
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
      });

      card.addEventListener("dragend", () => {
        this._draggedResourceKey = null;
        card.classList.remove("is-dragging");
        for (const candidate of cards) {
          candidate.classList.remove("is-drag-target");
        }
      });

      card.addEventListener("dragover", (event) => {
        if (!this._draggedResourceKey) return;
        event.preventDefault();
        card.classList.add("is-drag-target");
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("is-drag-target");
      });

      card.addEventListener("drop", async (event) => {
        event.preventDefault();
        card.classList.remove("is-drag-target");

        const dragged =
          this._draggedResourceKey ||
          event.dataTransfer?.getData("text/plain");
        const target = card.dataset.resourceKey;

        if (!dragged || !target || dragged === target) return;

        const order = normalizeResourceOrder(this.actor.system);
        const fromIndex = order.indexOf(dragged);
        const targetIndex = order.indexOf(target);

        if (fromIndex < 0 || targetIndex < 0) return;

        order.splice(fromIndex, 1);
        order.splice(targetIndex, 0, dragged);

        await this.actor.update({
          "system.resourceOrder": order.join(",")
        });
      });
    }
  }

  #activateDynamicNarrativeText() {
    const fit = (field) => {
      const length = String(field.value ?? "").trim().length;
      const size = length <= 20
        ? 25
        : length <= 36
          ? 21
          : length <= 70
            ? 18
            : length <= 110
              ? 16
              : 14;

      field.style.setProperty(
        "--etc-resource-text-size",
        `${size}px`
      );
    };

    for (const field of this.element.querySelectorAll(
      ".etc-resource-text"
    )) {
      fit(field);
      field.addEventListener("input", () => fit(field));
    }
  }

  #activateConceptField() {
    const field = this.element.querySelector(
      ".etc-concept-input"
    );
    const toggle = this.element.querySelector(
      ".etc-concept-toggle"
    );
    const identity = this.element.querySelector(
      ".etc-sheet-identity"
    );
    const portraitFrame = this.element.querySelector(
      ".etc-sheet-portrait-frame"
    );

    if (!field || !toggle) return;

    /*
     * Un changement d’état collectif rerend la fiche. La dernière hauteur
     * calculée est réappliquée immédiatement au nouveau cadre afin que le
     * portrait ne remonte pas brièvement avant la prochaine mesure.
     */
    if (
      portraitFrame &&
      Number.isFinite(this._portraitReferenceHeight) &&
      this._portraitReferenceHeight > 0
    ) {
      portraitFrame.style.height =
        `${this._portraitReferenceHeight}px`;
    }

    const style = getComputedStyle(field);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const padding =
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0) +
      (Number.parseFloat(style.borderTopWidth) || 0) +
      (Number.parseFloat(style.borderBottomWidth) || 0);
    const collapsedHeight = Math.ceil(lineHeight * 4 + padding);

    let portraitSyncToken = 0;

    const measureFullHeight = () => {
      field.style.height = `${collapsedHeight}px`;

      const rawContentHeight = Math.max(
        lineHeight * 4,
        field.scrollHeight - padding
      );
      const lineCount = Math.max(
        4,
        Math.ceil((rawContentHeight - 0.5) / lineHeight)
      );

      return Math.ceil(lineCount * lineHeight + padding);
    };

    const syncPortraitReference = () => {
      if (!identity || !portraitFrame) return;

      const token = ++portraitSyncToken;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (
            token !== portraitSyncToken ||
            !field.isConnected ||
            !identity.isConnected ||
            !portraitFrame.isConnected
          ) {
            return;
          }

          /*
           * Le portrait reste centré sur le bloc de référence :
           * titre Nom → bas du Concept replié à quatre lignes.
           * La mesure est refaite après le chargement des polices,
           * mais jamais à chaque caractère ni lors du dépliage.
           */
          const currentHeight = field.style.height;
          field.style.height = `${collapsedHeight}px`;

          const measuredHeight = Math.ceil(
            identity.getBoundingClientRect().height
          );

          if (measuredHeight > 0) {
            this._portraitReferenceHeight = measuredHeight;
            portraitFrame.style.height = `${measuredHeight}px`;
          }

          field.style.height =
            currentHeight || `${collapsedHeight}px`;
        });
      });
    };

    const applySize = () => {
      const fullHeight = measureFullHeight();
      const overflows = fullHeight > collapsedHeight + 2;

      toggle.hidden = !overflows;

      const targetHeight = this._conceptExpanded
        ? fullHeight
        : collapsedHeight;

      if (field.style.height !== `${targetHeight}px`) {
        field.style.height = `${targetHeight}px`;
      }

      field.classList.toggle(
        "is-expanded",
        this._conceptExpanded
      );
      toggle.setAttribute(
        "aria-expanded",
        String(this._conceptExpanded)
      );
      toggle.title = game.i18n.localize(
        this._conceptExpanded
          ? "ETC.Character.CollapseConcept"
          : "ETC.Character.ExpandConcept"
      );
      toggle.querySelector("i")?.classList.toggle(
        "fa-chevron-up",
        this._conceptExpanded
      );
      toggle.querySelector("i")?.classList.toggle(
        "fa-chevron-down",
        !this._conceptExpanded
      );
    };

    field.addEventListener("input", () => {
      this._conceptExpanded = true;
      applySize();
    });

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      this._conceptExpanded = !this._conceptExpanded;
      applySize();
    });

    applySize();
    syncPortraitReference();

    document.fonts?.ready
      ?.then(syncPortraitReference)
      .catch(() => {});
  }
}
