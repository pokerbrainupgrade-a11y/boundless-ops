import { useState } from 'preact/hooks';
import type { SessionLog } from '@/lib/db';
import type { Session } from '@/data/schema';
import { program } from '@/data/program';
import { buildHealthRequest, parseHealthResponse, shortcutUrl, healthErrorMessage } from '@/lib/health';
import { saveLog } from '@/lib/store';
import { hrMax, settings } from '@/lib/settings';

export interface LogFormProps {
  session: Session;
  draft: SessionLog;
  onSaved: (id: number) => void;
  onCancel: () => void;
  /** Extra note shown at the top (e.g. "Finish with a cold shower"). */
  note?: string;
}

export function sessionKey(sessionId: string, startedAt: string): string {
  return `${sessionId}-${startedAt.replace(/[-:.]/g, '').slice(0, 15)}`;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  return isFinite(n) && v !== '' && v !== null && v !== undefined ? n : undefined;
}

/** After Action Report form: per-preset fields, RPE, HR (manual or Health paste), notes. */
export function LogForm({ session, draft, onSaved, onCancel, note }: LogFormProps) {
  const [log, setLog] = useState<SessionLog>(draft);
  const [hrMsg, setHrMsg] = useState<string | null>(null);
  const [pasteBox, setPasteBox] = useState('');
  const [saving, setSaving] = useState(false);
  const key = sessionKey(log.sessionId, log.startedAt);
  const data = log.data;
  const setData = (patch: Record<string, unknown>) => setLog({ ...log, data: { ...log.data, ...patch } });
  const preset = session.timerPreset;

  const pullHr = async () => {
    const req = buildHealthRequest(key, log.startedAt, log.endedAt);
    try {
      await navigator.clipboard.writeText(req);
      setHrMsg('Request copied. Opening the Boundless HR shortcut…');
      location.href = shortcutUrl();
    } catch {
      setHrMsg('Could not copy to the clipboard. Copy this by hand: ' + req);
    }
  };
  const applyPaste = (text: string) => {
    const r = parseHealthResponse(text, key);
    if (r.ok) {
      setLog({ ...log, hr: { avg: r.avg, max: r.max } });
      setHrMsg(`Heart rate pasted: avg ${r.avg}, max ${r.max}.`);
    } else setHrMsg(healthErrorMessage(r.reason));
  };
  const pasteHr = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyPaste(text);
    } catch {
      setHrMsg('Clipboard read was blocked. Paste the result into the box below instead.');
    }
  };

  const save = async () => {
    setSaving(true);
    const id = await saveLog(log);
    onSaved(id);
  };

  const rounds = (data.rounds as (number | null)[] | undefined) ?? [];
  const lifts = (data.lifts as { pattern: string; exercise?: string; load?: number; seconds?: number; reps?: number }[] | undefined) ?? [];
  const max = hrMax(settings.value.age);

  return (
    <main class="screen" data-testid="log-form">
      <div class="section-h"><h1>After Action Report</h1></div>
      <div class="muted small">{session.name} · Day {String(log.dayN).padStart(2, '0')}</div>
      {note && <div class="banner info">{note}</div>}

      {preset === 'tabata' && (
        <div class="card stack">
          <h3>Per-round {String(data.unit ?? 'reps')}</h3>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            {Array.from({ length: 8 }, (_, i) => (
              <label key={i} class="field"><span class="small muted">R{i + 1}</span>
                <input class="input" type="number" inputMode="numeric" min="0" value={rounds[i] ?? ''} onInput={(e) => { const r = [...rounds]; while (r.length < 8) r.push(null); r[i] = num((e.target as HTMLInputElement).value) ?? null; setData({ rounds: r, ...tabataTotals(r) }); }} />
              </label>
            ))}
          </div>
          <div class="row between mono"><span>Total <strong>{String(data.total ?? '—')}</strong></span><span>Round-8 drop-off <strong>{data.dropoff !== undefined ? `${data.dropoff}%` : '—'}</strong></span></div>
        </div>
      )}

      {preset === 'vo2' && (
        <div class="card stack">
          <h3>Avg HR per round</h3>
          {max && <div class="muted small">Target band {Math.round(max * 0.87)}–{Math.round(max * 0.97)} bpm</div>}
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
            {Array.from({ length: 5 }, (_, i) => (
              <label key={i} class="field"><span class="small muted">R{i + 1}</span>
                <input class="input" type="number" inputMode="numeric" value={rounds[i] ?? ''} onInput={(e) => { const r = [...rounds]; while (r.length < 5) r.push(null); r[i] = num((e.target as HTMLInputElement).value) ?? null; setData({ rounds: r }); }} />
              </label>
            ))}
          </div>
        </div>
      )}

      {preset === 'superSlow' && (
        <div class="card stack">
          <h3>Lifts</h3>
          {program.superSlowPatterns.map((p, i) => {
            const l = lifts[i] ?? { pattern: p.id };
            const set = (patch: Partial<typeof l>) => { const n = [...lifts]; while (n.length < 4) n.push({ pattern: program.superSlowPatterns[n.length]!.id }); n[i] = { ...l, ...patch }; setData({ lifts: n }); };
            const flag = l.seconds !== undefined ? (l.seconds > 150 ? 'add load' : l.seconds < 90 ? 'reduce load' : null) : null;
            return (
              <div key={p.id} class="stack" style="gap:6px">
                <div class="row between"><strong>{p.name}</strong>{flag && <span class="chip chip-stamp">{flag}</span>}</div>
                <input class="input" placeholder="Exercise" value={l.exercise ?? ''} onInput={(e) => set({ exercise: (e.target as HTMLInputElement).value })} />
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                  <label class="field"><span class="small muted">Load</span><input class="input" type="number" inputMode="decimal" value={l.load ?? ''} onInput={(e) => set({ load: num((e.target as HTMLInputElement).value) })} /></label>
                  <label class="field"><span class="small muted">Seconds</span><input class="input" type="number" inputMode="numeric" value={l.seconds ?? ''} onInput={(e) => set({ seconds: num((e.target as HTMLInputElement).value) })} /></label>
                  <label class="field"><span class="small muted">Reps</span><input class="input" type="number" inputMode="numeric" value={l.reps ?? ''} onInput={(e) => set({ reps: num((e.target as HTMLInputElement).value) })} /></label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generic fields declared on the session */}
      <div class="card stack">
        {session.logFields.filter((f) => !['rounds', 'lifts', 'total', 'dropoff'].includes(f.key)).map((f) => (
          <label key={f.key} class={f.type === 'bool' ? 'switch' : 'field'}>
            <span>{f.label}{f.unit ? ` (${f.unit})` : ''}{f.optional ? <span class="muted small"> · optional</span> : ''}</span>
            {f.type === 'bool' ? (
              <input type="checkbox" checked={data[f.key] !== false && data[f.key] !== undefined ? !!data[f.key] : false} onChange={(e) => setData({ [f.key]: (e.target as HTMLInputElement).checked })} />
            ) : f.type === 'number' ? (
              <input class="input" type="number" inputMode="decimal" value={(data[f.key] as number | undefined) ?? ''} onInput={(e) => setData({ [f.key]: num((e.target as HTMLInputElement).value) })} />
            ) : f.type === 'select' ? (
              <select class="input" value={String(data[f.key] ?? '')} onChange={(e) => setData({ [f.key]: (e.target as HTMLSelectElement).value })}>
                <option value="">—</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input class="input" value={String(data[f.key] ?? '')} onInput={(e) => setData({ [f.key]: (e.target as HTMLInputElement).value })} />
            )}
          </label>
        ))}
      </div>

      <div class="card stack">
        <h3>RPE</h3>
        <div class="row wrap" role="radiogroup" aria-label="RPE 1 to 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={log.rpe === n} class={`btn mono ${log.rpe === n ? 'btn-primary' : ''}`} style="min-width:48px;padding:0" onClick={() => setLog({ ...log, rpe: n })}>{n}</button>
          ))}
        </div>
      </div>

      <div class="card stack">
        <h3>Heart rate</h3>
        <div class="row">
          <label class="field grow"><span class="small muted">Avg</span><input class="input" type="number" inputMode="numeric" data-testid="hr-avg" value={log.hr?.avg ?? ''} onInput={(e) => setLog({ ...log, hr: { avg: num((e.target as HTMLInputElement).value) ?? 0, max: log.hr?.max ?? 0 } })} /></label>
          <label class="field grow"><span class="small muted">Max</span><input class="input" type="number" inputMode="numeric" data-testid="hr-max" value={log.hr?.max ?? ''} onInput={(e) => setLog({ ...log, hr: { avg: log.hr?.avg ?? 0, max: num((e.target as HTMLInputElement).value) ?? 0 } })} /></label>
        </div>
        <div class="row">
          <button type="button" class="btn btn-tan grow" onClick={pullHr}>Pull HR from Health</button>
          <button type="button" class="btn grow" data-testid="paste-hr" onClick={pasteHr}>Paste HR</button>
        </div>
        <details>
          <summary class="muted small">Paste the result by hand</summary>
          <div class="row" style="margin-top:6px">
            <input class="input grow" data-testid="hr-paste-box" placeholder="BOPS-HR|…" value={pasteBox} onInput={(e) => setPasteBox((e.target as HTMLInputElement).value)} />
            <button type="button" class="btn" data-testid="hr-paste-apply" onClick={() => applyPaste(pasteBox)}>Apply</button>
          </div>
        </details>
        {hrMsg && <div class="banner info" data-testid="hr-msg" role="status">{hrMsg}</div>}
        <div class="muted small">Session ID <code>{key}</code></div>
      </div>

      <label class="field"><span>Notes</span><textarea class="input" value={log.notes ?? ''} onInput={(e) => setLog({ ...log, notes: (e.target as HTMLTextAreaElement).value })} /></label>

      <div class="row">
        <button type="button" class="btn btn-ghost" onClick={onCancel}>Discard</button>
        <button type="button" class="btn btn-primary btn-lg grow" data-testid="save-log" disabled={saving} onClick={save}>FILE REPORT</button>
      </div>
    </main>
  );
}

export function tabataTotals(rounds: (number | null)[]): { total?: number; dropoff?: number } {
  const vals = rounds.map((r) => (typeof r === 'number' ? r : null));
  if (vals.every((v) => v === null)) return {};
  const total = vals.reduce<number>((a, v) => a + (v ?? 0), 0);
  const first = vals[0];
  const last = vals[7];
  const dropoff = first && last !== null && last !== undefined ? Math.round(((first - last) / first) * 100) : undefined;
  return { total, dropoff };
}
