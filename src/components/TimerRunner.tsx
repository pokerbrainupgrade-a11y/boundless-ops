import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { IntervalEngine, fmtClock, fmtClockDown, type EngineEvents, type EngineState, type Segment } from '@/lib/engine';
import { readActiveRun, writeActiveRun, clearActiveRun } from '@/lib/activeRun';
import { STATE_COPY, type BuiltPreset } from '@/lib/presets';
import { unlockAudio, countdownBeep, longBeep } from '@/lib/audio';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock';
import { settings, updateSettings } from '@/lib/settings';
import { flash } from './Flash';

export interface RunResult {
  startedAt: string;
  endedAt: string;
  completed: boolean;
  /** ms actually elapsed */
  elapsedMs: number;
}

export interface RunnerApi {
  state: EngineState;
  segment: Segment | null;
  engine: IntervalEngine;
}

export interface TimerRunnerProps {
  built: BuiltPreset;
  title: string;
  subtitle?: string;
  /** Rendered under the digits for the current segment. */
  renderSegment?: (api: RunnerApi) => ComponentChildren;
  /** Rendered above the Start button before the timer starts. */
  preStart?: ComponentChildren;
  /** Called on every tick, for wrappers with time-based alerts. */
  onTick?: (api: RunnerApi) => void;
  onSegmentStart?: (index: number, seg: Segment, api: RunnerApi) => void;
  onDone: (r: RunResult) => void;
  onAbort: () => void;
  /** Label for the skip control (e.g. "FAILURE"). */
  skipLabel?: string;
  /** Show an elapsed (count-up) clock instead of the remaining one. */
  countUp?: boolean;
  /** Route of this session. When set, a running timer is saved under it and resumed after a reload. */
  snapshotKey?: string;
  /** Preset options saved with the snapshot so the wrapper can rebuild the same segments. */
  snapshotConfig?: object;
  /** Hide the skip button. */
  noSkip?: boolean;
}

