/** Bounded, acknowledged client -> active-GM transport, plus distributed playback. */
import { SOCKET_NAME, SYSTEM_ID } from "../constants.js";
import { getCollectiveState, isActiveGM } from "../state/game-state.js";
import {
  eligibleVoiceActor, readVoiceRegistry, saveVoiceRegistry,
  MAX_VOICE_BYTES, MAX_VOICE_SECONDS
} from "./storage.js";
import { handleVoicePlayback, getPlaybackState } from "./playback.js";

const CHUNK_BYTES = 24 * 1024;
const SESSION_TTL = 120_000;
const pending = new Map();
const sessions = new Map();
const completed = new Map();
let gmBusy = false;
let playbackRevision = 0;
let broadcastId = null;

const now = () => Date.now();
const randomId = () => foundry.utils.randomID();
const playbackEpoch = randomId();
const playbackStartedAt = now();

function reply(to, correlation, ok, result = {}) {
  const response = { type: "voice:reply", from: game.user.id, to, correlation, ok, result };
  if (to === game.user.id) receiveReply(response);
  else game.socket.emit(SOCKET_NAME, response);
}

function receiveReply(data) {
  if (data.to !== game.user.id) return;
  // An acknowledgement is only valid from the currently connected active GM.
  const item = pending.get(data.correlation);
  if (!item || data.from !== game.users?.activeGM?.id) return;
  pending.delete(data.correlation);
  globalThis.clearTimeout(item.timer);
  if (data.ok) item.resolve(data.result);
  else item.reject(new Error(data.result?.error || "Voice request rejected"));
}

function sendPacket(data) {
  if (isActiveGM() && data.type === "voice:request") {
    void receiveGMRequest(data);
  } else {
    game.socket.emit(SOCKET_NAME, data);
  }
}

function request(action, payload = {}, timeout = 9000) {
  if (!game.users?.activeGM) return Promise.reject(new Error(game.i18n.localize("ETC.Voice.NoGM")));
  const correlation = randomId();
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      pending.delete(correlation);
      reject(new Error(game.i18n.localize("ETC.Voice.NetworkTimeout")));
    }, timeout);
    pending.set(correlation, { timer, resolve, reject });
    sendPacket({ type: "voice:request", action, payload,
      userId: game.user.id, correlation });
  });
}

function cleanupOld() {
  for (const [id, session] of sessions) {
    if (now() - session.updatedAt > SESSION_TTL) sessions.delete(id);
  }
  for (const [id, item] of completed) {
    if (now() - item.when > SESSION_TTL) completed.delete(id);
  }
}

function currentGameId() { return getCollectiveState().gameId; }
function senderActor(userId, actorId) {
  const user = game.users.get(userId);
  const actor = game.actors.get(actorId);
  if (!user?.active || !eligibleVoiceActor(actor, user)) {
    throw new Error("Character ownership or user session invalid");
  }
  return actor;
}
function validHeader(payload) {
  if (typeof payload.gameId !== "string" || !payload.gameId || payload.gameId !== currentGameId()) throw new Error("Outdated or uninitialized game");
  if (!Number.isSafeInteger(payload.size) || payload.size < 1 || payload.size > MAX_VOICE_BYTES) {
    throw new Error("Audio too large or empty");
  }
  if (!Number.isFinite(payload.duration) || payload.duration <= 0 || payload.duration > MAX_VOICE_SECONDS + 2) {
    throw new Error("Invalid recording duration");
  }
  if (!/^(audio\/webm|audio\/ogg|audio\/mp4)(;codecs=[a-z0-9,.-]+)?$/i.test(payload.mime)) {
    throw new Error("Unsupported audio encoding");
  }
}
function lockedByAnother(registry, gameId, actorId) {
  return registry.messages.some((record) => record.gameId === gameId &&
    record.actorId === actorId && record.locked);
}
function fileExtension(mime) {
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("audio/mp4")) return "m4a";
  return "webm";
}

