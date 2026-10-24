// Key-click sound for the role book, made in code with Web Audio (no sound file to license).
// Browsers only allow sound after a tap, so unlockAudio() runs on "Open your book".
// If audio is blocked or unsupported, every call quietly does nothing.

let ctx: AudioContext | undefined;
let noise: AudioBuffer | undefined;

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    if (!noise) {
      // 30 ms of fading white noise: the "tick" of a key.
      const len = Math.floor(ctx.sampleRate * 0.03);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
  } catch {
    ctx = undefined;
  }
}

/** One soft key click, at a slightly different pitch each time so it sounds like real typing. */
export function keyClick(): void {
  if (!ctx || !noise || ctx.state !== "running") return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800 + Math.random() * 900;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  } catch {
    // Sound is a nice extra; never let it break the reveal.
  }
}
