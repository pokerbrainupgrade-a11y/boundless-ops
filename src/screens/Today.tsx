import { useState } from 'preact/hooks';
import { navigate } from '@/router';
import { program, getDay, BLOCK_DAYS, BLOCK_WEEKS } from '@/data/program';
import { block, dayN, todayYmd, startBlock, habitDone, toggleHabit, logs, blockLabel, dayLabel, vitals, saveVital, remainingToday, completeDay } from '@/lib/store';
import { daySessions } from '@/lib/progress';
import { settings } from '@/lib/settings';
import { fmtDate, daysBetween } from '@/lib/time';
import { SessionRow } from '@/components/SessionRow';
import { StackRow } from '@/components/StackRow';
import { BLOCK_ORDER } from '@/data/stackSchema';
import { blockProgress, fastedConflict } from '@/lib/stack';
import { stackItemsResolved, stackLogIndex } from '@/lib/store';
import { blockDue, blockLabel as stackBlockLabel, fastedAmToday, fastedSessionLogged, highLoadToday } from '@/screens/Stack';
import { DayCelebrationCard, dayCelebrationActive } from '@/components/Celebration';
import { unlockAudio } from '@/lib/audio';

export function LoadChip({ load }: { load: string }) {
  const cls = load === 'High' ? 'chip-signal' : load === 'Moderate' ? 'chip-tan' : 'chip-rest';
  return <span class={`chip ${cls}`} data-testid="load-chip">{load}</span>;
}

function StartDateCard({ title, next = false }: { title: string; next?: boolean }) {
  const [date, setDate] = useState(todayYmd.value);
  return (
    <div class="card stack" data-testid="start-date-card">
      <h3>{title}</h3>
      <p class="muted small">Pick the calendar day Day 01 opens. After that, Today moves to the next day only when you complete the current one.</p>
      <input class="input" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} data-testid="start-date-input" />
      <button type="button" class="btn btn-primary btn-lg" data-testid="start-block" onClick={() => date && startBlock(date)}>{next ? `Start ${blockLabel((block.value?.n ?? 0) + 1)}` : 'Start Operation Block 01'}</button>
    </div>
  );
}

