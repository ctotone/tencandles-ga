/** Local, opt-in microphone capture. Never opens the microphone by itself. */
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "./storage.js";

const MIME_CHOICES = [
  "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4",
  "audio/webm", "audio/ogg"
];

export class VoiceCapture {
  recorder = null;
  stream = null;
  chunks = [];
  startedAt = 0;
  timer = null;
  stopPromise = null;
  onLimit = null;

  async start(onLimit) {
    if (this.recorder) throw new Error("Already recording");
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      throw new Error("Unsupported microphone or insecure origin (HTTPS required)");
    }
    this.onLimit = onLimit;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      const mimeType = MIME_CHOICES.find((value) => MediaRecorder.isTypeSupported(value));
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.startedAt = Date.now();
      this.recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) this.chunks.push(event.data);
        if (this.chunks.reduce((sum, item) => sum + item.size, 0) > MAX_VOICE_BYTES) {
          this.onLimit?.();
        }
      });
      this.recorder.addEventListener("stop", () => {
        if (this.recorder && !this.stopPromise) this.onLimit?.("interrupted");
      });
      this.stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (this.recorder?.state === "recording") this.onLimit?.("interrupted");
        }, { once: true });
      });
      this.recorder.start(500);
      this.timer = globalThis.setTimeout(() => this.onLimit?.(), MAX_VOICE_SECONDS * 1000);
    } catch (error) {
      this.release();
      this.recorder = null;
      throw error;
    }
  }

  async stop() {
    if (this.stopPromise) return this.stopPromise;
    const recorder = this.recorder;
    if (!recorder) return null;
    this.stopPromise = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", () => {
        const elapsed = Math.min(MAX_VOICE_SECONDS, (Date.now() - this.startedAt) / 1000);
        const blob = new Blob(this.chunks, { type: recorder.mimeType || this.chunks[0]?.type || "" });
        this.release();
        this.recorder = null;
        this.stopPromise = null;
        this.chunks = [];
        if (!blob.size || blob.size > MAX_VOICE_BYTES) reject(new Error("Invalid audio size"));
        else resolve({ blob, duration: elapsed });
      }, { once: true });
      recorder.addEventListener("error", () => {
        this.release(); this.recorder = null; this.stopPromise = null;
        reject(new Error("Microphone recorder error"));
      }, { once: true });
      try {
        if (recorder.state === "inactive") throw new Error("Microphone recorder interrupted");
        recorder.stop();
      } catch (error) {
        this.release(); this.recorder = null; this.stopPromise = null;
        reject(error);
      }
    });
    return this.stopPromise;
  }

  release() {
    globalThis.clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  discard() {
    this.onLimit = null;
    if (this.recorder?.state === "recording") {
      try { this.recorder.stop(); } catch (_error) { /* already stopped */ }
    }
    this.release();
    this.recorder = null;
    this.chunks = [];
  }
}
