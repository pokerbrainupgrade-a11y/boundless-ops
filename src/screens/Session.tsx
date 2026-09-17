import { useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { route, navigate } from '@/router';
import { program, getDay, sevenMinuteMoves } from '@/data/program';
import type { Session as SessionT, TimerPreset } from '@/data/schema';
import { buildPreset, tabataMoves, superSlowOptions, type PresetOptions } from '@/lib/presets';
import { dayN, block } from '@/lib/store';
import { settings, hrMax } from '@/lib/settings';
import type { SessionLog } from '@/lib/db';
import { TimerRunner, type RunnerApi, type RunResult } from '@/components/TimerRunner';
import { LogForm, tabataTotals } from '@/components/LogForm';
import { FoundationStepper, MobilityStepper, DecompressionPacer, type StepperResult } from '@/components/Steppers';
import { Pose } from '@/components/Pose';
import { BoxBreath } from '@/components/BreathPacer';
import { flash } from '@/components/Flash';
import { SessionBrief } from '@/components/SessionBrief';
import { chime, tickBeep } from '@/lib/audio';

type Phase = { kind: 'setup' } | { kind: 'run' } | { kind: 'log'; draft: SessionLog; note?: string };

export function Session() {
  const r = route.value;
  const sessionId = r.parts[1] ?? '';
  const q = r.query;
  const day = Number(q.get('day') ?? dayN.value ?? 1);
  const slot = (q.get('slot') ?? 'main') as SessionLog['slot'];
  const variant = q.get('variant') ?? undefined;
  const session = program.sessions[sessionId];
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });

  if (!session) {
    return (
      <main class="screen">
        <div class="section-h"><h1>Session</h1></div>
        <div class="banner danger"><span>Unknown session.</span></div>
        <button type="button" class="btn" onClick={() => navigate('/today')}>Back to Today</button>
      </main>
    );
  }

  const dayObj = day >= 1 && day <= 14 ? getDay(day) : getDay(1);
  const week = dayObj.week;
  const b = block.value;
  const draft = (res: { startedAt: string; endedAt: string; completed: boolean }, data: Record<string, unknown>): SessionLog => ({
    blockId: b?.id ?? 0,
    dayN: day,
    week,
    day: dayObj.day,
    slot,
    sessionId: session.id,
    variant,
    startedAt: res.startedAt,
    endedAt: res.endedAt,
    completed: res.completed,
    data,
  });

  if (phase.kind === 'log') {
    return <LogForm session={session} draft={phase.draft} note={phase.note} onSaved={() => navigate('/today', true)} onCancel={() => navigate('/today', true)} />;
  }

  const onStepper = (res: StepperResult, note?: string) => setPhase({ kind: 'log', draft: draft(res, res.data), note });
  const abort = () => navigate('/today', true);
  const preset: TimerPreset = session.timerPreset;

  if (preset === 'foundation' || preset === 'mobility') {
    const v = (variant === 'seqA' || variant === 'seqB' || variant === 'applied' ? variant : dayObj.foundation === 'A' ? 'seqA' : dayObj.foundation === 'B' ? 'seqB' : 'applied') as 'seqA' | 'seqB' | 'applied';
    // Brief first: review every exercise, then begin the stepper.
    if (phase.kind === 'setup') {
      return (
        <div class="screen-full" data-testid="stepper-brief">
          <div class="row between" style="margin-bottom:6px">
            <div class="grow" style="min-width:0"><div class="wordmark" style="font-size:1rem">{session.name}</div><div class="muted small">{preset === 'foundation' ? (v === 'seqA' ? 'Sequence A' : v === 'seqB' ? 'Sequence B' : 'Applied day') : '15 stations'} · Day {String(day).padStart(2, '0')}</div></div>
            <button type="button" class="btn btn-ghost" onClick={abort}>Back</button>
          </div>
          <div class="stack grow scroll-pane">
            <SessionBrief session={session} week={week} variant={preset === 'foundation' ? v : undefined} />
            <div class="sticky-cta" style="bottom:0"><button type="button" class="btn btn-primary btn-xl btn-block" data-testid="start" onClick={() => setPhase({ kind: 'run' })}>START</button></div>
          </div>
        </div>
      );
    }
    if (preset === 'foundation') return <FoundationStepper variant={v} onDone={onStepper} onAbort={abort} />;
    return <MobilityStepper onDone={onStepper} onAbort={abort} />;
  }
  if (preset === 'decompression') return <DecompressionPacer title={session.name} onDone={onStepper} onAbort={abort} />;

  return <IntervalSession key={session.id + variant} session={session} week={week} day={day} variant={variant} onDone={(res, data, note) => setPhase({ kind: 'log', draft: draft(res, data), note })} onAbort={abort} />;
}

