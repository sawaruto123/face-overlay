/**
 * Maps a 0-100 "Mic sensitivity" setting to a volume threshold (roughly
 * 0-1, matching MicMonitor's level scale). Higher sensitivity = lower
 * threshold = triggers on quieter sound.
 * @param {number} sensitivity
 */
export function micThresholdFromSensitivity(sensitivity) {
  return 0.5 - (sensitivity / 100) * 0.45;
}

/**
 * Monitors microphone input level for audio-reactive mouth movement — an
 * alternative (or supplement) to jaw-tracking, since jaw detection can be
 * flaky at side angles or during fast speech. Requests mic permission only
 * when started (opt-in via Settings), never on app launch by default.
 */
export class MicMonitor {
  constructor() {
    /** @type {AudioContext | null} */
    this.audioContext = null;
    /** @type {AnalyserNode | null} */
    this.analyser = null;
    /** @type {MediaStream | null} */
    this.stream = null;
    /** @type {Uint8Array | null} */
    this.buffer = null;
    this.level = 0;
    this._rafId = null;
  }

  /** @param {string} [deviceId] */
  async start(deviceId) {
    if (this.stream) return; // already running

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: false,
    });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    source.connect(this.analyser);
    this.buffer = new Uint8Array(this.analyser.fftSize);
    this._tick();
  }

  _tick = () => {
    if (!this.analyser || !this.buffer) return;
    this.analyser.getByteTimeDomainData(this.buffer);

    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const normalized = (this.buffer[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);
    // Typical speaking RMS lands roughly in the 0.02-0.2 range — scale it up
    // so it maps onto a comfortable 0-1 range for the sensitivity slider.
    this.level = Math.min(1, rms * 6);

    this._rafId = requestAnimationFrame(this._tick);
  };

  /** @returns {number} Current normalized volume level, roughly 0-1. */
  getLevel() {
    return this.level;
  }

  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
    this.buffer = null;
    this.level = 0;
  }
}
