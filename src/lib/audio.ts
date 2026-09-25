/** Web Audio beeps. iOS has no vibration API; the flash cue is the backup. */
let ctx: AudioContext | null = null;
let volume = 0.8;
let enabled = true;
let celebrationEnabled = true;

export function setAudio(opts: { volume?: number; enabled?: boolean; celebration?: boolean }) {
  if (opts.volume !== undefined) volume = Math.max(0, Math.min(1, opts.volume));
  if (opts.enabled !== undefined) enabled = opts.enabled;
  if (opts.celebration !== undefined) celebrationEnabled = opts.celebration;
}

/** Must be called from a user gesture (the Start tap) to unlock audio on iOS. */
export function unlockAudio(): void {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    // Play a silent buffer to fully unlock.
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* no audio available */
  }
}

export function beep(freq = 880, ms = 120, type: OscillatorType = 'square'): void {
  if (!enabled || !ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.5), t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

export function countdownBeep(n: number): void {
  beep(n === 1 ? 990 : 880, 110);
}

export function longBeep(): void {
  beep(1320, 550, 'sawtooth');
}

export function tickBeep(accent = false): void {
  beep(accent ? 1100 : 660, accent ? 140 : 50, 'sine');
}

export function chime(): void {
  beep(1046, 160, 'sine');
  setTimeout(() => beep(1318, 220, 'sine'), 170);
}

/* ---------------- celebration sounds ----------------
 * Synthesized here, no audio files. They follow the Celebration sound toggle, not the timer
 * cue toggle, and share the unlocked context, so they play on iOS as long as unlockAudio()
 * ran inside the tap that finished the day.
 */

/** One note: sine body with a soft attack and an exponential tail, scheduled at `at` seconds on the context clock. */
function note(freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'sine', detune = 0): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Day tier: a short two-note chime, G5 then D6, about 0.4 s. */
export function celebrationDayChime(): void {
  if (!celebrationEnabled || !ctx) return;
  try {
    const t = ctx.currentTime + 0.01;
    const v = volume * 0.45;
    note(784, t, 0.22, v, 'triangle');
    note(1175, t + 0.12, 0.34, v, 'triangle');
    note(2350, t + 0.12, 0.2, v * 0.25); // sparkle on the second note
  } catch {
    /* ignore */
  }
}

/** Milestone tier: a rising four-note figure, C5 E5 G5 C6, landing on a held C6 with a fifth. About 1.3 s. */
export function celebrationMilestoneFanfare(): void {
  if (!celebrationEnabled || !ctx) return;
  try {
    const t = ctx.currentTime + 0.01;
    const v = volume * 0.4;
    const steps = [523.25, 659.25, 783.99];
    steps.forEach((f, i) => {
      note(f, t + i * 0.13, 0.22, v, 'triangle');
      note(f, t + i * 0.13, 0.22, v * 0.35, 'sawtooth', 8);
    });
    const hold = t + steps.length * 0.13;
    note(1046.5, hold, 0.9, v, 'triangle');
    note(1046.5, hold, 0.9, v * 0.3, 'sawtooth', -7);
    note(1568, hold + 0.1, 0.75, v * 0.55, 'sine'); // the fifth above
    note(2093, hold + 0.18, 0.5, v * 0.2, 'sine'); // octave shimmer
  } catch {
    /* ignore */
  }
}
