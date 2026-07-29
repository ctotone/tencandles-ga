import {
  INSTANT_STATUSES
} from "../constants.js";

const DEFAULT_RESOURCE_ORDER = Object.freeze([
  "virtue",
  "vice",
  "moment"
]);

/**
 * Modèle de données de l'unique type d'Actor de la V1.
 *
 * La phase 9 bis introduit trois états explicites pour l'Instant. La Limite
 * reste une donnée calculée : elle n'est jamais enregistrée dans l'Actor.
 */
export class TenCandlesCharacterData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      BooleanField,
      SchemaField,
      StringField
    } = foundry.data.fields;

    const narrativeText = (
      label,
      hint,
      initial = ""
    ) =>
      new StringField({
        required: true,
        nullable: false,
        blank: true,
        trim: true,
        initial,
        label,
        hint
      });

    const narrativeResource = ({
      label,
      hint,
      initiallyAvailable = true,
      initialText = ""
    }) =>
      new SchemaField({
        text: narrativeText(label, hint, initialText),
        available: new BooleanField({
          required: true,
          nullable: false,
          initial: initiallyAvailable
        })
      });

    return {
      concept: narrativeText(
        "ETC.Character.Concept",
        "ETC.Character.ConceptHint"
      ),

      vice: narrativeResource({
        label: "ETC.Character.Vice",
        hint: "ETC.Character.ViceHint",
        initialText: game.i18n.localize(
          "ETC.Character.VicePlaceholder"
        )
      }),

      virtue: narrativeResource({
        label: "ETC.Character.Virtue",
        hint: "ETC.Character.VirtueHint",
        initialText: game.i18n.localize(
          "ETC.Character.VirtuePlaceholder"
        )
      }),

      moment: new SchemaField({
        text: narrativeText(
          "ETC.Character.Moment",
          "ETC.Character.MomentHint",
          game.i18n.localize(
            "ETC.Character.MomentPlaceholder"
          )
        ),
        status: new StringField({
          required: true,
          nullable: false,
          blank: false,
          initial: INSTANT_STATUSES.IDLE,
          choices: Object.values(INSTANT_STATUSES)
        })
      }),

      brink: new SchemaField({
        text: narrativeText(
          "ETC.Character.Brink",
          "ETC.Character.BrinkHint",
          game.i18n.localize(
            "ETC.Character.BrinkPlaceholder"
          )
        )
      }),

      resourceOrder: new StringField({
        required: true,
        nullable: false,
        blank: false,
        initial: DEFAULT_RESOURCE_ORDER.join(",")
      })
    };
  }

  get viceConsumed() {
    return !this.vice.available;
  }

  get virtueConsumed() {
    return !this.virtue.available;
  }

  get momentStatus() {
    return Object.values(INSTANT_STATUSES).includes(
      this.moment.status
    )
      ? this.moment.status
      : INSTANT_STATUSES.IDLE;
  }

  get momentAttempted() {
    return this.momentStatus !== INSTANT_STATUSES.IDLE;
  }

  get hopeDieAvailable() {
    return this.momentStatus === INSTANT_STATUSES.SUCCESS;
  }

  /**
   * La Limite devient disponible lorsque Vice et Vertu sont brûlés et que
   * l'Instant a été résolu, que son issue soit une réussite ou un échec.
   */
  get brinkAvailable() {
    return Boolean(
      this.viceConsumed &&
      this.virtueConsumed &&
      this.momentAttempted
    );
  }

  get resourceOrderList() {
    const requested = String(this.resourceOrder ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => DEFAULT_RESOURCE_ORDER.includes(entry));

    return [
      ...new Set([
        ...requested,
        ...DEFAULT_RESOURCE_ORDER
      ])
    ].slice(0, DEFAULT_RESOURCE_ORDER.length);
  }
}
