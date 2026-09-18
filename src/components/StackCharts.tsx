import { BLOCK_ORDER } from '@/data/stackSchema';
import { adherence, blockHeatmap, cycleCompliance, lastNDates, streak, dayComplete, isRequiredOn } from '@/lib/stack';
import { stackItemsResolved, stackLogIndex, todayYmd } from '@/lib/store';
import { blockLabel } from '@/screens/Stack';
import { fmtShortDate } from '@/lib/time';

const pctText = (p: number | null) => (p === null ? '—' : `${Math.round(p * 100)}%`);

/** 30-day block heatmap, per-item adherence over 30 and 90 days, streak history, cycle compliance. */
export function StackCharts() {
  const items = stackItemsResolved.value;
  const logs = stackLogIndex.value;
  const today = todayYmd.value;

  if (items.length === 0) return <p class="muted">Import your stack in Kit to see adherence here.</p>;

  const d30 = lastNDates(today, 30);
  const d90 = lastNDates(today, 90);
  const heat = blockHeatmap(items, logs, d30);
  const a30 = new Map(adherence(items, logs, d30).map((a) => [a.itemId, a]));
  const a90 = new Map(adherence(items, logs, d90).map((a) => [a.itemId, a]));
  const cycled = items.filter((i) => i.cycle);
  const run = streak(items, logs, today);

  // Streak history: the length of every completed run inside the last 90 days.
  const runs: { end: string; length: number }[] = [];
  let cur = 0;
  for (const d of d90) {
    if (dayComplete(items, logs, d)) cur++;
    else {
      if (cur > 0) runs.push({ end: d, length: cur });
      cur = 0;
    }
  }
  if (cur > 0) runs.push({ end: today, length: cur });
  const best = runs.reduce((m, r) => Math.max(m, r.length), 0);

  return (
    <div class="stack" data-testid="stack-charts">
      <section class="card stack" data-testid="chart-heatmap">
        <div class="row between"><h3>30-day block adherence</h3><span class="muted small">oldest → today</span></div>
        <div class="heat" role="img" aria-label={`Block adherence over the last 30 days. Current streak ${run} days.`}>
          {heat.map((row) => BLOCK_ORDER.map((_, bi) => {
            const v = row.blocks[bi]!;
            const key = v < 0 ? 'n' : v >= 1 ? '1' : v > 0 ? 'p' : '0';
            return <i key={`${row.date}-${bi}`} data-v={key} title={`${fmtShortDate(row.date)} · ${blockLabel(BLOCK_ORDER[bi]!)}`} />;
          }))}
        </div>
        <div class="row wrap" style="gap:10px">
          {BLOCK_ORDER.map((b, i) => <span key={b} class="muted small">{i + 1}. {blockLabel(b).replace(/^\d+ · /, '')}</span>)}
        </div>
      </section>

      <section class="card stack" data-testid="chart-streaks">
        <h3>Streak history</h3>
        <div class="row between"><span class="muted small">Current</span><span class="mono">{run} days</span></div>
        <div class="row between"><span class="muted small">Longest in 90 days</span><span class="mono">{best} days</span></div>
        <div class="row between"><span class="muted small">Complete days in 90</span><span class="mono">{d90.filter((d) => dayComplete(items, logs, d)).length}</span></div>
      </section>

      <section class="card stack" data-testid="chart-adherence">
        <div class="row between"><h3>Per-item adherence</h3><span class="muted small">30 d · 90 d</span></div>
        {items.map((item) => {
          const r30 = a30.get(item.id);
          const r90 = a90.get(item.id);
          return (
            <div key={item.id} class="stack" style="gap:4px">
              <div class="row between">
                <span class="small">{item.name}{item.optional ? <span class="muted"> · as needed</span> : ''}</span>
                <span class="mono small">{pctText(r30?.pct ?? null)} · {pctText(r90?.pct ?? null)}</span>
              </div>
              <div class="bar-row">
                <div class="bar"><span style={`width:${Math.round((r30?.pct ?? 0) * 100)}%`} /></div>
                <span class="muted small mono">{r30?.taken ?? 0}/{r30?.required ?? 0}</span>
              </div>
            </div>
          );
        })}
      </section>

      {cycled.map((item) => {
        const rows = cycleCompliance(item, logs, d30);
        const onDays = rows.filter((r) => r.scheduledOn);
        const kept = onDays.filter((r) => r.took).length;
        const offTaken = rows.filter((r) => !r.scheduledOn && r.took).length;
        return (
          <section key={item.id} class="card stack" data-testid="chart-cycle">
            <div class="row between"><h3>{item.name} cycle</h3><span class="muted small">{item.cycle!.onDays} on / {item.cycle!.offDays} off</span></div>
            <div class="cyc" role="img" aria-label={`${item.name}: took it on ${kept} of ${onDays.length} scheduled days, and on ${offTaken} off days.`}>
              {rows.map((r) => (
                <i key={r.date} data-s={r.scheduledOn ? (r.took ? 'on-took' : 'on-missed') : r.took ? 'off-took' : 'off-clear'} title={`${fmtShortDate(r.date)} · ${r.scheduledOn ? 'on' : 'off'} day · ${r.took ? 'taken' : 'not taken'}`} />
              ))}
            </div>
            <div class="row between"><span class="muted small">Kept to the on-days</span><span class="mono small">{kept}/{onDays.length}</span></div>
            <div class="row between"><span class="muted small">Taken on an off day</span><span class="mono small">{offTaken}</span></div>
            <div class="muted small">Filled green: on-day taken. Orange outline: on-day missed. Solid orange: taken on an off day.</div>
          </section>
        );
      })}

      <div class="muted small">Required items only. As-needed items are tracked but never counted against a block or the streak. Days before you started logging read as missed.</div>
      <div class="muted small">{items.filter((i) => isRequiredOn(i, today)).length} items are required today.</div>
    </div>
  );
}
