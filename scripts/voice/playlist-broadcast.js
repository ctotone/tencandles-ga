/**
 * Native Foundry v14 Playlist playback for the final messages.
 * Only the active GM changes Playlist documents. PlaylistSound updates are
 * propagated by Foundry itself, including the native live volume slider.
 * Preview is deliberately NOT implemented here: preview stays browser-local.
 */
import { SYSTEM_ID } from "../constants.js";
import { getCollectiveState, isActiveGM } from "../state/game-state.js";

const PLAYLIST_FLAG = "lastMessagesPlaylist";
const SOUND_FLAG = "lastMessagesTrack";

const currentGameId = () => getCollectiveState().gameId;
const isOwnedPlaylist = (playlist) => playlist?.getFlag(SYSTEM_ID, PLAYLIST_FLAG) === true;

function managedPlaylist() {
  return game.playlists?.find(isOwnedPlaylist) ?? null;
}

function managedTrack(playlist) {
  return playlist?.sounds?.find((sound) => sound.getFlag(SYSTEM_ID, SOUND_FLAG) === true) ?? null;
}

export function getVoicePlaylistState() {
  const sound = managedTrack(managedPlaylist());
  if (!sound || sound.getFlag(SYSTEM_ID, "voiceGameId") !== currentGameId()) {
    return { state: "idle", recordId: null };
  }
  return {
    state: sound.playing ? "playing" : (sound.pausedTime > 0 ? "pause" : "idle"),
    recordId: sound.getFlag(SYSTEM_ID, "voiceRecordId") ?? null
  };
}

async function ensurePlaylist() {
  const existing = managedPlaylist();
  if (existing) return existing;
  return foundry.documents.Playlist.create({
    name: game.i18n.localize("ETC.Voice.PlaylistName"),
    mode: CONST.PLAYLIST_MODES.DISABLED, // soundboard: never auto-chain recordings
    channel: "music", fade: 0,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    flags: { [SYSTEM_ID]: { [PLAYLIST_FLAG]: true } }
  });
}

/** A single reusable track preserves the GM's manual volume setting. */
async function ensureTrack(playlist, record) {
  let sound = managedTrack(playlist);
  const attributes = {
    name: record.actorName,
    path: record.path,
    repeat: false,
    fade: 0,
    channel: "music",
    pausedTime: 0,
    playing: false,
    flags: { [SYSTEM_ID]: {
      [SOUND_FLAG]: true,
      voiceGameId: record.gameId,
      voiceRecordId: record.id
    } }
  };
  if (sound) {
    // Native playlist updates are broadcast by Foundry; never update volume here.
    await sound.update(attributes);
    return sound;
  }
  const documents = await playlist.createEmbeddedDocuments("PlaylistSound", [
    { ...attributes, volume: 0.8 }
  ]);
  sound = documents[0];
  if (!sound) throw new Error("Foundry did not create the voice playlist track");
  return sound;
}

/** Public broadcast actions always use Foundry's own Playlist documents. */
export async function controlVoicePlaylist(action, record = null) {
  if (!isActiveGM()) throw new Error(game.i18n.localize("ETC.Voice.ActiveGMOnly"));
  if (!["play", "pause", "resume", "stop"].includes(action)) throw new Error("Invalid voice playlist action");
  if (action === "play") {
    // The stored path comes directly from FilePicker.uploadPersistent on the
    // active GM. Keep that exact path: Foundry's response does not guarantee a
    // leading "storage/" segment (and local preview already uses this URL).
    if (!record?.locked || record.gameId !== currentGameId() ||
        typeof record.path !== "string" || !record.path.trim()) {
      throw new Error("Invalid voice message");
    }
    const playlist = await ensurePlaylist();
    // Only this plugin's track is stopped. Never touch a user's other playlists.
    const previous = managedTrack(playlist);
    if (previous?.playing || previous?.pausedTime > 0) await playlist.stopSound(previous);
    const sound = await ensureTrack(playlist, record);
    await playlist.playSound(sound);
    return;
  }
  const playlist = managedPlaylist();
  const sound = managedTrack(playlist);
  if (!sound || sound.getFlag(SYSTEM_ID, "voiceGameId") !== currentGameId()) return;
  if (action === "stop") {
    await playlist.stopSound(sound);
  } else if (action === "pause" && sound.playing) {
    const seconds = Number(sound.sound?.currentTime);
    // PlaylistSound's pausedTime is synchronized as a Document field.
    await sound.update({ playing: false, pausedTime: Number.isFinite(seconds) ? Math.max(seconds, 0.01) : 0.01 });
  } else if (action === "resume" && !sound.playing && sound.pausedTime > 0) {
    await sound.update({ playing: true });
  }
}

/** Called on a new-game transition; never deletes any archived recording. */
export async function stopPreviousGameVoicePlaylist() {
  if (!isActiveGM()) return;
  const playlist = managedPlaylist();
  const sound = managedTrack(playlist);
  if (sound && (sound.playing || sound.pausedTime > 0)) await playlist.stopSound(sound);
}
