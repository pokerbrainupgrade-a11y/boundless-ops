/**
 * Generic interval engine. Timestamp-based: every state read is derived from
 * the clock and the stored segment start time, never from tick counting.
 */
export type SegmentKind = 'work' | 'rest' | 'prep' | 'transition';

export interface Segment {
  label: string;
  kind: SegmentKind;
  /** Duration in ms. Ignored when `open` is true. */
  durationMs: number;
  /** Short cue shown under the label. */
  cue?: string;
  /** If set, the runner shows a logging prompt during this segment. */
  logPrompt?: string;
  /** Open-ended segment: counts up until skip() is called. */
  open?: boolean;
  /** Free-form data for wrappers (e.g. round number, move id). */
  meta?: Record<string, unknown>;
}

export type EngineStatus = 'idle' | 'running' | 'paused' | 'done';

export interface EngineState {
  status: EngineStatus;
  index: number;
  segment: Segment | null;
  segmentElapsedMs: number;
  segmentRemainingMs: number;
  totalElapsedMs: number;
  totalDurationMs: number;
  /** Seconds left in the segment, ceil'd (for display). */
  secondsLeft: number;
}

export interface EngineEvents {
  onSegmentStart?: (index: number, segment: Segment, previous: Segment | null) => void;
  onSegmentEnd?: (index: number, segment: Segment, reason: 'elapsed' | 'skipped') => void;
  /** 3, 2, 1 countdown beeps before a timed segment ends. */
  onCountdown?: (n: number) => void;
  /** Long beep when a timed segment reaches zero. */
  onSegmentZero?: (index: number, segment: Segment) => void;
  onTick?: (state: EngineState) => void;
  onDone?: () => void;
  onStatus?: (status: EngineStatus) => void;
}

export interface EngineOptions {
  now?: () => number;
  /** Tick interval in ms for display updates. */
  tickMs?: number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
}

export interface EngineSnapshot {
  index: number;
  status: EngineStatus;
  segStartEpochMs: number;
  pausedAtEpochMs: number | null;
  segments: Segment[];
}

export class IntervalEngine {
  readonly segments: Segment[];
  private now: () => number;
  private tickMs: number;
  private _setInterval: (fn: () => void, ms: number) => unknown;
  private _clearInterval: (id: unknown) => void;
  private timer: unknown = null;

  private status: EngineStatus = 'idle';
  private index = 0;
  /** Clock value when the current segment started (adjusted for pauses). */
  private segStart = 0;
  private pausedAt: number | null = null;
  /** Sum of completed segment durations (for total elapsed). */
  private completedMs = 0;
  private lastCountdown = 0;
  private events: EngineEvents;

  constructor(segments: Segment[], events: EngineEvents = {}, opts: EngineOptions = {}) {
    if (segments.length === 0) throw new Error('IntervalEngine needs at least one segment');
    this.segments = segments;
    this.events = events;
    this.now = opts.now ?? (() => Date.now());
    this.tickMs = opts.tickMs ?? 100;
    this._setInterval = opts.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
    this._clearInterval = opts.clearInterval ?? ((id) => globalThis.clearInterval(id as ReturnType<typeof globalThis.setInterval>));
  }

  get totalDurationMs(): number {
    return this.segments.reduce((a, s) => a + (s.open ? 0 : s.durationMs), 0);
  }

  getState(): EngineState {
    const seg = this.status === 'done' ? null : (this.segments[this.index] ?? null);
    const elapsed = this.status === 'idle' || !seg ? 0 : this.segElapsed();
    const remaining = !seg || seg.open ? Infinity : Math.max(0, seg.durationMs - elapsed);
    return {
      status: this.status,
      index: this.index,
      segment: seg,
      segmentElapsedMs: elapsed,
      segmentRemainingMs: remaining,
      totalElapsedMs: this.status === 'done' ? this.totalDurationMs : this.completedMs + elapsed,
      totalDurationMs: this.totalDurationMs,
      secondsLeft: remaining === Infinity ? Math.floor(elapsed / 1000) : Math.ceil(remaining / 1000),
    };
  }

  private segElapsed(): number {
    const ref = this.pausedAt ?? this.now();
    return Math.max(0, ref - this.segStart);
  }

  start(): void {
    if (this.status !== 'idle') return;
    this.status = 'running';
    this.index = 0;
    this.completedMs = 0;
    this.segStart = this.now();
    this.lastCountdown = 0;
    this.events.onStatus?.('running');
    this.events.onSegmentStart?.(0, this.segments[0]!, null);
    this.startTicking();
    this.tick();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.pausedAt = this.now();
    this.status = 'paused';
    this.stopTicking();
    this.events.onStatus?.('paused');
    this.events.onTick?.(this.getState());
  }

  resume(): void {
    if (this.status !== 'paused' || this.pausedAt === null) return;
    const pausedFor = this.now() - this.pausedAt;
    this.segStart += pausedFor;
    this.pausedAt = null;
    this.status = 'running';
    this.events.onStatus?.('running');
    this.startTicking();
    this.tick();
  }

  toggle(): void {
    if (this.status === 'running') this.pause();
    else if (this.status === 'paused') this.resume();
    else if (this.status === 'idle') this.start();
  }

