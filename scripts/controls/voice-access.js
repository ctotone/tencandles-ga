/** Players and GMs share this entry point; GM console remains untouched. */
import { SYSTEM_ID } from "../constants.js";
import { TenCandlesVoiceRecorder } from "../apps/voice-recorder.js";
const ID = `${SYSTEM_ID}-actor-directory-voice-access`;

export function mountVoiceActorDirectoryButton(application, element) {
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root) return;
  const isActorDirectory = application?.constructor?.name === "ActorDirectory"
    || application?.tabName === "actors" || application?.options?.documentName === "Actor";
  if (!isActorDirectory || root.querySelector(`#${ID}`)) return;
  const list = root.matches?.(".directory-list") ? root : root.querySelector(".directory-list");
  if (!list?.parentElement) return;
  const holder = document.createElement("div");
  holder.id = ID;
  holder.className = "etc-voice-directory-access";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "etc-voice-directory-access__button";
  button.textContent = game.i18n.localize("ETC.Voice.Title");
  button.setAttribute("aria-label", button.textContent);
  button.title = button.textContent;
  button.addEventListener("click", () => TenCandlesVoiceRecorder.open());
  holder.append(button);
  list.before(holder);
}
