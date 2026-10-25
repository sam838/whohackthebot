// All the game's sound, made in code with Web Audio: no sound files to download or license.
// Browsers only allow sound after a tap or key press, so the first one unlocks it.
// Muting is remembered on this device. If audio is blocked or unsupported, every call quietly does nothing.

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let musicBus: GainNode | undefined;
let sfxBus: GainNode | undefined;
let noise: AudioBuffer | undefined;

const MUTE_KEY = "whtb.muted";
const MUSIC_LEVEL = 0.16;
const MUSIC_DUCKED = 0.05;

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted = loadMuted();
const muteListeners = new Set<(m: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    // Private mode: it just won't be remembered.
  }
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
  for (const fn of muteListeners) fn(m);
}

export function onMuteChange(fn: (m: boolean) => void): () => void {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

/** Starts audio (after a tap or key press). Safe to call any number of times. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_LEVEL;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.55;
      sfxBus.connect(master);
      const len = ctx.sampleRate;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    void ctx.resume();
    startMusicLoop();
  } catch {
    ctx = undefined;
  }
}

function ready(): AudioContext | undefined {
  return ctx && ctx.state === "running" ? ctx : undefined;
}

// --- Building blocks ---

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  attack?: number;
  bus?: GainNode;
}

/** One note with a quick attack and a smooth fade. */
function tone(freq: number, at: number, dur: number, { type = "triangle", gain = 0.3, slideTo, attack = 0.01, bus }: ToneOptions = {}) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(bus ?? sfxBus!);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** A burst of filtered noise (hats, whooshes, rustles, key clicks). */
function hiss(at: number, dur: number, { freq = 4000, to, q = 1, gain = 0.2, type = "bandpass", bus }: { freq?: number; to?: number; q?: number; gain?: number; type?: BiquadFilterType; bus?: GainNode } = {}) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise!;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, at);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, at + dur);
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(g).connect(bus ?? sfxBus!);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.05);
}

const note = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
// Handy pitches (semitones from A4).
const C4 = -9, D4 = -7, E4 = -5, F4 = -4, G4 = -2, A4 = 0, B4 = 2, C5 = 3, D5 = 5, E5 = 7, G5 = 10, C6 = 15, E6 = 19, G6 = 22;

function play(fn: (c: AudioContext, t: number) => void) {
  const c = ready();
  if (!c || muted) return;
  try {
    fn(c, c.currentTime + 0.01);
  } catch {
    // Sound is a nice extra; never let it break the game.
  }
}

// --- Sound effects ---

export const sfx = {
  /** Role book typing: one soft key click at a slightly different pitch each time. */
  key: () => play((_, t) => hiss(t, 0.03, { freq: 1800 + Math.random() * 900, q: 1.2, gain: 0.5 })),
  /** Any button. */
  click: () => play((_, t) => tone(note(E6), t, 0.05, { type: "square", gain: 0.06 })),
  /** Searching something: a little rustle. */
  rustle: () => play((_, t) => hiss(t, 0.35, { freq: 2500, to: 900, q: 0.7, gain: 0.12 })),
  /** Found a piece: a bright rising sparkle. */
  piece: () =>
    play((_, t) => {
      [C6, E6, G6].forEach((n, i) => tone(note(n), t + i * 0.07, 0.25, { type: "triangle", gain: 0.22 }));
      tone(note(C6 + 12), t + 0.21, 0.4, { type: "sine", gain: 0.12 });
    }),
  /** Nothing here: a soft dull thud. */
  nothing: () => play((_, t) => tone(160, t, 0.18, { type: "triangle", gain: 0.25, slideTo: 90 })),
  /** A right answer: a happy little arpeggio. */
  correct: () => play((_, t) => [C5, E5, G5, C6].forEach((n, i) => tone(note(n), t + i * 0.08, 0.3, { type: "triangle", gain: 0.22 }))),
  /** Wrong (you can try again): two short low notes. */
  wrong: () =>
    play((_, t) => {
      tone(note(E4), t, 0.15, { type: "square", gain: 0.08 });
      tone(note(C4), t + 0.16, 0.22, { type: "square", gain: 0.08 });
    }),
  /** Study-Bot lied, strike: a harsh buzzer with a falling tone. */
  strike: () =>
    play((_, t) => {
      tone(110, t, 0.5, { type: "sawtooth", gain: 0.16 });
      tone(104, t, 0.5, { type: "sawtooth", gain: 0.16 });
      tone(note(E4), t + 0.05, 0.6, { type: "square", gain: 0.07, slideTo: note(E4 - 12) });
    }),
  /** Meeting called: a school bell, ding-dong. */
  bell: () =>
    play((_, t) => {
      for (const [n, at] of [
        [E5, 0],
        [C5, 0.45],
      ] as const) {
        tone(note(n), t + at, 1.4, { type: "sine", gain: 0.25, attack: 0.005 });
        tone(note(n) * 2.76, t + at, 0.6, { type: "sine", gain: 0.06, attack: 0.005 });
      }
    }),
  /** Someone was expelled: a whoosh and a thump. */
  expel: () =>
    play((_, t) => {
      hiss(t, 0.6, { freq: 3000, to: 250, q: 0.8, gain: 0.3 });
      tone(90, t + 0.35, 0.35, { type: "sine", gain: 0.35, slideTo: 45 });
    }),
  /** The Bluffer hacked a terminal: a short glitchy chirp. */
  hack: () =>
    play((_, t) => {
      for (let i = 0; i < 6; i++) tone(300 + Math.random() * 1200, t + i * 0.045, 0.04, { type: "square", gain: 0.07 });
    }),
  /** The vote result: a drum hit and a held note. */
  reveal: () =>
    play((_, t) => {
      tone(140, t, 0.3, { type: "sine", gain: 0.4, slideTo: 50 });
      hiss(t, 0.2, { freq: 6000, type: "highpass", gain: 0.12 });
      tone(note(A4), t + 0.05, 0.9, { type: "triangle", gain: 0.12 });
    }),
  /** You won. */
  win: () => play((_, t) => [C5, E5, G5, C6, E6, G6].forEach((n, i) => tone(note(n), t + i * 0.1, i === 5 ? 0.8 : 0.3, { type: "triangle", gain: 0.2 }))),
  /** You lost. */
  lose: () => play((_, t) => [G4, E4 - 1, C4, C4 - 5].forEach((n, i) => tone(note(n), t + i * 0.22, i === 3 ? 0.9 : 0.35, { type: "triangle", gain: 0.2 }))),
};