/* ---------------- interval presets ---------------- */

function IntervalSession({ session, week, day, variant, onDone, onAbort }: {
  session: SessionT; week: 1 | 2; day: number; variant?: string;
  onDone: (r: RunResult, data: Record<string, unknown>, note?: string) => void; onAbort: () => void;
}) {
  const s = settings.value;
  const preset = session.timerPreset;
  const rotation = week === 1 ? program.tabataRotation.w1 : program.tabataRotation.w2;
  const dayObj = day >= 1 && day <= 14 ? getDay(day) : null;
  const dayIdx = dayObj ? [1, 3, 5].indexOf(dayObj.day) : -1;
  const defaultMove = variant ?? (dayIdx >= 0 ? rotation[dayIdx] : rotation[0]) ?? 'bike';
  const allowedMoves = tabataMoves();
  const [opts, setOpts] = useState<PresetOptions>(() => ({
    leadInSec: s.leadInSec,
    week,
    tabataMove: allowedMoves.some((m) => m.id === defaultMove) ? defaultMove : allowedMoves[0]!.id,
    sevenRounds: 2,
    sprintVariant: 'G1',
    minutes: preset === 'stamina' ? 120 : (session.defaultMinutes ?? 20),
    cycles: 2,
    restSec: 90,
    swimRounds: 10,
  }));
  const built = useMemo(() => buildPreset(preset, opts), [preset, opts]);
  const collected = useRef<Record<string, unknown>>({});
  const [, bump] = useState(0);
  const set = (patch: Record<string, unknown>) => { collected.current = { ...collected.current, ...patch }; bump((n) => n + 1); };
  const stamina = useRef({ halfway: false, hydrated: 0 });
  const [banner, setBanner] = useState('');
  const superSlow = useRef<{ exercise: string; load?: number; seconds?: number; reps?: number; pattern: string }[]>(program.superSlowPatterns.map((p) => ({ pattern: p.id, exercise: superSlowOptions(p.id)[0]! })));
  const max = hrMax(s.age);

  const preStart: ComponentChildren = (
    <div class="stack">
      {preset === 'stamina' && <div class="banner danger" data-testid="phoenix-rule"><span><strong>Phoenix rule:</strong> start before dawn or go indoors. Carry at least 0.5 L water per hour plus sodium. Turn around at the halfway time no matter how you feel. If fasted, carry a real carb source for bailout. Stop at dizziness, confusion, or cramping.</span></div>}
      {preset === 'tabata' && (
        <label class="field"><span>Movement</span>
          <select class="input" data-testid="tabata-move" value={opts.tabataMove} onChange={(e) => setOpts({ ...opts, tabataMove: (e.target as HTMLSelectElement).value })}>
            {allowedMoves.map((m) => <option key={m.id} value={m.id}>{m.name}{rotation.includes(m.id) ? ' · this week' : ''}</option>)}
          </select>
        </label>
      )}
      {preset === 'vo2' && max && (
        <div class="card" data-testid="hr-band"><div class="muted small">Target band</div><div class="mono" style="font-size:1.4rem">{Math.round(max * 0.87)}–{Math.round(max * 0.97)} bpm</div><div class="muted small">87–97% of HRmax {max} (208 − 0.7 × age)</div></div>
      )}
      {preset === 'vo2' && !max && <div class="muted small">Set your age in Kit to see the 87–97% HRmax band.</div>}
      {preset === 'sevenMinute' && (
        <label class="field"><span>Rounds{week === 2 ? ' · explosive swaps' : ''}</span>
          <div class="row">{[1, 2, 3].map((n) => <button key={n} type="button" class={`btn grow ${opts.sevenRounds === n ? 'btn-primary' : ''}`} onClick={() => setOpts({ ...opts, sevenRounds: n })}>{n}</button>)}</div>
        </label>
      )}
      {preset === 'sprints' && (
        <label class="field"><span>Preset</span>
          <div class="row">{(['G1', 'G2', 'G3'] as const).map((v) => <button key={v} type="button" class={`btn grow ${opts.sprintVariant === v ? 'btn-primary' : ''}`} onClick={() => setOpts({ ...opts, sprintVariant: v })}>{v}</button>)}</div>
          <div class="muted small">G1: 4 × (0:30 / 4:00) · G2: 5 × (0:04 / 0:20) · G3: 3 sets × 5 × (0:04 / 0:20)</div>
        </label>
      )}
      {(preset === 'coldImmersion' || preset === 'sauna' || preset === 'countdown' || preset === 'stamina') && (
        <MinutesPicker label={preset === 'stamina' ? 'Planned duration (min)' : 'Minutes'} value={opts.minutes!} min={session.minMinutes ?? (preset === 'stamina' ? 20 : 5)} max={preset === 'stamina' ? 300 : (session.maxMinutes ?? 60)} step={preset === 'stamina' ? 15 : (preset === 'countdown' ? 5 : 1)} onChange={(v) => setOpts({ ...opts, minutes: v })} />
      )}
      {preset === 'contrast' && (
        <label class="field"><span>Cycles</span><div class="row">{[2, 3].map((n) => <button key={n} type="button" class={`btn grow ${opts.cycles === n ? 'btn-primary' : ''}`} onClick={() => setOpts({ ...opts, cycles: n })}>{n}</button>)}</div></label>
      )}
      {preset === 'superSlow' && (
        <div class="stack">
          <MinutesPicker label="Rest between lifts (s)" value={opts.restSec!} min={60} max={120} step={15} onChange={(v) => setOpts({ ...opts, restSec: v })} />
          <div class="muted small">Rep length {s.repLengthSec} s (Kit). Metronome ticks every 5 s, accent on each rep.</div>
        </div>
      )}
      {preset === 'swim' && (
        <MinutesPicker label="Rounds" value={opts.swimRounds!} min={10} max={12} step={1} onChange={(v) => setOpts({ ...opts, swimRounds: v })} />
      )}
      <SessionBrief session={session} week={week} variant={preset === 'tabata' ? opts.tabataMove : variant} />
    </div>
  );

  const renderSegment = (api: RunnerApi) => {
    const seg = api.segment;
    if (!seg) return null;
    const round = seg.meta?.round as number | undefined;
    if (preset === 'tabata' && seg.kind === 'rest' && round) {
      const rounds = ((collected.current.rounds as (number | null)[]) ?? Array(8).fill(null)) as (number | null)[];
      const v = rounds[round - 1] ?? 0;
      const setR = (n: number) => { const r = [...rounds]; r[round - 1] = Math.max(0, n); set({ rounds: r, unit: built.meta.unit }); };
      return (
        <div class="card stack" data-testid="round-log">
          <div class="muted small">Round {round} · {String(built.meta.unit)}</div>
          <div class="row between wrap">
            <div class="stepper">
              <button type="button" class="btn" onClick={() => setR(v - 1)} aria-label="minus one">−</button>
              <span class="val" data-testid="round-val">{v}</span>
              <button type="button" class="btn btn-tan" onClick={() => setR(v + 1)} aria-label="plus one">+</button>
            </div>
            <div class="row"><button type="button" class="btn" onClick={() => setR(v + 5)}>+5</button><button type="button" class="btn" onClick={() => setR(v + 10)}>+10</button></div>
          </div>
        </div>
      );
    }
    if (preset === 'vo2' && seg.kind === 'rest' && round) {
      const rounds = ((collected.current.rounds as (number | null)[]) ?? Array(5).fill(null)) as (number | null)[];
      return (
        <div class="card stack" data-testid="round-log">
          <label class="field"><span class="muted small">Round {round} avg HR (or paste from Health after)</span>
            <input class="input" type="number" inputMode="numeric" value={rounds[round - 1] ?? ''} onInput={(e) => { const r = [...rounds]; r[round - 1] = Number((e.target as HTMLInputElement).value) || null; set({ rounds: r }); }} />
          </label>
        </div>
      );
    }
    if (preset === 'sprints' && seg.kind === 'rest' && round) {
      const sprints = ((collected.current.sprints as string[]) ?? []) as string[];
      return (
        <label class="field card"><span class="muted small">Sprint {round}: distance / watts / cals (optional)</span>
          <input class="input" value={sprints[round - 1] ?? ''} onInput={(e) => { const r = [...sprints]; r[round - 1] = (e.target as HTMLInputElement).value; set({ sprints: r }); }} />
        </label>
      );
    }
    if (preset === 'sevenMinute') {
      const moveId = seg.meta?.moveId as string;
      const nextId = seg.meta?.next as string | null;
      const isTransition = seg.kind === 'transition';
      return (
        <div class="row" style="justify-content:center;gap:16px" data-testid="seven-move" data-move={moveId}>
          <div class="card" style="padding:8px;display:flex;flex-direction:column;align-items:center"><Pose id={sevenMinuteMoves[moveId]?.drawingId ?? 'jumpingJacks'} size={isTransition ? 150 : 170} glow /><span class="small">{isTransition ? 'NEXT' : 'NOW'}</span></div>
          {!isTransition && nextId && <div class="card" style="padding:8px;display:flex;flex-direction:column;align-items:center;opacity:0.7"><Pose id={sevenMinuteMoves[nextId]?.drawingId ?? 'jumpingJacks'} size={90} /><span class="small muted">next: {sevenMinuteMoves[nextId]?.name ?? nextId}</span></div>}
        </div>
      );
    }
    if (preset === 'superSlow') {
      const liftIdx = ((seg.meta?.lift as number) ?? 1) - 1;
      const pattern = program.superSlowPatterns[liftIdx]!;
      const cur = superSlow.current[liftIdx]!;
      if (seg.open) {
        return (
          <div class="card stack" data-testid="lift-card">
            <div class="row between">
              <select class="input grow" value={cur.exercise} onChange={(e) => { cur.exercise = (e.target as HTMLSelectElement).value; bump((n) => n + 1); }}>
                {superSlowOptions(pattern.id).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <Pose id={pattern.drawingId} size={64} glow />
            </div>
            <label class="field"><span class="muted small">Load</span><input class="input" type="number" inputMode="decimal" value={cur.load ?? ''} onInput={(e) => { cur.load = Number((e.target as HTMLInputElement).value) || undefined; }} /></label>
            <Metronome elapsedMs={api.state.segmentElapsedMs} repLengthSec={s.repLengthSec} />
          </div>
        );
      }
      const flag = cur.seconds !== undefined ? (cur.seconds > 150 ? 'TUT > 150 s: add load' : cur.seconds < 90 ? 'TUT < 90 s: reduce load' : 'TUT in range') : '';
      return (
        <div class="card stack" data-testid="lift-rest">
          <div class="row between"><strong>{cur.exercise}</strong><span class="chip chip-tan">{cur.seconds ?? 0} s</span></div>
          {flag && <div class="muted small">{flag}</div>}
          <label class="field"><span class="muted small">Reps</span><input class="input" type="number" inputMode="numeric" value={cur.reps ?? ''} onInput={(e) => { cur.reps = Number((e.target as HTMLInputElement).value) || undefined; }} /></label>
        </div>
      );
    }
    if (preset === 'sauna' && seg.kind !== 'prep') return <BoxBreath running={api.state.status === 'running'} />;
    if (preset === 'stamina' && banner) return <div class="banner warn" data-testid="stamina-banner" role="status"><strong>{banner}</strong></div>;
    return null;
  };

  const onTick = (api: RunnerApi) => {
    if (preset !== 'stamina' || !api.segment || api.segment.kind !== 'work') return;
    const el = api.state.segmentElapsedMs;
    const half = built.meta.halfwayMs as number;
    const hyd = built.meta.hydrateEveryMs as number;
    if (!stamina.current.halfway && el >= half) {
      stamina.current.halfway = true;
      chime(); flash('work');
      setBanner('TURN AROUND');
      setTimeout(() => setBanner(''), 15000);
    }
    const hydN = Math.floor(el / hyd);
    if (hydN > stamina.current.hydrated) {
      stamina.current.hydrated = hydN;
      if (hydN > 0) { chime(); setBanner('DRINK WATER'); setTimeout(() => setBanner(''), 8000); }
    }
  };

  const onSegmentStart = (i: number, seg: { kind: string; meta?: Record<string, unknown> }, api: RunnerApi) => {
    if (preset === 'superSlow' && seg.kind === 'rest') {
      const prev = api.engine.segments[i - 1]!;
      const liftIdx = ((prev.meta?.lift as number) ?? 1) - 1;
      // seconds under tension = elapsed of the open segment just ended
      const totalBefore = api.engine.segments.slice(0, i).reduce((a, s) => a + (s.open ? 0 : s.durationMs), 0);
      const tut = Math.round((api.state.totalElapsedMs - totalBefore) / 1000);
      superSlow.current[liftIdx]!.seconds = tut;
    }
  };

  const finish = (r: RunResult) => {
    const data: Record<string, unknown> = { ...collected.current, ...built.meta };
    if (preset === 'tabata') { const rounds = (collected.current.rounds as (number | null)[]) ?? []; Object.assign(data, { movement: opts.tabataMove, rounds, ...tabataTotals(rounds) }); }
    if (preset === 'sevenMinute') data.rounds = Math.min(opts.sevenRounds ?? 1, r.completed ? opts.sevenRounds ?? 1 : Math.ceil(r.elapsedMs / 470_000));
    if (preset === 'superSlow') {
      // last lift has no rest after it: compute its TUT from total elapsed
      const last = superSlow.current[3]!;
      if (last.seconds === undefined && r.completed) {
        const fixed = built.segments.reduce((a, s) => a + (s.open ? 0 : s.durationMs), 0);
        const otherOpen = superSlow.current.slice(0, 3).reduce((a, l) => a + (l.seconds ?? 0) * 1000, 0);
        last.seconds = Math.max(0, Math.round((r.elapsedMs - fixed - otherOpen) / 1000));
      }
      data.lifts = superSlow.current.map((l) => ({ ...l }));
    }
    if (preset === 'coldImmersion' || preset === 'sauna' || preset === 'countdown' || preset === 'stamina') data.minutes = Math.round(r.elapsedMs / 60000);
    if (preset === 'stamina') data.durationMin = Math.round(r.elapsedMs / 60000);
    if (preset === 'contrast') data.totalMinutes = Math.round(r.elapsedMs / 60000);
    if (preset === 'coldShower' || preset === 'countdown') data.done = r.completed;
    onDone(r, data, preset === 'sauna' ? 'Finish with a cold shower.' : undefined);
  };

  const skipLabel = preset === 'superSlow' ? 'FAILURE' : preset === 'swim' ? 'LAP DONE' : undefined;
  const subtitle = preset === 'tabata' ? allowedMoves.find((m) => m.id === opts.tabataMove)?.name : preset === 'superSlow' ? 'push → pull → squat → hinge' : undefined;
  return <TimerRunner built={built} title={session.name} subtitle={subtitle} preStart={preStart} renderSegment={renderSegment} onTick={onTick} onSegmentStart={onSegmentStart} onDone={finish} onAbort={onAbort} skipLabel={skipLabel} snapshotKey={session.id} />;
}

function Metronome({ elapsedMs, repLengthSec }: { elapsedMs: number; repLengthSec: number }) {
  const last = useRef(-1);
  const tick = Math.floor(elapsedMs / 5000);
  const rep = Math.floor(elapsedMs / (repLengthSec * 1000)) + 1;
  const inRep = (elapsedMs % (repLengthSec * 1000)) / (repLengthSec * 1000);
  if (tick !== last.current) {
    if (last.current >= 0) tickBeep((tick * 5) % repLengthSec === 0);
    last.current = tick;
  }
  return (
    <div class="stack" style="gap:4px" data-testid="metronome" data-rep={rep}>
      <div class="row between"><span class="chip chip-signal">REP {rep}</span><span class="muted small">{repLengthSec} s per rep</span></div>
      <div class="timer-bar"><div style={`width:${inRep * 100}%;background:var(--signal)`} /></div>
    </div>
  );
}

function MinutesPicker({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div class="field">
      <span>{label}</span>
      <div class="stepper" data-testid="minutes-picker">
        <button type="button" class="btn" onClick={() => onChange(Math.max(min, value - step))} aria-label="less">−</button>
        <span class="val">{value}</span>
        <button type="button" class="btn btn-tan" onClick={() => onChange(Math.min(max, value + step))} aria-label="more">+</button>
      </div>
    </div>
  );
}
