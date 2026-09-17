/** Web Audio beeps. iOS has no vibration API; the flash cue is the backup. */
let ctx: AudioContext | null = null;
let volume = 0.8;
let enabled = true;

export function setAudio(opts: { volume?: number; enabled?: boolean }) {
  if (opts.volume !== undefined) volume = Math.max(0, Math.min(1, opts.volume));
  if (opts.enabled !== undefined) enabled = opts.enabled;
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
