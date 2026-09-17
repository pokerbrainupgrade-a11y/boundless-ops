import { useEffect, useState } from 'preact/hooks';

/**
 * Decompression-breath ring: slow inhale (grow) / exhale (shrink). No fixed
 * count; the caller counts reps. Inhale 5 s, exhale 7 s by default.
 */
export function BreathRing({ inhaleMs = 5000, exhaleMs = 7000, running = true, onCycle }: { inhaleMs?: number; exhaleMs?: number; running?: boolean; onCycle?: (n: number) => void }) {
  const [phase, setPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let start = performance.now();
    let cycles = 0;
    let raf = 0;
    const loop = () => {
      const el = performance.now() - start;
      const total = inhaleMs + exhaleMs;
      if (el >= total) {
        start += total;
        cycles++;
        onCycle?.(cycles);
      }
      const e = (performance.now() - start) % total;
      if (e < inhaleMs) {
        setPhase('inhale');
        setT(e / inhaleMs);
      } else {
        setPhase('exhale');
        setT(1 - (e - inhaleMs) / exhaleMs);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inhaleMs, exhaleMs, running]);
  const r = 40 + t * 40;
  return (
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px" data-testid="breath-ring" data-phase={phase}>
      <svg width="200" height="200" viewBox="0 0 200 200" aria-label={`Breathing pacer: ${phase}`} role="img">
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--surface-2)" stroke-width="2" />
        <circle cx="100" cy="100" r={r} fill={phase === 'inhale' ? 'rgba(194,178,128,0.15)' : 'rgba(107,143,113,0.18)'} stroke={phase === 'inhale' ? 'var(--tan)' : 'var(--rest-hi)'} stroke-width="4" />
      </svg>
      <div class="timer-state" style="font-size:1.2rem">{phase === 'inhale' ? 'INHALE · RIBS WIDE' : 'EXHALE · STAY TALL'}</div>
    </div>
  );
}

/** Box breathing 4-4-4-4: a marker travels around a square. */
export function BoxBreath({ secondsPerSide = 4, running = true }: { secondsPerSide?: number; running?: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      setT(((performance.now() - start) / 1000) % (secondsPerSide * 4));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [secondsPerSide, running]);
  const side = Math.floor(t / secondsPerSide);
  const p = (t % secondsPerSide) / secondsPerSide;
  const S = 140, o = 30;
  const pos: [number, number] = side === 0 ? [o + p * S, o] : side === 1 ? [o + S, o + p * S] : side === 2 ? [o + S - p * S, o + S] : [o, o + S - p * S];
  const labels = ['INHALE', 'HOLD', 'EXHALE', 'HOLD'];
  const count = Math.ceil(secondsPerSide - (t % secondsPerSide));
  return (
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px" data-testid="box-breath" data-side={side}>
      <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label={`Box breathing: ${labels[side]}`}>
        <rect x={o} y={o} width={S} height={S} fill="none" stroke="var(--surface-2)" stroke-width="4" />
        <rect x={o} y={o} width={S} height={S} fill="none" stroke="var(--od)" stroke-width="4" stroke-dasharray={`${S * 4}`} stroke-dashoffset={`${S * 4 - (side * S + p * S)}`} />
        <rect x={pos[0] - 8} y={pos[1] - 8} width="16" height="16" fill="var(--signal)" />
        <text x="100" y="110" text-anchor="middle" font-family="var(--font-timer)" font-size="32" fill="var(--text)">{count}</text>
      </svg>
      <div class="timer-state" style="font-size:1.2rem">{labels[side]}</div>
    </div>
  );
}