export function TimerRunner(p: TimerRunnerProps) {
  const [state, setState] = useState<EngineState | null>(null);
  const [showSilentWarn, setShowSilentWarn] = useState(false);
  const doneRef = useRef(false);
  const apiRef = useRef<RunnerApi | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  const engine = useMemo(() => {
    // Resume only if the saved run was built from the same segments.
    const saved = p.snapshotKey ? readActiveRun(p.snapshotKey) : null;
    const resume = saved && saved.snap.segments.length === p.built.segments.length ? saved : null;
    // While restore() catches up on segments that elapsed during the reload, stay quiet:
    // no flashes, no wrapper callbacks, no setState during render.
    let live = false;
    let e: IntervalEngine | undefined;
    const events: EngineEvents = {
      onSegmentStart: (i, seg, prev) => {
        if (!live || !e) return;
        if (prev) flash(seg.kind === 'work' ? 'work' : 'rest');
        if (apiRef.current) p.onSegmentStart?.(i, seg, { ...apiRef.current, state: e.getState(), segment: seg });
        persist(e);
      },
      onCountdown: (n) => { if (live) countdownBeep(n); },
      onSegmentZero: () => { if (live) longBeep(); },
      onTick: (s) => {
        if (!live || !e) return;
        setState(s);
        const api = { state: s, segment: s.segment, engine: e };
        apiRef.current = api;
        p.onTick?.(api);
      },
      onStatus: (st) => {
        if (!e) return;
        setState(e.getState());
        if (st === 'paused' || st === 'running') persist(e);
      },
      onDone: () => {
        doneRef.current = true;
        clearActiveRun();
        void releaseWakeLock();
        if (live && e) setState(e.getState());
      },
    };
    if (resume) {
      startedAtRef.current = resume.startedAt;
      restoredRef.current = true;
      e = IntervalEngine.restore(resume.snap, events);
    } else {
      e = new IntervalEngine(p.built.segments, events);
    }
    live = true;
    if (resume && e.getState().status !== 'done') persist(e);
    apiRef.current = { state: e.getState(), segment: e.getState().segment, engine: e };
    return e;
    function persist(en: IntervalEngine) {
      if (!p.snapshotKey || !startedAtRef.current) return;
      writeActiveRun({ path: p.snapshotKey, startedAt: startedAtRef.current, config: p.snapshotConfig, snap: en.snapshot() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.built]);

  useEffect(() => {
    // Background recovery: recompute from the stored start time when the app comes back.
    const onVis = () => {
      if (document.visibilityState === 'visible') engine.sync();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    if (restoredRef.current && engine.getState().status === 'running') void requestWakeLock();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      engine.dispose();
      void releaseWakeLock();
    };
  }, [engine]);

  const start = () => {
    unlockAudio();
    void requestWakeLock();
    startedAtRef.current = new Date().toISOString();
    if (settings.value.sound && !settings.value.silentSwitchWarned) {
      setShowSilentWarn(true);
      void updateSettings({ silentSwitchWarned: true });
    }
    engine.start();
  };

  const finish = () => {
    const s = engine.getState();
    p.onDone({ startedAt: startedAtRef.current ?? new Date().toISOString(), endedAt: new Date().toISOString(), completed: s.status === 'done', elapsedMs: s.totalElapsedMs });
  };

  const st = state ?? engine.getState();
  const seg = st.segment;
  const kind = seg?.kind ?? 'prep';
  const label = st.status === 'done' ? STATE_COPY.done : seg ? seg.label : '';
  const total = seg && !seg.open ? seg.durationMs : 0;
  const frac = seg && !seg.open && total > 0 ? Math.max(0, Math.min(1, st.segmentRemainingMs / total)) : 0;
  const round = seg?.meta?.round as number | undefined;
  const of = seg?.meta?.of as number | undefined;
  const digits = seg?.open || p.countUp ? fmtClock(st.segmentElapsedMs) : fmtClockDown(st.segmentRemainingMs);
  const api: RunnerApi = { state: st, segment: seg, engine };
  const barColor = kind === 'work' ? 'var(--signal)' : kind === 'rest' ? 'var(--rest)' : 'var(--tan)';

  return (
    <div class="screen-full" data-testid="timer" data-status={st.status} data-index={st.index} data-segments={p.built.segments.length} data-total-ms={p.built.totalMs} data-elapsed-ms={Math.floor(st.totalElapsedMs)} data-kind={kind}>
      <div class="row between" style="margin-bottom:6px">
        <div class="grow" style="min-width:0">
          <div class="wordmark" style="font-size:1rem">{p.title}</div>
          {p.subtitle && <div class="muted small">{p.subtitle}</div>}
        </div>
        {st.status !== 'done' && (
          <button type="button" class="btn btn-ghost" onClick={() => (st.status === 'idle' ? p.onAbort() : (engine.end(), finish()))}>
            {st.status === 'idle' ? 'Back' : 'End'}
          </button>
        )}
      </div>

      {st.status === 'idle' ? (
        <div class="stack grow scroll-pane" data-testid="setup">
          <div class="card">
            <div class="muted small">Plan</div>
            <div class="mono" style="font-size:1.4rem">{fmtClock(p.built.totalMs)}{p.built.segments.some((s) => s.open) ? ' +' : ''}</div>
            <div class="muted small">{p.built.segments.length} segments · lead-in {settings.value.leadInSec} s</div>
          </div>
          {p.preStart}
          <div class="sticky-cta" style="bottom:0"><button type="button" class="btn btn-primary btn-xl btn-block" data-testid="start" onClick={start}>START</button></div>
        </div>
      ) : st.status === 'done' ? (
        <div class="stack grow fade-in" style="justify-content:center;align-items:center">
          <div class="timer-state rest" style="font-size:2rem" data-testid="state-label">{STATE_COPY.done}</div>
          <div class="muted mono">{fmtClock(st.totalElapsedMs)} total</div>
          <button type="button" class="btn btn-primary btn-xl btn-block" data-testid="log-it" onClick={finish}>FILE AAR</button>
        </div>
      ) : (
        <div class="stack grow" style="justify-content:space-between">
          <div class={`timer-state ${kind}`} data-testid="state-label">{label}</div>
          <div class="stack" style="gap:8px">
            <div class={`timer-digits ${kind}`} data-testid="digits" aria-live="off">{digits}</div>
            <div class="timer-bar" aria-hidden="true"><div style={`width:${seg?.open ? 100 : frac * 100}%;background:${barColor}`} /></div>
            <div class="row between">
              <span class="chip chip-outline">{st.status === 'paused' ? 'PAUSED' : kind.toUpperCase()}</span>
              {round && of ? <span class="chip chip-muted">{seg?.kind === 'transition' ? 'NEXT' : 'ROUND'} {round} / {of}</span> : <span />}
            </div>
          </div>
          {seg?.cue && <div class="muted" style="text-align:center;font-weight:600">{seg.cue}</div>}
          <div>{p.renderSegment?.(api)}</div>
          <div class="timer-controls">
            <button type="button" class="btn btn-lg" data-testid="pause" onClick={() => engine.toggle()}>{st.status === 'paused' ? 'RESUME' : 'PAUSE'}</button>
            {!p.noSkip ? (
              <button type="button" class={`btn btn-lg ${p.skipLabel ? 'btn-primary' : ''}`} data-testid="skip" onClick={() => engine.skip()}>{p.skipLabel ?? 'SKIP'}</button>
            ) : <span />}
            <button type="button" class="btn btn-lg btn-ghost" data-testid="end" onClick={() => { engine.end(); }}>END</button>
          </div>
          <div class="muted small mono" style="text-align:center">{fmtClock(st.totalElapsedMs)} / {fmtClock(st.totalDurationMs)}{p.built.segments.some((s) => s.open) ? ' +' : ''}</div>
        </div>
      )}

      {showSilentWarn && (
        <div class="banner warn" role="status" style="position:fixed;left:12px;right:12px;bottom:calc(12px + var(--safe-bottom));z-index:35">
          <span>The iPhone silent switch mutes web audio. The color flash is your backup cue.</span>
          <button type="button" class="btn" style="min-height:40px" onClick={() => setShowSilentWarn(false)}>OK</button>
        </div>
      )}
    </div>
  );
}
