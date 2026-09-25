import { useEffect, useRef, useState } from 'preact/hooks';
import { celebration, dismissCelebration } from '@/lib/store';
import { milestoneLabel, type Celebration, type CelebrationTier } from '@/lib/celebration';
import { DURATION_MS, playCelebrationFx, reducedMotion } from '@/lib/celebrationFx';

/** An event older than this is ignored: the screen it belonged to is long gone. */
const STALE_MS = 15_000;

function current<T extends CelebrationTier>(tier: T): Extract<Celebration, { tier: T }> | null {
  const c = celebration.value;
  if (!c || c.tier !== tier) return null;
  if (Date.now() - c.at > STALE_MS) {
    dismissCelebration();
    return null;
  }
  return c as Extract<Celebration, { tier: T }>;
}

/** Play the effects once, then auto-dismiss after the tier's duration. A tap dismisses early. */
function useCelebrationLifecycle(tier: CelebrationTier): void {
  useEffect(() => {
    playCelebrationFx(tier);
    const t = setTimeout(dismissCelebration, DURATION_MS[tier]);
    return () => clearTimeout(t);
  }, [tier]);
}

/** A number that counts up from 0 over ~700 ms. Renders the final value at once under reduced motion. */
function CountUp({ value, still }: { value: number; still: boolean }) {
  const [n, setN] = useState(still ? value : 0);
  useEffect(() => {
    if (still || value === 0) {
      setN(value);
      return;
    }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, still]);
  return <span class="mono">{n}</span>;
}

/** Whether the Day Progress card should wear its glow right now. */
export function dayCelebrationActive(): boolean {
  const c = celebration.value;
  return !!c && c.tier === 'day' && Date.now() - c.at <= STALE_MS;
}

/**
 * Day tier: sits inside the Day Progress card (the card is position: relative and clips to its notch).
 * Checkmark draws in, headline and stat line fade up, numbers count up. Auto-dismisses after 1.5 s.
 */
export function DayCelebrationCard() {
  const c = current('day');
  if (!c) return null;
  return <DayCelebrationInner c={c} key={c.at} />;
}

function DayCelebrationInner({ c }: { c: Extract<Celebration, { tier: 'day' }> }) {
  const still = reducedMotion();
  useCelebrationLifecycle('day');
  return (
    <div class={`celebrate-card ${still ? 'still' : ''}`} data-testid="celebration-day" data-static={still} role="status" aria-live="polite" onClick={dismissCelebration}>
      <svg class="celebrate-check" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
        <circle class="ring" cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2.5" />
        <path class="tick" d="M15 27l8 8 15-16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div class="celebrate-head" data-testid="celebration-headline">{c.headline}</div>
      <div class="celebrate-stat muted small" data-testid="celebration-stat">
        <CountUp value={c.stats.done} still={still} />/<span class="mono">{c.stats.required}</span> sessions · <CountUp value={c.stats.weekMinutes} still={still} /> min this week
      </div>
    </div>
  );
}

/**
 * Milestone tier: a full-screen takeover with confetti and a headline reveal. Mounted at the app root
 * so it shows over whatever screen the completion landed on. Auto-dismisses after 3 s.
 */
export function MilestoneTakeover() {
  const c = current('milestone');
  if (!c) return null;
  return <MilestoneInner c={c} key={c.at} />;
}

function MilestoneInner({ c }: { c: Extract<Celebration, { tier: 'milestone' }> }) {
  const still = reducedMotion();
  useCelebrationLifecycle('milestone');
  const s = c.stats;
  return (
    <div class={`celebrate-takeover ${still ? 'still' : ''}`} data-testid="celebration-milestone" data-kind={c.kind} data-static={still} role="status" aria-live="assertive" onClick={dismissCelebration}>
      {!still && <Confetti />}
      <div class="celebrate-takeover-body">
        <span class="chip chip-signal celebrate-stamp">{milestoneLabel(c.kind, c.day)}</span>
        <h1 class="celebrate-title" data-testid="celebration-headline">{c.headline}</h1>
        <div class="celebrate-recap" data-testid="celebration-stat">
          <div><span class="v"><CountUp value={s.done} still={still} /><span class="muted">/{s.required}</span></span><span class="lbl">sessions</span></div>
          <div><span class="v"><CountUp value={s.minutes} still={still} /></span><span class="lbl">minutes</span></div>
          <div><span class="v"><CountUp value={s.consistency} still={still} /><span class="muted">%</span></span><span class="lbl">consistency</span></div>
        </div>
        <div class="muted small celebrate-span">Days {String(s.from).padStart(2, '0')}–{String(s.to).padStart(2, '0')} · tap to close</div>
      </div>
    </div>
  );
}

/* ---------------- confetti ----------------
 * Hand-rolled canvas particles: three bursts in the app palette, gravity and drag, fade at the end.
 * Around sixty lines; a library would add a dependency for the same effect.
 */
interface Particle { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string }

const PALETTE = ['#FF6A13', '#C2B280', '#6B8F71', '#9AA86A', '#E8E4D4'];

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    const ps: Particle[] = [];
    const burst = (cx: number, cy: number, n: number, spread: number, power: number) => {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const v = power * (0.55 + Math.random() * 0.7);
        ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.35, color: PALETTE[i % PALETTE.length]! });
      }
    };
    const timers = [
      setTimeout(() => burst(w * 0.5, h * 0.82, 120, 1.7, 15), 0),
      setTimeout(() => burst(w * 0.18, h * 0.9, 55, 1.2, 13), 260),
      setTimeout(() => burst(w * 0.82, h * 0.9, 55, 1.2, 13), 480),
    ];
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const alpha = t > 2.1 ? Math.max(0, 1 - (t - 2.1) / 0.8) : 1;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = alpha;
      for (const p of ps) {
        p.vy += 0.3;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 2.95) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);
  return <canvas ref={ref} class="celebrate-confetti" aria-hidden="true" />;
}
