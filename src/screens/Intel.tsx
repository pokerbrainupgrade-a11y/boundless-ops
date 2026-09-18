import { useEffect, useState } from 'preact/hooks';
import { route, navigate } from '@/router';
import { db, type SessionLog } from '@/lib/db';
import { blocks, block, logs, vitals } from '@/lib/store';
import { buildCharts, type ChartMode } from '@/lib/charts';
import { Chart } from '@/components/Chart';
import { StackCharts } from '@/components/StackCharts';
import { Labs } from '@/components/Labs';

/** Intel: charts with W1 vs W2 and Block vs Block toggles. */
const VIEWS = [
  { id: 'training', label: 'Training' },
  { id: 'stack', label: 'Stack' },
  { id: 'labs', label: 'Labs' },
] as const;

export function Intel() {
  const view = (route.value.parts[1] ?? 'training') as (typeof VIEWS)[number]['id'];
  const [mode, setMode] = useState<ChartMode>('weeks');
  const [blockId, setBlockId] = useState<number | null>(block.value?.id ?? null);
  const [all, setAll] = useState<SessionLog[]>([]);
  useEffect(() => {
    void db.logs.toArray().then(setAll);
  }, [logs.value]);
  useEffect(() => {
    if (blockId === null && block.value) setBlockId(block.value.id!);
  }, [block.value]);
  const charts = buildCharts(all, blocks.value, vitals.value, mode, blockId);
  return (
    <main class="screen" data-testid="intel" data-mode={mode} data-view={view}>
      <div class="section-h"><h1>Intel</h1></div>
      <div class="row" role="tablist" aria-label="Intel view">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} class={`btn grow ${view === v.id ? 'btn-tan' : ''}`}
            data-testid={`view-${v.id}`} onClick={() => navigate(v.id === 'training' ? '/intel' : `/intel/${v.id}`)}>{v.label}</button>
        ))}
      </div>
      {view === 'stack' && <StackCharts />}
      {view === 'labs' && <Labs />}
      {view !== 'training' ? null : (<>
      <div class="row" role="radiogroup" aria-label="Compare">
        <button type="button" role="radio" aria-checked={mode === 'weeks'} class={`btn grow ${mode === 'weeks' ? 'btn-primary' : ''}`} data-testid="mode-weeks" onClick={() => setMode('weeks')}>Week vs week</button>
        <button type="button" role="radio" aria-checked={mode === 'blocks'} class={`btn grow ${mode === 'blocks' ? 'btn-primary' : ''}`} data-testid="mode-blocks" onClick={() => setMode('blocks')}>Block vs Block</button>
      </div>
      {mode === 'weeks' && blocks.value.length > 1 && (
        <div class="row wrap">{blocks.value.map((b) => <button key={b.id} type="button" class={`btn ${blockId === b.id ? 'btn-tan' : ''}`} onClick={() => setBlockId(b.id!)}>Block {String(b.n).padStart(2, '0')}</button>)}</div>
      )}
      {all.length === 0 && <p class="muted">Charts fill in as you file reports.</p>}
      {charts.map((c) => <Chart key={c.id} data={c} />)}
      </>)}
    </main>
  );
}