  /** Jump to the next segment immediately. */
  skip(): void {
    if (this.status !== 'running' && this.status !== 'paused') return;
    const seg = this.segments[this.index]!;
    const elapsed = this.segElapsed();
    this.completedMs += seg.open ? elapsed : Math.min(elapsed, seg.durationMs);
    this.events.onSegmentEnd?.(this.index, seg, 'skipped');
    this.advance(this.pausedAt ?? this.now());
  }

  /** End the whole session now. */
  end(): void {
    if (this.status === 'done' || this.status === 'idle') return;
    this.stopTicking();
    this.status = 'done';
    this.pausedAt = null;
    this.events.onStatus?.('done');
    this.events.onDone?.();
  }

  /** Recompute state from stored timestamps (call on visibilitychange / focus). */
  sync(): void {
    if (this.status === 'running') this.tick();
  }

  snapshot(): EngineSnapshot {
    // Convert monotonic clock offsets into epoch ms so a reload can restore.
    const nowClock = this.now();
    const nowEpoch = Date.now();
    return {
      index: this.index,
      status: this.status,
      segStartEpochMs: nowEpoch - (nowClock - this.segStart),
      pausedAtEpochMs: this.pausedAt === null ? null : nowEpoch - (nowClock - this.pausedAt),
      segments: this.segments,
    };
  }

  /** Restore a running/paused engine from a snapshot taken by `snapshot()`. */
  static restore(snap: EngineSnapshot, events: EngineEvents = {}, opts: EngineOptions = {}): IntervalEngine {
    const e = new IntervalEngine(snap.segments, events, opts);
    if (snap.status === 'idle' || snap.status === 'done') return e;
    const nowClock = e.now();
    const nowEpoch = Date.now();
    e.index = Math.min(snap.index, snap.segments.length - 1);
    e.completedMs = snap.segments.slice(0, e.index).reduce((a, s) => a + (s.open ? 0 : s.durationMs), 0);
    e.segStart = nowClock - (nowEpoch - snap.segStartEpochMs);
    e.pausedAt = snap.pausedAtEpochMs === null ? null : nowClock - (nowEpoch - snap.pausedAtEpochMs);
    e.status = snap.status;
    if (e.status === 'running') {
      e.startTicking();
      e.tick();
    }
    return e;
  }

  dispose(): void {
    this.stopTicking();
  }

  private startTicking(): void {
    if (this.timer !== null) return;
    this.timer = this._setInterval(() => this.tick(), this.tickMs);
  }

  private stopTicking(): void {
    if (this.timer !== null) {
      this._clearInterval(this.timer);
      this.timer = null;
    }
  }

  private advance(fromClock: number): void {
    this.index += 1;
    this.lastCountdown = 0;
    if (this.index >= this.segments.length) {
      this.end();
      return;
    }
    const prev = this.segments[this.index - 1]!;
    this.segStart = fromClock;
    this.events.onSegmentStart?.(this.index, this.segments[this.index]!, prev);
  }

  /** Core: derive everything from the clock; roll through any segments that fully elapsed. */
  private tick(): void {
    if (this.status !== 'running') return;
    let guard = 0;
    while (this.status === 'running' && guard++ < 10_000) {
      const seg = this.segments[this.index]!;
      if (seg.open) break;
      const elapsed = this.now() - this.segStart;
      if (elapsed >= seg.durationMs) {
        this.completedMs += seg.durationMs;
        this.events.onSegmentZero?.(this.index, seg);
        this.events.onSegmentEnd?.(this.index, seg, 'elapsed');
        // Carry the overflow into the next segment so no drift accumulates.
        this.advance(this.segStart + seg.durationMs);
        continue;
      }
      const remaining = seg.durationMs - elapsed;
      if (remaining <= 3000) {
        const n = Math.ceil(remaining / 1000); // 3, 2, 1
        if (n >= 1 && n <= 3 && n !== this.lastCountdown) {
          // Only beep for the current second; skip any missed while backgrounded.
          if (this.lastCountdown === 0 || n === this.lastCountdown - 1) this.events.onCountdown?.(n);
          this.lastCountdown = n;
        }
      }
      break;
    }
    if (this.status === 'running') this.events.onTick?.(this.getState());
  }
}

/** Helper: build N repeated work/rest rounds. */
export function rounds(
  n: number,
  work: Omit<Segment, 'kind'>,
  rest: Omit<Segment, 'kind'> | null,
  opts: { skipLastRest?: boolean } = {},
): Segment[] {
  const out: Segment[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({ ...work, kind: 'work', meta: { ...(work.meta ?? {}), round: i, of: n } });
    if (rest && !(opts.skipLastRest && i === n)) out.push({ ...rest, kind: 'rest', meta: { ...(rest.meta ?? {}), round: i, of: n } });
  }
  return out;
}

export function prep(seconds: number, label = 'GET READY'): Segment {
  return { label, kind: 'prep', durationMs: seconds * 1000 };
}

export function fmtClock(ms: number): string {
  if (!isFinite(ms)) return '--:--';
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function fmtClockDown(ms: number): string {
  if (!isFinite(ms)) return '--:--';
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
