import { useState } from 'preact/hooks';
import { route, navigate } from '@/router';
import { program, foundationExercises } from '@/data/program';
import type { Session, FoundationExercise } from '@/data/schema';
import { Pose } from '@/components/Pose';
import { foundationFrames } from '@/components/Steppers';
import { SessionBrief } from '@/components/SessionBrief';
import { getDay } from '@/data/program';
import { dayN } from '@/lib/store';
import { tabataMovements } from '@/data/program';

/** Session brief. Reached from the Library (no day) or from a Today/Schedule row (day + slot → Start button). */
function SessionDetail({ s, query }: { s: Session; query: URLSearchParams }) {
  const dayQ = query.get('day');
  const day = dayQ ? Number(dayQ) : null;
  const slot = query.get('slot');
  const variant = query.get('variant') ?? undefined;
  const dayObj = day && day >= 1 && day <= 14 ? getDay(day) : dayN.value && dayN.value >= 1 && dayN.value <= 14 ? getDay(dayN.value) : getDay(1);
  const fromDay = day !== null && !!slot;
  const startUrl = `/session/${s.id}?day=${day ?? dayN.value ?? 1}&slot=${slot ?? 'main'}${variant ? `&variant=${variant}` : ''}`;
  const variantLabel = s.id === 'A' && variant ? tabataMovements[variant]?.name : s.id === 'B' && variant ? (variant === 'seqA' ? 'Sequence A' : variant === 'seqB' ? 'Sequence B' : 'Applied day') : undefined;
  return (
    <main class="screen" data-testid="session-detail" style={fromDay ? 'padding-bottom:calc(var(--tabbar-h) + var(--safe-bottom) + 110px)' : undefined}>
      <div class="row between">
        <button type="button" class="btn btn-ghost" onClick={() => (fromDay ? history.back() : navigate('/library'))}>← Back</button>
        {fromDay && <span class="chip chip-tan">Day {String(day).padStart(2, '0')} · {slot === 'am' ? 'AM PT' : slot === 'pm' ? 'Recovery' : slot === 'habit' ? 'Standing order' : 'Main effort'}</span>}
      </div>
      <div class="section-h"><h1 style="font-size:1.2rem;white-space:normal">{s.letter ? `${s.letter}. ` : ''}{s.name}{variantLabel ? ` · ${variantLabel}` : ''}</h1></div>
      <SessionBrief session={s} week={dayObj.week} variant={variant} />
      {s.id === 'A' && <div class="muted small">Rotation · W1: {program.tabataRotation.w1.map((m) => tabataMovements[m]!.name).join(' → ')} · W2: {program.tabataRotation.w2.map((m) => tabataMovements[m]!.name).join(' → ')}</div>}
      {s.id === 'B' && !variant && <FoundationList />}
      {s.ch10System && <div class="muted small">System: {s.ch10System}</div>}
      {fromDay && (
        <div class="sticky-cta"><button type="button" class="btn btn-primary btn-xl btn-block" data-testid="brief-start" onClick={() => navigate(startUrl)}>START</button></div>
      )}
    </main>
  );
}