// --- Music: a short loop made of bass, chords, a melody bleep, and drums ---

export type MusicMode = "menu" | "class" | "meeting" | "off";

interface Song {
  bpm: number;
  /** One chord per bar, as semitones from A4 (root, third, fifth). */
  chords: number[][];
  /** Melody per bar: 8 eighth notes, null for a rest. */
  melody: (number | null)[][];
  drums: boolean;
}

const SONGS: Record<"menu" | "class", Song> = {
  // Bouncy and sunny, like the title screen.
  menu: {
    bpm: 108,
    chords: [
      [C4, E4, G4],
      [A4 - 12, C4, E4],
      [F4, A4, C5],
      [G4, B4, D5],
    ],
    melody: [
      [E5, null, G5, null, E5, D5, C5, null],
      [C5, null, E5, null, D5, C5, A4, null],
      [A4, null, C5, null, F4 + 12, E5, C5, null],
      [D5, null, B4, null, G4, null, null, null],
    ],
    drums: false,
  },
  // A bit faster and more curious: someone might be lying.
  class: {
    bpm: 120,
    chords: [
      [A4 - 12, C4, E4],
      [F4 - 12, A4 - 12, C4],
      [C4, E4, G4],
      [G4 - 12, B4 - 12, D4],
    ],
    melody: [
      [E5, null, null, E5, D5, null, C5, null],
      [C5, null, null, C5, B4, null, A4, null],
      [G4, null, C5, null, E5, null, D5, null],
      [D5, null, B4, null, null, null, null, null],
    ],
    drums: true,
  },
};

let mode: MusicMode = "off";
let timer: ReturnType<typeof setInterval> | undefined;
let nextStepAt = 0;
let step = 0;

export function setMusic(next: MusicMode): void {
  if (next === mode) return;
  const prev = mode;
  mode = next;
  const c = ctx;
  if (c && musicBus) {
    const level = next === "off" ? 0 : next === "meeting" ? MUSIC_DUCKED : MUSIC_LEVEL;
    musicBus.gain.setTargetAtTime(level, c.currentTime, 0.3);
  }
  // A new song starts from its first bar.
  const songOf = (m: MusicMode) => (m === "menu" ? "menu" : m === "off" ? "off" : "class");
  if (songOf(prev) !== songOf(next)) step = 0;
}

function startMusicLoop() {
  if (timer || !ctx) return;
  nextStepAt = ctx.currentTime + 0.1;
  // Schedules a little ahead so the beat stays steady even if the page is busy.
  timer = setInterval(() => {
    const c = ready();
    if (!c || mode === "off") {
      if (c) nextStepAt = c.currentTime + 0.1;
      return;
    }
    const song = SONGS[mode === "menu" ? "menu" : "class"];
    const eighth = 60 / song.bpm / 2;
    if (nextStepAt < c.currentTime - 0.2) nextStepAt = c.currentTime + 0.05;
    while (nextStepAt < c.currentTime + 0.15) {
      scheduleStep(song, step, nextStepAt, eighth);
      step = (step + 1) % (song.chords.length * 8);
      nextStepAt += eighth;
    }
  }, 30);
}

function scheduleStep(song: Song, s: number, at: number, eighth: number) {
  const bar = Math.floor(s / 8);
  const beat = s % 8;
  const chord = song.chords[bar];
  const bus = musicBus!;
  // Bass on every beat, chord stabs on the off-beats.
  if (beat % 2 === 0) tone(note(chord[0] - 12), at, eighth * 1.8, { type: "triangle", gain: 0.5, bus });
  if (beat % 4 === 2) for (const n of chord) tone(note(n), at, eighth * 1.5, { type: "square", gain: 0.05, bus });
  const m = song.melody[bar][beat];
  if (m !== null) tone(note(m), at, eighth * 1.6, { type: "triangle", gain: 0.22, bus });
  if (song.drums) {
    if (beat % 4 === 0) tone(120, at, 0.18, { type: "sine", gain: 0.6, slideTo: 45, bus });
    if (beat % 2 === 1) hiss(at, 0.05, { freq: 8000, type: "highpass", gain: 0.12, bus });
    if (beat === 4) hiss(at, 0.15, { freq: 1800, q: 0.6, gain: 0.25, bus });
  } else if (beat % 2 === 1) {
    hiss(at, 0.03, { freq: 9000, type: "highpass", gain: 0.06, bus });
  }
}
