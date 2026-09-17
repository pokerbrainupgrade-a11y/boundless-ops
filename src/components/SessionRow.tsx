import { navigate } from '@/router';
import type { SessionRef } from '@/data/schema';
import { program, tabataMovements } from '@/data/program';
import { logsFor } from '@/lib/store';
import { Pose } from './Pose';

/** One scheduled session inside a Today/Schedule card. */
export function SessionRow({ r, day, slot, compact = false }: { r: SessionRef; day: number; slot: 'am' | 'main' | 'pm'; compact?: boolean }) {
  const s = program.sessions[r.id]!;
  const done = logsFor(day, r.id, slot).some((l) => l.completed);
  const variantLabel = r.id === 'A' && r.variant ? tabataMovements[r.variant]?.name : r.id === 'B' && r.variant ? (r.variant === 'seqA' ? 'Seq A' : r.variant === 'seqB' ? 'Seq B' : 'Applied') : undefined;
  const q = `day=${day}&slot=${slot}${r.variant ? `&variant=${r.variant}` : ''}`;
  const url = `/session/${r.id}?${q}`;
  return (
    <div class={`row between ${done ? 'done' : ''}`} data-testid="session-row" data-session={r.id} data-done={done} style="min-height:var(--tap);gap:10px">
      <button type="button" class="row grow" data-testid="view-session" style="min-width:0;gap:10px;background:none;border:0;padding:0;text-align:left;cursor:pointer;min-height:var(--tap)" onClick={() => navigate(`/library/${r.id}?${q}`)} aria-label={`View ${s.name}`}>
        {!compact && <Pose id={s.drawingId} size={44} />}
        <div class="grow" style="min-width:0">
          <div style="font-weight:600">{s.letter ? <span class="muted mono small">{s.letter}. </span> : null}{s.short ?? s.name}{variantLabel ? <span class="muted"> · {variantLabel}</span> : null}</div>
          <div class="muted small">{[r.note, r.optional ? 'optional' : ''].filter(Boolean).join(' · ')}{r.note || r.optional ? ' · ' : ''}<span style="color:var(--tan);text-decoration:underline">view</span></div>
        </div>
      </button>
      <button type="button" class={`btn ${done ? 'btn-rest' : 'btn-primary'}`} data-testid="start-session" onClick={() => navigate(url)} aria-label={`${done ? 'Redo' : 'Start'} ${s.name}`}>{done ? '✓ Again' : 'Start'}</button>
    </div>
  );
}
