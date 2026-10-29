/** Browser-local audio player controlled by GM network events. */
import { getCollectiveState } from "../state/game-state.js";

let current = null;
let currentRevision = 0;
let controllerEpoch = null;
let controllerStartedAt = 0;
let controllerGM = null;
let currentBroadcastId = null;
let updateListener = null;

export function onPlaybackUpdate(listener) { updateListener = listener; }
export function getPlaybackState() {
  return { id: currentBroadcastId, state: current?.paused ? "pause" : current ? "playing" : "idle" };
}
function changed() { updateListener?.(); }
function stopAudio() {
  const old = current;
  current = null;
  if (!old) return;
  old.pause();
  old.removeAttribute("src");
  old.load();
}

export async function handleVoicePlayback(data) {
  if (!data || data.gameId !== getCollectiveState().gameId) return;
  const activeGM = game.users?.activeGM;
  if (!activeGM?.isGM || data.gmId !== activeGM.id) return;
  if (!Number.isSafeInteger(data.revision) || data.revision < 1) return;
  if (typeof data.epoch !== "string" ||
      !Number.isSafeInteger(data.epochStartedAt)) return;
  if (data.gmId !== controllerGM || data.epoch !== controllerEpoch) {
    // A reconnecting or newly active GM begins a fresh command sequence.
    // Ignore delayed packets from the old browser session of the same GM.
    if (data.gmId === controllerGM && data.epochStartedAt < controllerStartedAt) return;
    stopAudio();
    currentBroadcastId = null;
    currentRevision = 0;
    controllerEpoch = data.epoch;
    controllerStartedAt = data.epochStartedAt;
    controllerGM = data.gmId;
  }
  if (data.revision <= currentRevision) return;
  if (!["play", "pause", "resume", "stop"].includes(data.action)) return;
  if (data.action !== "play" && data.broadcastId !== currentBroadcastId) return;
  currentRevision = data.revision;

  if (data.action === "play") {
    if (!data.broadcastId || typeof data.path !== "string" || !(/^(?:\/)?storage\//.test(data.path))) return;
    stopAudio();
    currentBroadcastId = data.broadcastId;
    const audio = new Audio(data.path);
    current = audio;
    audio.addEventListener("ended", () => { if (current === audio) { stopAudio(); changed(); } });
    audio.addEventListener("error", () => {
      if (current === audio) {
        console.warn("tencandles-ga | Cannot load voice audio", audio.error);
        stopAudio(); changed();
        ui.notifications.warn(game.i18n.localize("ETC.Voice.AudioUnavailable"));
      }
    });
    try { await audio.play(); }
    catch (_error) {
      ui.notifications.warn(game.i18n.localize("ETC.Voice.AudioBlocked"));
      // Keep selected track paused so a later GM resume can retry playback.
    }
  } else if (data.action === "pause") {
    current?.pause();
  } else if (data.action === "resume") {
    try { await current?.play(); }
    catch (_error) { ui.notifications.warn(game.i18n.localize("ETC.Voice.AudioBlocked")); }
  } else if (data.action === "stop") {
    stopAudio();
    currentBroadcastId = null;
  }
  changed();
}

export function clearPreviousGamePlayback() {
  stopAudio();
  currentBroadcastId = null;
  currentRevision = 0;
  controllerEpoch = null;
  controllerStartedAt = 0;
  controllerGM = null;
  changed();
}
