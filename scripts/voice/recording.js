/** Local, opt-in microphone capture. Never opens the microphone by itself. */
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "./storage.js";

const MIME_CHOICES = [
  "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4",
  "audio/webm", "audio/ogg"
];

/** Fixed 'old dictaphone' sound, baked into the MediaRecorder input (not playback). */
function createDictaphoneStream(context, microphoneStream) {
  const source = context.createMediaStreamSource(microphoneStream);
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 300;
  highPass.Q.value = Math.SQRT1_2;

  const presence = context.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 1200;
  presence.Q.value = 1;
  presence.gain.value = 3;

  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 3200;
  lowPass.Q.value = Math.SQRT1_2;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;

  const destination = context.createMediaStreamDestination();
  source.connect(highPass);
  highPass.connect(presence);
  presence.connect(lowPass);
  lowPass.connect(compressor);
  compressor.connect(destination);
  // Deliberately NO connection to context.destination (the player's speakers).
  return destination.stream;
}

export class VoiceCapture {
  recorder = null;
  stream = null;
  processedStream = null;
  audioContext = null;
  chunks = [];
  startedAt = 0;
  timer = null;
  stopPromise = null;
  onLimit = null;
  starting = false;
  startGeneration = 0;

  async start(onLimit) {
    if (this.recorder || this.starting) throw new Error("Already recording");
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      throw new Error("Unsupported microphone or insecure origin (HTTPS required)");
    }
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API unavailable: cannot record a processed message");

    const generation = ++this.startGeneration;
    this.starting = true;
    this.onLimit = onLimit;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== this.startGeneration) {
        // The dialog was closed / game changed while microphone permission was pending.
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;
      this.audioContext = new AudioContextClass();
      this.processedStream = createDictaphoneStream(this.audioContext, this.stream);
      if (this.audioContext.state === "suspended") await this.audioContext.resume();
      if (this.audioContext.state !== "running") {
        throw new Error("Audio processing unavailable: audio context not running");
      }
      if (generation !== this.startGeneration) return false;

      const mimeType = MIME_CHOICES.find((value) => MediaRecorder.isTypeSupported(value));
      this.recorder = new MediaRecorder(this.processedStream, mimeType ? { mimeType } : undefined);
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
      return true;
    } catch (error) {
      if (generation === this.startGeneration) {
        this.release();
        this.recorder = null;
      }
      throw error;
    } finally {
      if (generation === this.startGeneration) this.starting = false;
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
    this.processedStream?.getTracks().forEach((track) => track.stop());
    this.processedStream = null;
    const context = this.audioContext;
    this.audioContext = null;
    if (context && context.state !== "closed") {
      try { void context.close().catch((error) => console.warn("tencandles-ga | Audio context close:", error)); }
      catch (error) { console.warn("tencandles-ga | Audio context close:", error); }
    }
  }

  discard() {
    this.startGeneration++;
    this.starting = false;
    this.onLimit = null;
    if (this.recorder?.state === "recording") {
      try { this.recorder.stop(); } catch (_error) { /* already stopped */ }
    }
    this.release();
    this.recorder = null;
    this.chunks = [];
  }
}
