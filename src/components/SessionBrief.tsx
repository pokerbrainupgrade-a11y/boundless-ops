import { program, foundationSequence, sevenMinuteMoves, tabataMovements, tabataRotationFor, sevenExplosive, sevenRoundsFor, superSlowDefault, sprintPresetFor } from '@/data/program';
import type { Session } from '@/data/schema';
import { sevenMinuteSequence } from '@/lib/presets';
import { Pose } from './Pose';

export interface BriefProps {
  session: Session;
  week: number;
  /** Tabata movement id or Foundation seqA | seqB | applied. */
  variant?: string;
  /** Skip the title block (when the host screen already shows it). */
  noHeader?: boolean;
}

/**
 * Everything to review before pressing Start: the drawing, purpose, and the
 * exercises this session will walk through (Foundation exercises, the 12
 * seven-minute moves for the week, the 15 stations, the four lifts, the Tabata
 * movement), plus cues and safety notes.
 */
export function SessionBrief({ session: s, week, variant, noHeader = false }: BriefProps) {
  const preset = s.timerPreset;
  return (
    <div class="stack" data-testid="session-brief">
      {!noHeader && (
        <div class="row" style="gap:12px;align-items:flex-start">
          <Pose id={s.drawingId} size={96} glow />
          <div class="grow">
            <div style="font-weight:700;font-size:1.1rem">{s.letter ? <span class="mono muted">{s.letter}. </span> : null}{s.name}</div>
            <p class="muted small" style="margin:4px 0 0">{s.purpose}</p>
          </div>
        </div>
      )}

      {preset === 'foundation' && <FoundationBrief variant={variant} />}
      {preset === 'sevenMinute' && <SevenBrief week={week} />}
      {preset === 'mobility' && <MobilityBrief />}
      {preset === 'superSlow' && <SuperSlowBrief week={week} />}
      {preset === 'sprints' && <div class="card"><strong>This week's preset: {sprintPresetFor(week)}</strong><div class="muted small">G1: 4 × (0:30 all out / 4:00 easy) · G2: 5 × (0:04 / 0:20) · G3: 3 sets × 5 × (0:04 / 0:20)</div></div>}
      {preset === 'tabata' && <TabataBrief week={week} variant={variant} />}
      {preset === 'decompression' && (
        <div class="card stack" style="gap:6px">
          <h3>The four cues</h3>
          <ol style="padding-left:1.2em;margin:0;display:flex;flex-direction:column;gap:6px">{program.foundation.breathing.cues.map((c) => <li key={c.name}><strong>{c.name}.</strong> {c.text}</li>)}</ol>
        </div>
      )}

      <div class="card stack" style="gap:6px">
        <h3>Cues</h3>
        <ul class="small" style="display:flex;flex-direction:column;gap:4px">{s.cues.map((x) => <li key={x}>{x}</li>)}</ul>
        {s.dose && <p class="muted small" style="margin:4px 0 0">{s.dose}</p>}
      </div>
      {s.safety.length > 0 && (
        <div class="banner danger" data-testid="brief-safety"><ul class="small" style="display:flex;flex-direction:column;gap:4px">{s.safety.map((x) => <li key={x}>{x}</li>)}</ul></div>
      )}
    </div>
  );
}

function FoundationBrief({ variant }: { variant?: string }) {
  const seq = variant === 'seqB' ? 'B' : variant === 'applied' ? 'applied' : 'A';
  if (seq === 'applied') {
    return (
      <div class="card stack" style="gap:8px">
        <h3>Day 7 · applied, not trained</h3>
        <p class="small" style="margin:0">{program.foundation.day7}</p>
        <div class="row" style="justify-content:center"><Pose id="integratedHinges" size={110} /><Pose id="kneelingDecompression" size={110} /></div>
      </div>
    );
  }
  const list = foundationSequence(seq);
  return (
    <div class="stack" style="gap:8px">
      <h2>Sequence {seq} · {list.length} exercises · 3 reps each</h2>
      {list.map((ex, i) => (
        <details key={ex.id} class="card" style="padding:10px 12px" data-testid="brief-exercise">
          <summary class="row" style="gap:10px;cursor:pointer;list-style:none">
            <Pose id={(ex.frames ?? [ex.drawingId])[0]!} size={56} />
            <div class="grow"><strong>{i + 1}. {ex.name}</strong><div class="muted small">Fatigue: {ex.fatigueTarget}</div></div>
            <span class="muted">›</span>
          </summary>
          <div class="pose-strip" style="margin-top:8px">{(ex.frames ?? [ex.drawingId]).map((f) => <Pose key={f} id={f} size={100} />)}</div>
          <ol class="small" style="padding-left:1.2em;margin:6px 0 0;display:flex;flex-direction:column;gap:4px">{ex.steps.map((st) => <li key={st}>{st}</li>)}</ol>
        </details>
      ))}
    </div>
  );
}

function SevenBrief({ week }: { week: number }) {
  const seq = sevenMinuteSequence(week);
  return (
    <div class="stack" style="gap:8px">
      <h2>Week {week} · {sevenExplosive(week) ? 'explosive swaps' : 'base moves'} · {sevenRoundsFor(week)} rounds · 30 s on / 10 s off</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        {seq.map((m, i) => (
          <div key={m.id} class="card" style="padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center" data-testid="brief-move">
            <Pose id={m.drawingId} size={84} />
            <strong class="small">{i + 1}. {m.name}</strong>
            <span class="muted" style="font-size:0.75rem">{m.cue}</span>
            {m.swapped && <span class="chip chip-od" style="font-size:0.55rem">swap for {sevenMinuteMoves[m.baseId]?.name}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MobilityBrief() {
  return (
    <div class="stack" style="gap:8px">
      <h2>15 stations · 20–30 slow passes each</h2>
      <table class="tbl"><thead><tr><th>#</th><th>Movement</th><th>Foam roll</th><th></th></tr></thead>
        <tbody>{program.mobilityStations.map((st) => <tr key={st.n}><td class="mono">{st.n}</td><td>{st.movement}</td><td>{st.roll}</td><td><Pose id={st.rollDrawingId} size={44} /></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function SuperSlowBrief({ week }: { week: number }) {
  return (
    <div class="stack" style="gap:8px">
      <h2>Four lifts · one set each to failure · week {week}</h2>
      {program.superSlowPatterns.map((p, i) => (
        <div key={p.id} class="card row" style="gap:10px;padding:10px 12px"><Pose id={p.drawingId} size={56} /><div><strong>{i + 1}. {p.name}: {superSlowDefault(p.id, week)}</strong><div class="muted small">Rotation: {p.options.join(' → ')}</div></div></div>
      ))}
    </div>
  );
}

function TabataBrief({ week, variant }: { week: number; variant?: string }) {
  const rotation = tabataRotationFor(week);
  const move = variant ? tabataMovements[variant] : undefined;
  return (
    <div class="stack" style="gap:8px">
      <h2>8 × (20 s all out / 10 s rest)</h2>
      {move && (
        <div class="card row" style="gap:10px;padding:10px 12px"><Pose id={move.drawingId} size={72} glow /><div><strong>Today: {move.name}</strong><div class="muted small">Log {move.unit} each round during the 10 s rest.</div></div></div>
      )}
      <div class="muted small">Week {week} rotation (D1 → D3 → D5): {rotation.map((id) => tabataMovements[id]?.name ?? id).join(' → ')}</div>
    </div>
  );
}
