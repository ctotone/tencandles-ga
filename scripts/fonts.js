/**
 * Enregistrement des polices locales utilisées par le système auprès de Foundry.
 */

import { SYSTEM_ID } from "./constants.js";

export const SCENE_TITLE_FONT_FAMILY = "special-elite";
export const BODY_FONT_FAMILY = "courier-prime";

export const SCENE_TITLE_FONT_URL =
  `systems/${SYSTEM_ID}/fonts/special-elite.woff2`;

export const BODY_FONT_URL =
  `systems/${SYSTEM_ID}/fonts/courier-prime.woff2`;

function registerFontFamily(family, url) {
  CONFIG.fontDefinitions[family] = {
    editor: true,
    fonts: [
      {
        urls: [url],
        weight: 400,
        style: "normal"
      }
    ]
  };
}

export function registerSystemFonts() {
  registerFontFamily(
    SCENE_TITLE_FONT_FAMILY,
    SCENE_TITLE_FONT_URL
  );

  registerFontFamily(
    BODY_FONT_FAMILY,
    BODY_FONT_URL
  );
}