export function Today() {
  const b = block.value;
  const n = dayN.value;
  const s = settings.value;

  const exportWarn = (() => {
    if (!logs.value.length) return false;
    if (!s.lastExportAt) return true;
    return daysBetween(s.lastExportAt.slice(0, 10), todayYmd.value) > 7;
  })();

  if (!b) {
    return (
      <main class="screen">
        <Header />
        <StartDateCard title="Set your start date" />
        <p class="muted small">{program.meta.orderWithinDay}</p>
      </main>
    );
  }
  if (n !== null && n < 1) {
    return (
      <main class="screen">
        <Header />
        <div class="card"><h3>{blockLabel(b.n)} starts {fmtDate(b.startDate)}</h3><p class="muted small">{1 - n} day{1 - n === 1 ? '' : 's'} to go. Preview the plan in Schedule.</p><button type="button" class="btn" onClick={() => navigate('/schedule')}>Open Schedule</button></div>
      </main>
    );
  }
  if (n !== null && n > BLOCK_DAYS) {
    return (
      <main class="screen">
        <Header />
        <div class="card"><h3>{blockLabel(b.n)} complete</h3><p class="muted small">Past blocks stay in the AAR and Intel tabs.</p></div>
        <StartDateCard title={`Start ${blockLabel(b.n + 1)}`} next />
      </main>
    );
  }

  const day = getDay(n!);
  const fnd = day.foundation === 'applied' ? 'Applied' : `Seq ${day.foundation}`;
  const today = todayYmd.value;
  const v = vitals.value.find((x) => x.date === today);

  return (
    <main class="screen" data-testid="today" data-day={n}>
      <Header />
      <div class="row wrap" style="gap:8px">
        <span class="chip chip-outline">{blockLabel(b.n)}</span>
        <span class="chip chip-tan" data-testid="day-chip">{dayLabel(n!)}</span>
        <span class="chip chip-outline">Week {day.week} / {BLOCK_WEEKS}</span>
        <LoadChip load={day.load} />
      </div>
      <div class="muted small">{fmtDate(today)} · about {day.timeEstimate}{s.callsign ? ` · ${s.callsign}` : ''}</div>
      {exportWarn && <div class="banner warn" data-testid="export-warning"><span>Over 7 days since your last backup. Export your data in Kit; iOS can evict on-device storage.</span><button type="button" class="btn" style="min-height:40px" onClick={() => navigate('/kit')}>Export</button></div>}

      <section class="card active stack" data-testid="card-am">
        <div class="row between"><h3>AM PT</h3><span class="chip chip-muted">fasted</span></div>
        {day.am.map((r, i) => <SessionRow key={i} r={r} day={n!} slot="am" />)}
      </section>
      <section class="card stack" data-testid="card-main">
        <div class="row between"><h3>MAIN EFFORT</h3><span class="chip chip-od" data-testid="foundation-badge">Foundation {day.foundation === 'applied' ? 'applied' : `${fnd} · ${day.foundationMode}`}</span></div>
        {day.main.map((r, i) => <SessionRow key={i} r={r} day={n!} slot="main" />)}
      </section>
      <section class="card stack" data-testid="card-pm">
        <div class="row between"><h3>RECOVERY</h3><span class="chip chip-muted">PM</span></div>
        {day.pm.length ? day.pm.map((r, i) => <SessionRow key={i} r={r} day={n!} slot="pm" />) : <div class="muted small">Nothing scheduled. Post-meal walk and evening breaths.</div>}
      </section>

      <CompleteAllCard n={n!} />

      <StackStrip />

      <section class="card stack" data-testid="habits">
        <h3>DAILY STANDING ORDERS</h3>
        <WakeBlock />
        {program.habits.map((h) => {
          const on = habitDone(h.id);
          return (
            <div key={h.id} class="row" style="gap:4px">
              <button type="button" class={`check grow ${on ? 'on' : ''}`} role="checkbox" aria-checked={on} onClick={() => toggleHabit(h.id)} data-testid={`habit-${h.id}`}>
                <span class="box" aria-hidden="true">{on ? '✓' : ''}</span>
                <span class="label">{h.label}</span>
              </button>
              {h.sessionId && <button type="button" class="btn btn-icon" aria-label={`Run ${h.label}`} onClick={() => navigate(`/session/${h.sessionId}?day=${n}&slot=habit`)}>▶</button>}
            </div>
          );
        })}
      </section>

      <section class="card stack">
        <h3>MORNING CHECK</h3>
        <div class="row">
          <label class="field grow"><span class="small muted">Resting HR</span><input class="input" type="number" inputMode="numeric" value={v?.restingHr ?? ''} onChange={(e) => saveVital({ date: today, restingHr: Number((e.target as HTMLInputElement).value) || undefined, hrv: v?.hrv })} /></label>
          <label class="field grow"><span class="small muted">HRV</span><input class="input" type="number" inputMode="numeric" value={v?.hrv ?? ''} onChange={(e) => saveVital({ date: today, restingHr: v?.restingHr, hrv: Number((e.target as HTMLInputElement).value) || undefined })} /></label>
        </div>
        <div class="muted small">If resting HR is 7+ bpm above baseline or HRV is clearly down, swap today's intensity for the aerobic block and mobility.</div>
      </section>
    </main>
  );
}

/**
 * Day progress and the Complete All button. Today only moves on when every required
 * session is logged; this logs whatever is still open in one tap and advances.
 */
