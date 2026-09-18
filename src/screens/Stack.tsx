import { useState } from 'preact/hooks';
import { navigate } from '@/router';
import { BLOCK_ORDER, type StackBlock, type StackItem } from '@/data/stackSchema';
import { BLOCK_LABEL, DEFAULT_BLOCK_TIMES } from '@/data/ingredients';
import { blockProgress, streak, separationWarning, fastedConflict, nextPanelDue, itemOnCycle, cycleState } from '@/lib/stack';
import { stackItemsResolved, stackLogIndex, stackLogs, stackMeta, labs, todayYmd, dayN, logs as sessionLogs } from '@/lib/store';
import { settings } from '@/lib/settings';
import { getDay, BLOCK_DAYS } from '@/data/program';
import { phxHM, fmtDate } from '@/lib/time';
import { StackRow } from '@/components/StackRow';

/** Today's AM block is fasted when it holds fasted cardio or the stamina session. */
export function fastedAmToday(): boolean {
  const n = dayN.value;
  if (n === null || n < 1 || n > BLOCK_DAYS) return false;
  return getDay(n).am.some((r) => r.id === 'fastedCardio' || r.id === 'L');
}

export function fastedSessionLogged(): boolean {
  const n = dayN.value;
  if (n === null) return false;
  return sessionLogs.value.some((l) => l.dayN === n && l.slot === 'am' && l.completed);
}

export function highLoadToday(): boolean {
  const n = dayN.value;
  if (n === null || n < 1 || n > BLOCK_DAYS) return false;
  return getDay(n).load === 'High';
}

export function blockTime(block: StackBlock): string {
  const meta = stackMeta.value?.blocks.find((b) => b.block === block);
  return settings.value.blockTimes[block] ?? meta?.defaultTime ?? DEFAULT_BLOCK_TIMES[block] ?? '12:00';
}

export function blockRule(block: StackBlock): string {
  return stackMeta.value?.blocks.find((b) => b.block === block)?.rule ?? '';
}

export function blockLabel(block: StackBlock): string {
  return stackMeta.value?.blocks.find((b) => b.block === block)?.label ?? BLOCK_LABEL[block] ?? block;
}

/** Past its time and still incomplete. */
export function blockDue(block: StackBlock, complete: boolean, now = phxHM()): boolean {
  return !complete && now >= blockTime(block);
}