async function saveFinishedSession(session) {
  if (gmBusy) throw new Error("Another upload is being committed; retry in a moment");
  gmBusy = true;
  try {
    if (!isActiveGM() || session.gameId !== currentGameId()) throw new Error("Game changed or GM unavailable");
    const actor = senderActor(session.userId, session.actorId);
    const registry = readVoiceRegistry();
    if (lockedByAnother(registry, session.gameId, actor.id)) throw new Error("Message already locked");
    const bytes = session.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (bytes !== session.size || session.nextSequence !== Math.ceil(session.size / CHUNK_BYTES)) {
      throw new Error("Incomplete upload");
    }
    const fileName = `last-message-${session.gameId}-${actor.id}-${randomId()}.${fileExtension(session.mime)}`;
    const file = new File(session.chunks, fileName, { type: session.mime });
    const picker = foundry.applications.apps.FilePicker;
    const uploaded = await picker.uploadPersistent(SYSTEM_ID, "", file, {}, { notify: false });
    const path = uploaded?.path;
    if (typeof path !== "string" || !path) {
      // Foundry may return no path when the package's /storage folder is absent.
      throw new Error("Foundry did not return an upload path; check that systems/tencandles-ga/storage exists and is writable on the server");
    }
    if (!isActiveGM() || session.gameId !== currentGameId()) throw new Error("Game changed during upload");
    const latest = readVoiceRegistry();
    if (lockedByAnother(latest, session.gameId, actor.id)) throw new Error("Message saved by another session");
    const record = {
      id: randomId(), gameId: session.gameId,
      actorId: actor.id, userId: session.userId, actorName: actor.name,
      path, mime: session.mime, duration: session.duration,
      createdAt: now(), locked: true
    };
    // Replace the previous unlocked entry; archival files remain stored on the server.
    latest.messages = latest.messages.filter((entry) =>
      !(entry.gameId === session.gameId && entry.actorId === actor.id));
    latest.messages.push(record);
    await saveVoiceRegistry(latest.messages);
    return { id: record.id, actorName: record.actorName };
  } finally { gmBusy = false; }
}

async function handleAdmin(data) {
  const user = game.users.get(data.userId);
  if (!user?.active || !user.isGM) throw new Error("GM only");
  const { recordId, mode, gameId } = data.payload ?? {};
  if (gameId !== currentGameId() || !["unlock", "delete"].includes(mode)) throw new Error("Invalid operation");
  const registry = readVoiceRegistry();
  const record = registry.messages.find((item) => item.id === recordId && item.gameId === gameId);
  if (!record) throw new Error("Message does not exist");
  if (mode === "delete") {
    registry.messages = registry.messages.filter((item) => item.id !== recordId);
  } else {
    record.locked = false;
  }
  await saveVoiceRegistry(registry.messages);
  return { mode };
}

async function handleGMRequest(data) {
  if (!isActiveGM()) return;
  cleanupOld();
  const { userId, payload = {} } = data;
  const user = game.users.get(userId);
  if (!user?.active) throw new Error("Inactive or unknown user");
  switch (data.action) {
    case "begin": {
      validHeader(payload);
      const actor = senderActor(userId, payload.actorId);
      const registry = readVoiceRegistry();
      if (lockedByAnother(registry, payload.gameId, actor.id)) throw new Error("Message already locked");
      if ([...sessions.values()].some((item) => item.gameId === payload.gameId && item.actorId === actor.id)) {
        throw new Error("This actor already has an upload in progress");
      }
      if (sessions.size >= 8) throw new Error("Too many simultaneous uploads");
      const token = randomId();
      sessions.set(token, {
        userId, actorId: actor.id, gameId: payload.gameId,
        size: payload.size, duration: payload.duration, mime: payload.mime,
        chunks: [], nextSequence: 0, updatedAt: now()
      });
      return { token };
    }
    case "chunk": {
      const session = sessions.get(payload.token);
      if (!session || session.userId !== userId || session.gameId !== currentGameId()) throw new Error("Unknown upload session");
      if (payload.sequence !== session.nextSequence || typeof payload.data !== "string" ||
          payload.data.length > 32768 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(payload.data)) {
        throw new Error("Invalid upload fragment");
      }
      const raw = atob(payload.data);
      const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
      const cumulative = session.chunks.reduce((total, item) => total + item.length, 0) + bytes.length;
      if (!bytes.length || bytes.length > CHUNK_BYTES || cumulative > session.size) throw new Error("Upload overflow");
      session.chunks.push(bytes);
      session.nextSequence += 1;
      session.updatedAt = now();
      return { sequence: payload.sequence };
    }
    case "finish": {
      const complete = completed.get(payload.token);
      if (complete && complete.userId === userId) return complete.result;
      const session = sessions.get(payload.token);
      if (!session || session.userId !== userId) throw new Error("Unknown upload session");
      try {
        const result = await saveFinishedSession(session);
        completed.set(payload.token, { userId, result, when: now() });
        sessions.delete(payload.token);
        return result;
      } catch (error) {
        sessions.delete(payload.token);
        throw error;
      }
    }
    case "cancel": {
      const session = sessions.get(payload.token);
      if (session?.userId === userId) sessions.delete(payload.token);
      return {};
    }
    case "admin": return handleAdmin(data);
    default: throw new Error("Unknown voice action");
  }
}

