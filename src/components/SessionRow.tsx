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
  const url = `/session/${r.id}?day=${day}&slot=${slot}${r.variant ? `&variant=${r.variant}` : ''}`;
  return (
    <div class={`row between ${done ? 'done' : ''}`} data-testid="session-row" data-session={r.id} data-done={done} style="min-height:var(--tap);gap:10px">
      {!compact && <Pose id={s.drawingId} size={44} />}
      <div class="grow" style="min-width:0">
        <div style="font-weight:600">{s.letter ? <span class="muted mono small">{s.letter}. </span> : null}{s.short ?? s.name}{variantLabel ? <span class="muted"> · {variantLabel}</span> : null}</div>
        <div class="muted small">{r.note}{r.optional ? (r.note ? ' · ' : '') + 'optional' : ''}</div>
      </div>
      <button type="button" class={`btn ${done ? 'btn-rest' : 'btn-primary'}`} data-testid="start-session" onClick={() => navigate(url)} aria-label={`${done ? 'Redo' : 'Start'} ${s.name}`}>{done ? '✓ Again' : 'Start'}</button>
    </div>
  );
}
