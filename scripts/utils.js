/**
 * Fonctions génériques partagées par les premières briques de candle-roll.
 */

export function clone(value) {
  return foundry.utils.deepClone(value);
}

export function clampInteger(value, minimum, maximum) {
  const numericValue = Number(value);
  const integerValue = Number.isFinite(numericValue)
    ? Math.trunc(numericValue)
    : minimum;

  return Math.min(maximum, Math.max(minimum, integerValue));
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function readDialogForm(button) {
  const form = button?.form;

  if (!(form instanceof HTMLFormElement)) {
    throw new Error(
      game.i18n.localize("ETC.Errors.DialogFormMissing")
    );
  }

  const getElement = (name) => {
    const element = form.elements.namedItem(name);

    if (!element) {
      throw new Error(
        game.i18n.format("ETC.Errors.DialogFieldMissing", { name })
      );
    }

    return element;
  };

  return {
    getValue: (name) => String(getElement(name).value ?? "")
  };
}