export function Stack() {
  const items = stackItemsResolved.value;
  const logs = stackLogIndex.value;
  const date = todayYmd.value;
  const meta = stackMeta.value;
  const [note, setNote] = useState<{ itemId: string; text: string } | null>(null);

  if (items.length === 0) {
    return (
      <main class="screen" data-testid="stack">
        <div class="section-h"><h1>Stack</h1></div>
        <div class="card stack" data-testid="stack-empty">
          <h3>No stack loaded</h3>
          <p class="muted small">Your protocol stays on this device. Import the seed file once in Kit and it lives here with the rest of your data.</p>
          <button type="button" class="btn btn-primary btn-lg" onClick={() => navigate('/kit')}>Open Kit → Import Stack</button>
        </div>
      </main>
    );
  }

  const progress = BLOCK_ORDER.map((b) => blockProgress(items, logs, date, b));
  const run = streak(items, logs, date);
  const due = nextPanelDue(labs.value, date);
  const fastedDay = fastedAmToday();
  const fastedDone = fastedSessionLogged();
  const highLoad = highLoadToday();

  const onLogged = (item: StackItem) => {
    const warn = separationWarning(item, items, stackLogs.value, new Date().toISOString());
    if (warn) setNote({ itemId: item.id, text: warn });
    else if (note?.itemId === item.id) setNote(null);
  };

  return (
    <main class="screen" data-testid="stack" data-streak={run}>
      <div class="section-h"><h1>Stack</h1></div>

      {due?.overdue && (
        <div class="banner warn" data-testid="panel-overdue">
          <span>Lab panel is {Math.abs(due.daysUntil)} days overdue. Last panel {fmtDate(due.last)}.</span>
          <button type="button" class="btn" style="min-height:40px" onClick={() => navigate('/intel/labs')}>Log one</button>
        </div>
      )}

      <div class="card row between" data-testid="stack-top">
        <div class="row" style="gap:8px">
          {progress.map((p) => (
            <span key={p.block} class={`blockdot ${p.complete ? 'on' : ''} ${blockDue(p.block, p.complete) ? 'due' : ''}`}
              title={`${blockLabel(p.block)} ${p.done}/${p.total}`} aria-label={`${blockLabel(p.block)} ${p.done} of ${p.total}`} />
          ))}
        </div>
        <div style="text-align:right">
          <div class="muted small">DAYS ON PROTOCOL</div>
          <div class="mono" style="font-size:1.6rem;line-height:1" data-testid="streak">{run}</div>
        </div>
      </div>

      {BLOCK_ORDER.map((block) => {
        const p = progress.find((x) => x.block === block)!;
        const isDue = blockDue(block, p.complete);
        return (
          <section key={block} class={`card stack ${p.complete ? 'block-done' : ''}`} data-testid={`block-${block}`} data-complete={p.complete}>
            <div class="row between">
              <div>
                <h3 style="color:var(--od-text)">{blockLabel(block)}</h3>
                <div class="muted small">{blockRule(block)} · {blockTime(block)}</div>
              </div>
              <div class="row" style="gap:6px">
                {isDue && <span class="chip chip-signal" data-testid="due-chip">DUE</span>}
                <span class={`chip ${p.complete ? 'chip-rest' : 'chip-muted'}`} data-testid="block-count">{p.done}/{p.total}</span>
              </div>
            </div>

            {block === 'breakfast' && fastedDay && !fastedDone && (
              <div class="banner info" data-testid="fasted-hold"><span>Fasted session first today. Hold this block until the fasted block is done.</span></div>
            )}

            {p.required.map((item) => (
              <StackRow key={item.id} item={item} logs={logs} date={date} onLogged={onLogged}
                note={note?.itemId === item.id ? note.text : (fastedDay && !fastedDone ? fastedConflict(item, true, false) ?? undefined : undefined)} />
            ))}

            {p.offCycle.map((item) => {
              const st = item.cycle ? cycleState(item.cycle, date) : null;
              return (
                <div key={item.id} class="stack" style="gap:4px">
                  {st && <span class="chip chip-outline" data-testid="cycle-chip">OFF DAY {st.dayOfPhase}/{st.phaseLength}</span>}
                  <StackRow item={item} logs={logs} date={date} offDay onLogged={onLogged} />
                </div>
              );
            })}

            {p.required.filter((i) => i.cycle && itemOnCycle(i, date)).map((i) => {
              const st = cycleState(i.cycle!, date);
              return <div key={`c-${i.id}`} class="muted small" data-testid="cycle-on">{i.name}: cycle day {st.dayOfPhase}/{st.phaseLength}</div>;
            })}

            {p.optional.length > 0 && (
              <div class="asneeded stack" data-testid="as-needed">
                <div class="row between"><span class="chip chip-outline">AS NEEDED</span><span class="muted small">Not counted in the block or the streak</span></div>
                {p.optional.map((item) => (
                  <StackRow key={item.id} item={item} logs={logs} date={date} onLogged={onLogged}
                    note={item.optionalTrigger === 'high-load-day' && highLoad ? 'High-load day today — this is the day this one is meant for.' : note?.itemId === item.id ? note.text : undefined} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {meta && meta.notes.length > 0 && (
        <section class="card stack" data-testid="stack-notes">
          <h3>NOTES</h3>
          {meta.notes.map((n) => (
            <div key={n.title}><strong class="small">{n.title}.</strong> <span class="muted small">{n.text}</span></div>
          ))}
        </section>
      )}

      <div class="muted small">The app shows what you entered. It never suggests a dose or a change.</div>
    </main>
  );
}