function FoundationDetail({ ex }: { ex: FoundationExercise }) {
  return (
    <main class="screen" data-testid="foundation-detail">
      <button type="button" class="btn btn-ghost" style="align-self:flex-start" onClick={() => navigate('/library')}>← Library</button>
      <div class="section-h"><h1 style="font-size:1.2rem;white-space:normal">{ex.name}</h1></div>
      <div class="pose-strip">{foundationFrames(ex).map((f) => <Pose key={f} id={f} size={120} />)}</div>
      <ol>{ex.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <div class="muted small">Should fatigue: <strong>{ex.fatigueTarget}</strong> · 3 reps</div>
    </main>
  );
}

function FoundationList() {
  return (
    <div class="stack">
      <h2>Sequence A · D1/D3/D5</h2>
      {program.foundation.seqA.map((e, i) => <ExRow key={e.id} n={i + 1} ex={e} />)}
      <h2>Sequence B · D2/D4/D6</h2>
      {program.foundation.seqB.map((e, i) => <ExRow key={e.id} n={i + 1} ex={e} />)}
      <div class="card small"><strong>Day 7.</strong> {program.foundation.day7}</div>
      <div class="card small"><strong>As the warm-up.</strong> {program.foundation.asWarmup}</div>
    </div>
  );
}
function ExRow({ n, ex }: { n: number; ex: FoundationExercise }) {
  return (
    <button type="button" class="card row" style="text-align:left;cursor:pointer;gap:10px" onClick={() => navigate(`/library/${ex.id}`)}>
      <Pose id={foundationFrames(ex)[0]!} size={56} />
      <div class="grow"><strong>{n}. {ex.name}</strong><div class="muted small">{ex.fatigueTarget}</div></div>
      <span class="muted">›</span>
    </button>
  );
}
function SevenMinuteList() {
  return (
    <div class="stack">
      <h2>The 12 moves</h2>
      {program.sevenMinute.map((m, i) => (
        <div key={m.id} class="card row" style="gap:10px">
          <Pose id={m.drawingId} size={56} />
          <div class="grow">
            <strong>{i + 1}. {m.name}</strong>
            <div class="muted small">{m.cue}</div>
            {m.w2Swap && <div class="muted small">W2 swap: {m.w2Swap.name}</div>}
          </div>
          {m.w2Swap && <Pose id={m.w2Swap.drawingId} size={44} />}
        </div>
      ))}
    </div>
  );
}
function SuperSlowList() {
  return (
    <div class="stack">
      <h2>Patterns</h2>
      {program.superSlowPatterns.map((p, i) => (
        <div key={p.id} class="card row" style="gap:10px"><Pose id={p.drawingId} size={56} /><div><strong>{i + 1}. {p.name}</strong><div class="muted small">{p.options.join(' · ')}</div></div></div>
      ))}
    </div>
  );
}
function StationList() {
  return (
    <div class="stack">
      <h2>15 stations</h2>
      <table class="tbl"><thead><tr><th>#</th><th>Movement</th><th>Foam roll</th><th></th></tr></thead>
        <tbody>{program.mobilityStations.map((s) => <tr key={s.n}><td class="mono">{s.n}</td><td>{s.movement}</td><td>{s.roll}</td><td><Pose id={s.rollDrawingId} size={40} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Reference() {
  const r = program.rules;
  return (
    <div class="stack" data-testid="reference">
      <h2>Standing protocols</h2>
      <table class="tbl"><thead><tr><th>Protocol</th><th>Dose</th><th>Frequency</th></tr></thead>
        <tbody>{r.standingProtocols.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.dose}</td><td>{p.frequency}</td></tr>)}</tbody></table>
      <h2>Phoenix adjustments</h2>
      {r.phoenixAdjustments.map((x) => <div key={x.id} class="card small"><strong>{x.title}.</strong> {x.text}</div>)}
      <h2>Execution rules</h2>
      {r.executionRules.map((x) => <div key={x.id} class="card small"><strong>{x.title}.</strong> {x.text}</div>)}
      <h2>Dose framework (Ch. 10)</h2>
      <table class="tbl"><thead><tr><th>System</th><th>Minimum effective dose</th><th>Covered by</th><th>W1 / W2</th></tr></thead>
        <tbody>{r.doseFramework.map((x) => <tr key={x.system}><td>{x.system}</td><td>{x.dose}</td><td>{x.coveredBy}</td><td>{x.w1w2}</td></tr>)}</tbody></table>
      <h2>Upper-limit check</h2>
      <p class="small muted">{r.upperLimit.text}</p>
      <table class="tbl"><thead><tr><th>Vigorous work</th><th>W1</th><th>W2</th><th>Ceiling</th></tr></thead>
        <tbody>{r.upperLimit.rows.map((x) => <tr key={x.item}><td>{x.item}</td><td>{x.w1}</td><td>{x.w2}</td><td>{x.ceiling}</td></tr>)}</tbody></table>
      <h2>Evidence flags</h2>
      {r.evidenceFlags.map((x) => <div key={x.id} class="card small"><strong>{x.title}.</strong> {x.text}</div>)}
    </div>
  );
}

export function Library() {
  const r = route.value;
  const id = r.parts[1];
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'library' | 'reference'>(id === 'reference' ? 'reference' : 'library');
  if (id && id !== 'reference') {
    if (program.sessions[id]) return <SessionDetail s={program.sessions[id]!} query={r.query} />;
    if (foundationExercises[id]) return <FoundationDetail ex={foundationExercises[id]!} />;
  }
  const ql = q.trim().toLowerCase();
  const match = (...xs: (string | undefined | null)[]) => !ql || xs.some((x) => x && x.toLowerCase().includes(ql));
  const sessions = Object.values(program.sessions).filter((s) => match(s.name, s.short, s.letter, s.purpose, ...s.cues));
  const fnd = [...program.foundation.seqA, ...program.foundation.seqB].filter((e) => match(e.name, e.fatigueTarget, ...e.steps));
  return (
    <main class="screen" data-testid="library">
      <div class="section-h"><h1>Library</h1></div>
      <div class="row">{(['library', 'reference'] as const).map((t) => <button key={t} type="button" class={`btn grow ${tab === t ? 'btn-primary' : ''}`} onClick={() => setTab(t)}>{t === 'library' ? 'Sessions' : 'Reference'}</button>)}</div>
      {tab === 'reference' && <Reference />}
      {tab === 'library' && (
        <>
          <input class="input" type="search" placeholder="Search sessions, cues, muscles…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} data-testid="search" />
          <h2>Sessions</h2>
          {sessions.map((s) => (
            <button key={s.id} type="button" class="card row" style="text-align:left;cursor:pointer;gap:10px" onClick={() => navigate(`/library/${s.id}`)} data-testid="library-session">
              <Pose id={s.drawingId} size={56} />
              <div class="grow"><strong>{s.letter ? <span class="mono muted">{s.letter}. </span> : ''}{s.name}</strong><div class="muted small">{s.purpose}</div></div>
              <span class="muted">›</span>
            </button>
          ))}
          {fnd.length > 0 && <><h2>Foundation</h2>{fnd.map((e) => <ExRow key={e.id} n={(program.foundation.seqA.indexOf(e) >= 0 ? program.foundation.seqA.indexOf(e) : program.foundation.seqB.indexOf(e)) + 1} ex={e} />)}</>}
          {!ql && <><SevenMinuteList /><SuperSlowList /><StationList /></>}
        </>
      )}
    </main>
  );
}
