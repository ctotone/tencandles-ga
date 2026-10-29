/** Metadata only. Audio bytes live in Foundry's persistent package storage. */
import { SYSTEM_ID } from "../constants.js";
import { getCollectiveState, isActiveGM } from "../state/game-state.js";

export const VOICE_REGISTRY_KEY = "voiceMessages";
export const VOICE_CHANGED_HOOK = `${SYSTEM_ID}.voiceMessagesChanged`;
export const MAX_VOICE_SECONDS = 120;
export const MAX_VOICE_BYTES = 6 * 1024 * 1024;

export function registerVoiceRegistry() {
  game.settings.register(SYSTEM_ID, VOICE_REGISTRY_KEY, {
    name: "ETC.Voice.Title", scope: "world", config: false,
    type: Object, default: { version: 1, messages: [] },
    onChange: () => Hooks.callAll(VOICE_CHANGED_HOOK)
  });
}

export function readVoiceRegistry() {
  const current = game.settings.get(SYSTEM_ID, VOICE_REGISTRY_KEY);
  return {
    version: 1,
    messages: Array.isArray(current?.messages)
      ? foundry.utils.deepClone(current.messages) : []
  };
}

export function getCurrentVoiceMessages() {
  const gameId = getCollectiveState().gameId;
  return gameId
    ? readVoiceRegistry().messages.filter((message) => message.gameId === gameId)
    : [];
}

export async function saveVoiceRegistry(messages) {
  if (!isActiveGM()) throw new Error("Only the active GM may save voice metadata");
  await game.settings.set(SYSTEM_ID, VOICE_REGISTRY_KEY, { version: 1, messages });
}

export function eligibleVoiceActor(actor, user) {
  return Boolean(actor?.type === "character" && user &&
    (user.isGM || actor.testUserPermission(user, "OWNER")));
}

export function getVoiceActorsForUser(user = game.user) {
  if (user?.isGM) return [];
  return game.actors.filter((actor) => eligibleVoiceActor(actor, user));
}

export function hasLockedVoiceMessage(actorId, gameId = getCollectiveState().gameId) {
  return readVoiceRegistry().messages.some((record) =>
    record.gameId === gameId && record.actorId === actorId && record.locked);
}