async function receiveGMRequest(data) {
  try {
    const result = await handleGMRequest(data);
    if (result !== undefined) reply(data.userId, data.correlation, true, result);
  } catch (error) {
    console.error(`${SYSTEM_ID} | Voice request rejected:`, error);
    reply(data.userId, data.correlation, false, { error: error.message });
  }
}

export function onVoiceSocketMessage(data) {
  if (!data || typeof data !== "object") return;
  if (data.type === "voice:reply") { receiveReply(data); return; }
  if (data.type === "voice:playback") { void handleVoicePlayback(data); return; }
  if (data.type === "voice:request" && isActiveGM()) void receiveGMRequest(data);
}

export async function uploadVoiceDraft(actorId, blob, duration, onProgress) {
  if (!blob || blob.size < 1 || blob.size > MAX_VOICE_BYTES) throw new Error(game.i18n.localize("ETC.Voice.InvalidAudio"));
  const mime = blob.type;
  const gameId = currentGameId();
  const { token } = await request("begin", { actorId, size: blob.size, duration, mime, gameId });
  try {
    let offset = 0;
    let sequence = 0;
    while (offset < blob.size) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      await request("chunk", { token, sequence, data: btoa(binary) }, 10000);
      offset += bytes.length;
      sequence += 1;
      onProgress?.(Math.round(100 * offset / blob.size));
    }
    return await request("finish", { token }, 60000);
  } catch (error) {
    void request("cancel", { token }).catch(() => {});
    throw error;
  }
}

export function requestVoiceAdmin(mode, recordId) {
  if (!game.user.isGM) throw new Error("GM only");
  return request("admin", { mode, recordId, gameId: currentGameId() });
}

export function broadcastVoiceControl(action, record = null) {
  if (!isActiveGM()) throw new Error(game.i18n.localize("ETC.Voice.ActiveGMOnly"));
  if (!["play", "pause", "resume", "stop"].includes(action)) throw new Error("Invalid playback action");
  if (action === "play") {
    if (!record || !record.locked || record.gameId !== currentGameId()) throw new Error("Invalid message");
    broadcastId = randomId();
  } else if (!broadcastId) return;
  const data = {
    type: "voice:playback", action, gameId: currentGameId(),
    gmId: game.user.id, broadcastId,
    epoch: playbackEpoch, epochStartedAt: playbackStartedAt,
    revision: ++playbackRevision,
    ...(action === "play" ? { path: record.path } : {})
  };
  // Apply locally as Socket.IO may not relay the sender's broadcast back.
  void handleVoicePlayback(data);
  game.socket.emit(SOCKET_NAME, data);
  if (action === "stop") broadcastId = null;
}

export function getVoiceBroadcastId() { return broadcastId; }

export function resetVoiceBroadcastForNewGame() {
  broadcastId = null;
  playbackRevision = 0;
  sessions.clear();
}
