import { useState } from 'preact/hooks';
import { program, getDay } from '@/data/program';
import { block, dayN, dateOfDay, setStartDate, shiftRemaining, startBlock, blockLabel, logsFor, todayYmd } from '@/lib/store';
import { fmtShortDate } from '@/lib/time';
import { SessionRow } from '@/components/SessionRow';

function letters(n: number): string {
  const d = getDay(n);
  return [...d.am, ...d.main, ...d.pm]
    .map((r) => {
      const s = program.sessions[r.id]!;
      return s.letter ?? (s.short ?? s.name).split(' ')[0];
    })
    .join(' · ');
}

export function Schedule() {
  const b = block.value;
  const cur = dayN.value;
  const [preview, setPreview] = useState<number | null>(null);
  const [editStart, setEditStart] = useState(false);
  const [date, setDate] = useState(b?.startDate ?? todayYmd.value);
  const [nextDate, setNextDate] = useState(todayYmd.value);

  const cell = (n: number) => {
    const d = getDay(n);
    const cls = d.load === 'High' ? 'chip-signal' : d.load === 'Moderate' ? 'chip-tan' : 'chip-rest';
    const done = logsFor(n).filter((l) => l.completed).length;
    const isToday = cur === n;
    const past = cur !== null && n < cur;
    return (
      <button type="button" key={n} class={`daycell ${isToday ? 'today' : ''} ${past ? 'past' : ''}`} onClick={() => setPreview(n)} data-testid={`day-${n}`} aria-label={`Day ${n}`}>
        <div class="row between"><span class="d">D{String(d.day).padStart(2, '0')}</span><span class={`chip ${cls}`} style="font-size:0.5rem;padding:1px 5px">{d.load.split(' ')[0]}</span></div>
        <span class="s">{b ? fmtShortDate(dateOfDay(n)!) : `Day ${n}`}</span>
        <span class="s">{letters(n)}</span>
        {done > 0 && <span class="s" style="color:var(--rest-hi)">{done} logged</span>}
      </button>
    );
  };

  return (
    <main class="screen">
      <div class="section-h"><h1>Schedule</h1></div>
      {b && <div class="muted small">{blockLabel(b.n)} · starts {b.startDate}{b.shift ? ` · shifted +${b.shift}` : ''}</div>}
      <div class="sched">
        <div class="col"><h2>Week 1</h2>{[1, 2, 3, 4, 5, 6, 7].map(cell)}</div>
        <div class="col"><h2>Week 2</h2>{[8, 9, 10, 11, 12, 13, 14].map(cell)}</div>
      </div>

      <div class="card stack">
        <h3>ADJUST</h3>
        <button type="button" class="btn" data-testid="shift-btn" disabled={!b} onClick={() => confirm('Push the remaining days by one day?') && shiftRemaining(1)}>Shift remaining days +1 (missed a day)</button>
        {!editStart ? (
          <button type="button" class="btn" onClick={() => setEditStart(true)}>{b ? 'Edit start date' : 'Set start date'}</button>
        ) : (
          <div class="row">
            <input class="input grow" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} data-testid="edit-start-input" />
            <button type="button" class="btn btn-primary" data-testid="edit-start-save" onClick={() => { void setStartDate(date); setEditStart(false); }}>Save</button>
          </div>
        )}
        <details>
          <summary class="muted small">Start next block</summary>
          <div class="row" style="margin-top:8px">
            <input class="input grow" type="date" value={nextDate} onInput={(e) => setNextDate((e.target as HTMLInputElement).value)} data-testid="next-block-input" />
            <button type="button" class="btn btn-tan" data-testid="next-block-btn" onClick={() => confirm(`Start ${blockLabel((b?.n ?? 0) + 1)}? Past blocks stay in history.`) && startBlock(nextDate)}>Start {blockLabel((b?.n ?? 0) + 1)}</button>
          </div>
        </details>
      </div>

      <div class="card stack">
        <h3>ORDER WITHIN A DAY</h3>
        <p class="small muted">{program.meta.orderWithinDay}</p>
      </div>

      {preview !== null && (
        <div class="modal-bg" onClick={() => setPreview(null)}>
          <div class="modal stack" role="dialog" aria-label={`Day ${preview}`} onClick={(e) => e.stopPropagation()} data-testid="day-preview">
            <div class="row between"><h2>Day {String(preview).padStart(2, '0')} · W{getDay(preview).week} D{getDay(preview).day}</h2><button type="button" class="btn btn-ghost" onClick={() => setPreview(null)}>Close</button></div>
            <div class="muted small">{getDay(preview).load} · {getDay(preview).timeEstimate}{b ? ` · ${fmtShortDate(dateOfDay(preview)!)}` : ''}</div>
            <h3>AM PT</h3>{getDay(preview).am.map((r, i) => <SessionRow key={i} r={r} day={preview} slot="am" compact />)}
            <h3>Main effort</h3>{getDay(preview).main.map((r, i) => <SessionRow key={i} r={r} day={preview} slot="main" compact />)}
            <h3>Recovery</h3>{getDay(preview).pm.length ? getDay(preview).pm.map((r, i) => <SessionRow key={i} r={r} day={preview} slot="pm" compact />) : <div class="muted small">—</div>}
          </div>
        </div>
      )}
    </main>
  );
}
