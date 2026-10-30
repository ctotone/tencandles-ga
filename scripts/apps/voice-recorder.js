/** Immersive, shared Ten Candles dictaphone window. */
import { VoiceCapture } from "../voice/recording.js";
import {
  MAX_VOICE_BYTES, MAX_VOICE_SECONDS, getCurrentVoiceMessages,
  getVoiceActorsForUser, hasLockedVoiceMessage
} from "../voice/storage.js";
import {
  uploadVoiceDraft, requestVoiceAdmin
} from "../voice/socket.js";
import { getVoicePlaylistState, controlVoicePlaylist } from "../voice/playlist-broadcast.js";
import { getCollectiveState, isActiveGM } from "../state/game-state.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const l = (key) => game.i18n.localize(`ETC.Voice.${key}`);
const GM_PRIVATE_PREVIEW_VOLUME = 0.6;
const format = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export class TenCandlesVoiceRecorder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tencandles-voice-recorder",
    classes: ["tencandles-ga", "etc-voice-recorder"],
    tag: "section",
    position: { width: 1070, height: 830 },
    window: { resizable: true, icon: "fa-solid fa-microphone-lines" }
  };
  static PARTS = {
    main: { template: "systems/tencandles-ga/templates/apps/voice-recorder.hbs" }
  };

  capture = new VoiceCapture();
  actorId = null;
  selectedRecordId = null;
  draft = null;
  draftURL = null;
  preview = null;
  gmPreview = null;
  gmPreviewRecordId = null;
  busy = false;
  recording = false;
  busyMessage = "";
  lastNotice = "";
  ticker = null;
  gameId = null;

  get title() { return l("Title"); }
  static open() {
    const active = [...this.instances()].find((instance) => instance.rendered);
    if (active) { active.bringToFront(); return active; }
    const instance = new this();
    instance.render(true);
    return instance;
  }
  static refreshAll() {
    for (const instance of this.instances()) {
      if (instance.rendered) instance.render();
    }
  }

  _discardDraft() {
    this._stopPreview();
    if (this.draftURL) URL.revokeObjectURL(this.draftURL);
    this.draftURL = null;
    this.draft = null;
  }
  _stopTicker() {
    globalThis.clearInterval(this.ticker);
    this.ticker = null;
  }
  _startTicker() {
    this._stopTicker();
    this.ticker = globalThis.setInterval(() => this._paintTimer(), 250);
  }
  _stopPreview() {
    this.preview?.pause();
    this.preview = null;
    if (!this.recording) this._stopTicker();
  }
  _stopGMPreview() {
    if (this.gmPreview) {
      this.gmPreview.pause();
      this.gmPreview.removeAttribute("src");
      this.gmPreview.load();
    }
    this.gmPreview = null;
    this.gmPreviewRecordId = null;
  }
  async _onClose(options) {
    this._stopGMPreview();
    this.capture.discard();
    this._stopTicker();
    this._discardDraft();
    await super._onClose(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const gameId = getCollectiveState().gameId;
    if (this.gameId && this.gameId !== gameId) {
      this._stopGMPreview();
      this.capture.discard();
      this._stopTicker();
      this._discardDraft();
      this.recording = false;
    }
    this.gameId = gameId;
    const isGM = game.user.isGM;
    const actorOptions = getVoiceActorsForUser();
    if (!isGM && !actorOptions.some((actor) => actor.id === this.actorId)) {
      const preferred = actorOptions.find((actor) => actor.id === game.user.character?.id);
      this.actorId = (preferred || actorOptions[0])?.id ?? null;
    }
    const records = getCurrentVoiceMessages();
    if (!records.some((record) => record.id === this.selectedRecordId && record.locked)) {
      this.selectedRecordId = records.find((record) => record.locked)?.id ?? null;
    }
    const locked = Boolean(!isGM && this.actorId && hasLockedVoiceMessage(this.actorId));
    // Explain unavailable transport controls instead of silently showing five disabled keys.
    // Permissions are unchanged: capture belongs to players; broadcast belongs to the active GM.
    const gmHint = isGM
      ? !isActiveGM() ? l("ActiveGMOnly")
        : records.some((record) => record.locked) ? l("GMReadyHint") : l("GMWaitingHint")
      : !gameId ? l("GameNotReady") : "";
    const localPreview = this.preview && !this.preview.paused;
    const playback = getVoicePlaylistState();
    const onAir = playback.state !== "idle";
    const canPlay = isGM
      ? Boolean(isActiveGM() && this.selectedRecordId && records.some((record) => record.id === this.selectedRecordId && record.locked))
      : Boolean(this.draft && !this.recording && !this.busy);
    const status = this.recording ? l("Recording") : this.busy ? (this.busyMessage || l("Saving"))
      : onAir && playback.state !== "idle" ? (playback.state === "pause" ? l("Paused") : playback.state === "playing" ? l("Playing") : l("Standby"))
      : this.gmPreview && !this.gmPreview.paused ? l("PrivatePreviewing")
      : localPreview ? l("Playing") : this.preview ? l("Paused") : locked ? l("Locked") : l("Standby");
    return {
      ...context,
      isGM, isActiveGM: isActiveGM(), canRecord: !isGM && !!gameId && !!this.actorId && !locked && !this.recording && !this.busy && !this.draft,
      canStop: isGM ? isActiveGM() && playback.state !== "idle" : this.recording || Boolean(this.preview),
      canPlay, canSave: !isGM && !!this.draft && !locked && !this.busy && !this.recording,
      canDelete: !isGM && Boolean(this.draft) && !this.busy && !this.recording,
      hasActors: actorOptions.length > 0, showActorSelector: actorOptions.length > 1,
      hasMessages: records.length > 0,
      locked, hasDraft: Boolean(this.draft), canCapture: !isGM && !locked,
      actorOptions: actorOptions.map((actor) => ({
        id: actor.id, name: actor.name, selected: actor.id === this.actorId
      })),
      duration: this.recording ? format((Date.now() - this.capture.startedAt) / 1000)
        : this.preview ? format(this.preview.currentTime || 0)
        : this.draft ? format(this.draft.duration) : "00:00",
      status, notice: this.lastNotice,
      limitLabel: `${format(MAX_VOICE_SECONDS)} / ${Math.round(MAX_VOICE_BYTES / 1024 / 1024)} Mo`,
      gmHint, playerHint: !isGM && !actorOptions.length ? l("NoCharacter") : !isGM ? gmHint : "",
      records: records.sort((a,b) => a.createdAt - b.createdAt).map((record) => ({
        id: record.id, actorName: record.actorName, duration: format(record.duration),
        status: record.locked ? l("Saved") : l("Unlocked"),
        selected: record.id === this.selectedRecordId,
        canManage: isGM && isActiveGM(),
        canPreview: isGM && record.locked,
        previewing: this.gmPreviewRecordId === record.id && !this.gmPreview?.paused,
        locked: record.locked
      }))
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-voice-actor]")?.addEventListener("change", (event) => {
      if (this.recording || this.busy) return;
      this._discardDraft();
      this.actorId = event.currentTarget.value;
      this.render();
    });
    for (const button of this.element.querySelectorAll("[data-voice-action]")) {
      button.addEventListener("click", (event) => void this._handleAction(event));
    }
    this._paintTimer();
  }

  _paintTimer() {
    if (!this.rendered) return;
    const time = this.element.querySelector("[data-voice-time]");
    if (!time) return;
    if (this.recording) time.textContent = format((Date.now() - this.capture.startedAt) / 1000);
    else if (this.preview) time.textContent = format(this.preview.currentTime || 0);
  }
  _setStatus(value) {
    this.lastNotice = value;
    const notice = this.rendered && this.element.querySelector("[data-voice-notice]");
    if (notice) notice.textContent = value;
  }
  async _confirm(key) {
    return DialogV2.confirm({ window: { title: l("Title") }, content: `<p>${l(key)}</p>` });
  }
  async _handleAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    if (button.disabled || this.busy) return;
    const action = button.dataset.voiceAction;
    try {
      if (action === "record") await this._startRecording();
      else if (action === "stop") await this._stop();
      else if (action === "play") await this._play();
      else if (action === "save") await this._save();
      else if (action === "delete-draft") { this._discardDraft(); this._setStatus(""); this.render(); }
      else if (action === "play-record") await this._playRecord(button.dataset.recordId);
      else if (action === "preview-record") await this._previewRecord(button.dataset.recordId);
      else if (action === "delete-record") await this._deleteRecord(button.dataset.recordId);
    } catch (error) {
      console.error("tencandles-ga | Dictaphone:", error);
      const key = {
        NotAllowedError: "MicroDenied",
        NotFoundError: "MicroMissing",
        NotReadableError: "MicroUnavailable",
        SecurityError: "MicroDenied"
      }[error?.name];
      ui.notifications.error(key ? l(key) : `${l("Error")}: ${error.message}`);
      this._setStatus(l("Error"));
      this.render();
    }
  }

  async _startRecording() {
    if (game.user.isGM || !this.actorId || this.draft || hasLockedVoiceMessage(this.actorId)) return;
    this.busy = true;
    this.busyMessage = l("MicroRequest");
    this.render();
    try {
      await this.capture.start(() => { void this._stop(); });
      if (!this.rendered) { this.capture.discard(); return; }
      this.recording = true;
      this._setStatus("");
      this._startTicker();
    } finally {
      this.busy = false;
      if (this.rendered) this.render();
    }
  }
  async _stop() {
    if (this.recording) {
      this.recording = false;
      this._stopTicker();
      const draft = await this.capture.stop();
      if (draft) {
        this._discardDraft();
        this.draft = draft;
        this.draftURL = URL.createObjectURL(draft.blob);
        this._setStatus(l("DraftReady"));
      }
    } else if (game.user.isGM) {
      if (isActiveGM()) await controlVoicePlaylist("stop");
    } else {
      this._stopPreview();
      if (this.draft) this._setStatus(l("DraftReady"));
    }
    this.render();
  }
  async _play() {
    if (game.user.isGM) {
      if (!isActiveGM()) return;
      const playing = getVoicePlaylistState();
      if (playing.recordId === this.selectedRecordId && playing.state === "playing") await controlVoicePlaylist("pause");
      else if (playing.recordId === this.selectedRecordId && playing.state === "pause") await controlVoicePlaylist("resume");
      else await this._playRecord(this.selectedRecordId);
      this.render();
      return;
    }
    if (!this.draftURL || this.recording) return;
    if (this.preview && !this.preview.paused) {
      this.preview.pause();
      this._stopTicker();
    } else {
      if (!this.preview) {
        this.preview = new Audio(this.draftURL);
        this.preview.addEventListener("ended", () => { this._stopPreview(); this.render(); });
      }
      await this.preview.play();
      this._startTicker();
    }
    this.render();
  }
  async _playRecord(recordId) {
    if (!game.user.isGM || !isActiveGM()) return;
    const record = getCurrentVoiceMessages().find((item) => item.id === recordId && item.locked);
    if (!record) return;
    this.selectedRecordId = record.id;
    this._stopGMPreview();
    await controlVoicePlaylist("play", record);
    this.render();
  }
  async _previewRecord(recordId) {
    if (!game.user.isGM) return;
    const record = getCurrentVoiceMessages().find((item) => item.id === recordId && item.locked);
    if (!record) return;
    if (this.gmPreviewRecordId === recordId && this.gmPreview) {
      // Click again to stop the local preview, never broadcast a socket event.
      this._stopGMPreview();
      this.render();
      return;
    }
    this._stopGMPreview();
    const audio = new Audio(record.path);
    audio.volume = GM_PRIVATE_PREVIEW_VOLUME;
    this.gmPreview = audio;
    this.gmPreviewRecordId = recordId;
    audio.addEventListener("ended", () => {
      if (this.gmPreview === audio) { this._stopGMPreview(); if (this.rendered) this.render(); }
    });
    audio.addEventListener("error", () => {
      if (this.gmPreview === audio) {
        this._stopGMPreview();
        ui.notifications.warn(l("AudioUnavailable"));
        if (this.rendered) this.render();
      }
    });
    try { await audio.play(); }
    catch (error) { this._stopGMPreview(); throw error; }
    this.render();
  }
  async _save() {
    if (game.user.isGM || !this.draft || !this.actorId || hasLockedVoiceMessage(this.actorId)) return;
    if (!await this._confirm("ConfirmSave")) return;
    this._stopPreview();
    this.busy = true;
    this.busyMessage = l("Saving");
    this.render();
    try {
      await uploadVoiceDraft(this.actorId, this.draft.blob, this.draft.duration,
        (percent) => this._setStatus(`${l("Saving")} ${percent}%`));
      this._discardDraft();
      this._setStatus(l("SavedSuccessfully"));
      ui.notifications.info(l("SavedSuccessfully"));
    } finally {
      this.busy = false;
      this.render();
    }
  }
  async _deleteRecord(recordId) {
    if (!game.user.isGM || !isActiveGM()) return;
    const record = getCurrentVoiceMessages().find((item) => item.id === recordId);
    if (!record) return;
    if (!await this._confirm("ConfirmDelete")) return;
    this.busy = true;
    this.render();
    try {
      await requestVoiceAdmin("delete", recordId);
      if (getVoicePlaylistState().recordId === recordId) {
        await controlVoicePlaylist("stop");
      }
      if (this.gmPreviewRecordId === recordId) this._stopGMPreview();
      this._setStatus(l("Deleted"));
    } finally {
      this.busy = false;
      this.render();
    }
  }
}

// Native Playlist hooks keep the dictaphone's transport state in sync with
// playback/volume changes initiated in Foundry's own Playlists sidebar.
for (const eventName of ["createPlaylistSound", "updatePlaylistSound", "deletePlaylistSound", "deletePlaylist"]) {
  Hooks.on(eventName, (document) => {
    if (document?.getFlag?.("tencandles-ga", "lastMessagesTrack") ||
        document?.parent?.getFlag?.("tencandles-ga", "lastMessagesPlaylist") ||
        document?.getFlag?.("tencandles-ga", "lastMessagesPlaylist")) {
      TenCandlesVoiceRecorder.refreshAll();
    }
  });
}