function CompleteAllCard({ n }: { n: number }) {
  const [busy, setBusy] = useState(false);
  const required = daySessions(n).filter((s) => !s.optional).length;
  const remaining = remainingToday.value.length;
  const done = required - remaining;
  const last = n >= BLOCK_DAYS;
  const nextLabel = last ? `finish ${blockLabel(block.value?.n ?? 1)}` : `move to ${dayLabel(n + 1)}`;
  const run = async () => {
    if (busy) return;
    // Unlock audio inside the tap so the celebration sound is allowed on iOS once the day is saved.
    unlockAudio();
    setBusy(true);
    try {
      await completeDay(n);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section class={`card stack ${dayCelebrationActive() ? 'celebrating' : ''}`} data-testid="complete-all-card">
      <div class="row between">
        <h3>DAY PROGRESS</h3>
        <span class={`chip ${remaining === 0 ? 'chip-rest' : 'chip-muted'}`} data-testid="day-progress">{done}/{required} done</span>
      </div>
      <p class="muted small" style="margin:0">
        {remaining === 0
          ? `Every required session is logged. Tap to ${nextLabel}.`
          : `${remaining} required session${remaining === 1 ? '' : 's'} left. Log each one from its card, or mark the rest done and ${nextLabel}. Optional sessions never hold the day.`}
      </p>
      <button type="button" class="btn btn-primary btn-lg btn-block" data-testid="complete-all" disabled={busy} onClick={() => void run()}>
        {remaining === 0 ? (last ? 'FINISH BLOCK' : 'NEXT DAY') : 'COMPLETE ALL'}
      </button>
      <DayCelebrationCard />
    </section>
  );
}

/** Four block dots under the session cards; tapping opens the STACK tab. */
function StackStrip() {
  const items = stackItemsResolved.value;
  if (items.length === 0) return null;
  const logs = stackLogIndex.value;
  const date = todayYmd.value;
  const progress = BLOCK_ORDER.map((b) => blockProgress(items, logs, date, b));
  const doneBlocks = progress.filter((p) => p.complete).length;
  return (
    <section class="card" data-testid="stack-strip">
      <button type="button" class="stack-strip" onClick={() => navigate('/stack')} aria-label="Open the supplement stack">
        <div class="row" style="gap:8px">
          {progress.map((p) => <span key={p.block} class={`blockdot ${p.complete ? 'on' : ''} ${blockDue(p.block, p.complete) ? 'due' : ''}`} aria-label={`${stackBlockLabel(p.block)} ${p.done} of ${p.total}`} />)}
        </div>
        <div class="grow">
          <div style="font-weight:600">STACK</div>
          <div class="muted small">{doneBlocks} of 4 blocks done</div>
        </div>
        <span class="muted">›</span>
      </button>
    </section>
  );
}

/** The wake block sits with the cold shower in the standing orders. */
function WakeBlock() {
  const items = stackItemsResolved.value;
  if (items.length === 0) return null;
  const logs = stackLogIndex.value;
  const date = todayYmd.value;
  const p = blockProgress(items, logs, date, 'wake');
  const highLoad = highLoadToday();
  const fastedDay = fastedAmToday();
  const fastedDone = fastedSessionLogged();
  if (p.required.length === 0 && p.optional.length === 0 && p.offCycle.length === 0) return null;
  return (
    <div class="stack" style="gap:4px" data-testid="wake-block">
      <div class="row between">
        <span class="chip chip-od">{stackBlockLabel('wake')}</span>
        <span class={`chip ${p.complete ? 'chip-rest' : 'chip-muted'}`}>{p.done}/{p.total}</span>
      </div>
      {p.required.map((item) => (
        <StackRow key={item.id} item={item} logs={logs} date={date} compact
          note={fastedDay && !fastedDone ? fastedConflict(item, true, false) ?? undefined : undefined} />
      ))}
      {p.offCycle.map((item) => <StackRow key={item.id} item={item} logs={logs} date={date} offDay compact />)}
      {p.optional.map((item) => (
        <StackRow key={item.id} item={item} logs={logs} date={date} compact
          note={item.optionalTrigger === 'high-load-day' && highLoad ? 'High-load day — this is the day for it.' : undefined} />
      ))}
    </div>
  );
}

function Header() {
  return (
    <div class="row between">
      <div class="wordmark">BOUNDLESS <span class="accent">OPS</span></div>
      <button type="button" class="btn btn-icon btn-ghost" aria-label="Kit (settings)" onClick={() => navigate('/kit')}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
    </div>
  );
}
