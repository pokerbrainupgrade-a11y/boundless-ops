import { useState } from 'preact/hooks';
import { program, getDay, BLOCK_DAYS, BLOCK_WEEKS } from '@/data/program';
import { block, dayN, dateOfDay, setStartDate, setCurrentDay, startBlock, blockLabel, dayLabel, logsFor, todayYmd } from '@/lib/store';
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
  const [jump, setJump] = useState('');

  const cell = (n: number) => {
    const d = getDay(n);
    const cls = d.load === 'High' ? 'chip-signal' : d.load === 'Moderate' ? 'chip-tan' : 'chip-rest';
    const done = logsFor(n).filter((l) => l.completed).length;
    const isToday = cur === n;
    const past = cur !== null && n < cur;
    const date = b ? dateOfDay(n) : null;
    return (
      <button type="button" key={n} class={`daycell ${isToday ? 'today' : ''} ${past ? 'past' : ''}`} onClick={() => setPreview(n)} data-testid={`day-${n}`} data-state={isToday ? 'current' : past ? 'done' : 'upcoming'} aria-label={`Day ${n}`}>
        <div class="row between"><span class="d">D{String(d.day).padStart(2, '0')}</span><span class={`chip ${cls}`} style="font-size:0.5rem;padding:1px 5px">{d.load.split(' ')[0]}</span></div>
        <span class="s">{date ? fmtShortDate(date) : past ? 'done' : isToday ? 'today' : `Day ${n}`}</span>
        <span class="s">{letters(n)}</span>
        {done > 0 && <span class="s" style="color:var(--rest-hi)">{done} logged</span>}
      </button>
    );
  };

  return (
    <main class="screen">
      <div class="section-h"><h1>Schedule</h1></div>
      {b && <div class="muted small">{blockLabel(b.n)} · starts {b.startDate}{cur !== null && cur >= 1 ? ` · on ${cur > BLOCK_DAYS ? 'the finish line' : dayLabel(cur)}` : ''}</div>}
      <p class="muted small" style="margin:0">Days do not follow the calendar. Today moves on when the current day's required sessions are all logged, or when you tap Complete All.</p>
      {Array.from({ length: Math.ceil(BLOCK_WEEKS / 2) }, (_, r) => (
        <div class="sched" key={r}>
          {[r * 2 + 1, r * 2 + 2].filter((w) => w <= BLOCK_WEEKS).map((w) => (
            <div class="col" key={w} data-testid={`week-${w}`}><h2>Week {w}</h2>{Array.from({ length: 7 }, (_, i) => (w - 1) * 7 + i + 1).map(cell)}</div>
          ))}
        </div>
      ))}
      <div class="card stack"><h3>SIX-WEEK BLOCK</h3><p class="small muted" style="margin:0">{program.meta.blockNote}</p></div>

      <div class="card stack">
        <h3>ADJUST</h3>
        <div class="row">
          <input class="input grow" type="number" inputMode="numeric" min={1} max={BLOCK_DAYS} placeholder={cur !== null && cur >= 1 && cur <= BLOCK_DAYS ? `Jump to day (now ${cur})` : 'Jump to day'} value={jump} onInput={(e) => setJump((e.target as HTMLInputElement).value)} data-testid="jump-day-input" disabled={!b} />
          <button type="button" class="btn" data-testid="jump-day-btn" disabled={!b || !jump || Number(jump) < 1 || Number(jump) > BLOCK_DAYS} onClick={() => { void setCurrentDay(Number(jump)); setJump(''); }}>Set current day</button>
        </div>
        <p class="muted small" style="margin:0">Skip ahead after a missed day, or go back to redo one. Logged sessions stay in the AAR.</p>
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
        <div class="modal-full stack" role="dialog" aria-label={`Day ${preview}`} data-testid="day-preview">
          <div class="row between modal-head"><div><h2>Day {String(preview).padStart(2, '0')} · W{getDay(preview).week} D{getDay(preview).day}</h2><div class="muted small">{getDay(preview).load} · {getDay(preview).timeEstimate}{b && dateOfDay(preview) ? ` · ${fmtShortDate(dateOfDay(preview)!)}` : ''}</div></div><button type="button" class="btn btn-ghost" onClick={() => setPreview(null)}>Close</button></div>
          <p class="muted small" style="margin:0">Tap a session to see its exercises and cues before you start it.</p>
          <section class="card stack"><h3>AM PT</h3>{getDay(preview).am.map((r, i) => <SessionRow key={i} r={r} day={preview} slot="am" />)}</section>
          <section class="card stack"><h3>MAIN EFFORT</h3>{getDay(preview).main.map((r, i) => <SessionRow key={i} r={r} day={preview} slot="main" />)}</section>
          <section class="card stack"><h3>RECOVERY</h3>{getDay(preview).pm.length ? getDay(preview).pm.map((r, i) => <SessionRow key={i} r={r} day={preview} slot="pm" />) : <div class="muted small">Nothing scheduled.</div>}</section>
          <div class="row" style="justify-content:space-between">
            <button type="button" class="btn" disabled={preview <= 1} onClick={() => setPreview(preview - 1)}>← Previous day</button>
            <button type="button" class="btn" disabled={preview >= BLOCK_DAYS} onClick={() => setPreview(preview + 1)}>Next day →</button>
          </div>
        </div>
      )}
    </main>
  );
}
