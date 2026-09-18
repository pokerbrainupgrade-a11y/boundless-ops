import { useState } from 'preact/hooks';
import { LAB_MARKERS, PANEL_INTERVAL_DAYS, type LabPanel, type LabMarker } from '@/data/stackSchema';
import { nextPanelDue, vitDBand, vitDStatus } from '@/lib/stack';
import { labs, saveLabPanel, deleteLabPanel, todayYmd } from '@/lib/store';
import { fmtDate } from '@/lib/time';

const blank = (date: string): LabPanel => ({
  date, totalT: null, freeT: null, shbg: null, estradiol: null, vitD25OH: null, ferritin: null,
  units: { totalT: 'ng/dL', freeT: 'pg/mL', shbg: 'nmol/L', estradiol: 'pg/mL', vitD25OH: 'ng/mL', ferritin: 'ng/mL' },
});

const num = (v: string): number | null => (v.trim() === '' ? null : isFinite(Number(v)) ? Number(v) : null);

/** Quarterly panel: entry form, trend per marker, and the next-due date. */
export function Labs() {
  const rows = [...labs.value].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayYmd.value;
  const [draft, setDraft] = useState<LabPanel | null>(null);
  const due = nextPanelDue(rows, today);

  const save = async () => {
    if (!draft) return;
    await saveLabPanel(draft);
    setDraft(null);
  };

  return (
    <div class="stack" data-testid="labs">
      <div class="card row between" data-testid="panel-due">
        <div>
          <div class="muted small">NEXT LAB PANEL</div>
          {due ? (
            <div><span class="mono" style="font-size:1.1rem">{fmtDate(due.due)}</span> <span class={due.overdue ? 'chip chip-signal' : 'muted small'}>{due.overdue ? `${Math.abs(due.daysUntil)} d overdue` : `in ${due.daysUntil} d`}</span></div>
          ) : (
            <div class="muted small">No panel logged yet. Every {PANEL_INTERVAL_DAYS} days once you log one.</div>
          )}
        </div>
        <button type="button" class="btn btn-primary" data-testid="add-panel" onClick={() => setDraft(blank(today))}>Log panel</button>
      </div>

      {draft && (
        <section class="card stack" data-testid="panel-form">
          <h3>LAB PANEL</h3>
          <label class="field"><span>Date</span><input class="input" type="date" value={draft.date} onInput={(e) => setDraft({ ...draft, date: (e.target as HTMLInputElement).value })} /></label>
          {LAB_MARKERS.map((m) => (
            <div key={m.key} class="row" style="gap:8px;align-items:flex-end">
              <label class="field grow"><span>{m.label}</span>
                <input class="input" type="number" inputMode="decimal" step="any" data-testid={`lab-${m.key}`}
                  value={draft[m.key] ?? ''} onInput={(e) => setDraft({ ...draft, [m.key]: num((e.target as HTMLInputElement).value) })} />
              </label>
              {m.key === 'vitD25OH' ? (
                <label class="field" style="width:110px"><span>Unit</span>
                  <select class="input" value={draft.units.vitD25OH} onChange={(e) => setDraft({ ...draft, units: { ...draft.units, vitD25OH: (e.target as HTMLSelectElement).value as 'ng/mL' | 'nmol/L' } })}>
                    <option value="ng/mL">ng/mL</option>
                    <option value="nmol/L">nmol/L</option>
                  </select>
                </label>
              ) : (
                <span class="muted small" style="width:110px;padding-bottom:14px">{m.defaultUnit}</span>
              )}
            </div>
          ))}
          <label class="field"><span>Lab (optional)</span><input class="input" value={draft.lab ?? ''} onInput={(e) => setDraft({ ...draft, lab: (e.target as HTMLInputElement).value })} /></label>
          <label class="field"><span>Notes</span><textarea class="input" value={draft.notes ?? ''} onInput={(e) => setDraft({ ...draft, notes: (e.target as HTMLTextAreaElement).value })} /></label>
          <div class="row">
            <button type="button" class="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" class="btn btn-primary grow" data-testid="save-panel" onClick={save}>SAVE PANEL</button>
          </div>
        </section>
      )}

      {rows.length === 0 && !draft && <p class="muted">No panels yet.</p>}

      {rows.length > 0 && LAB_MARKERS.map((m) => {
        const pts = rows.filter((r) => r[m.key as LabMarker] !== null).map((r) => ({ date: r.date, y: r[m.key as LabMarker] as number, unit: m.key === 'vitD25OH' ? r.units.vitD25OH : m.defaultUnit }));
        if (pts.length === 0) return null;
        const unit = pts[pts.length - 1]!.unit;
        const band = m.key === 'vitD25OH' ? vitDBand(unit) : null;
        const ys = pts.map((p) => p.y).concat(band ? [band.low, band.high] : []);
        const max = Math.max(...ys) * 1.1;
        const min = Math.min(0, ...ys);
        const W = 320, H = 140, PL = 40, PR = 8, PT = 10, PB = 24;
        const iw = W - PL - PR, ih = H - PT - PB;
        const x = (i: number) => PL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
        const y = (v: number) => PT + ih - ((v - min) / (max - min || 1)) * ih;
        const last = pts[pts.length - 1]!;
        return (
          <figure key={m.key} class="card stack" data-testid={`lab-chart-${m.key}`} style="margin:0;gap:6px">
            <figcaption class="row between"><h3>{m.label}</h3><span class="muted small">{unit}</span></figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${m.label}: ${pts.map((p) => `${p.date} ${p.y} ${p.unit}`).join(', ')}`}>
              {band && <rect x={PL} y={y(band.high)} width={iw} height={Math.max(1, y(band.low) - y(band.high))} fill="var(--rest)" opacity="0.18" />}
              {band && <text x={PL + 4} y={y(band.high) - 3} font-size="9" fill="var(--rest-hi)">target {band.low}–{band.high}</text>}
              {[min, max].map((t) => (
                <g key={t}>
                  <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--surface-2)" />
                  <text x={PL - 4} y={y(t) + 4} text-anchor="end" font-size="9" font-family="var(--font-timer)" fill="var(--muted)">{Math.round(t)}</text>
                </g>
              ))}
              <polyline points={pts.map((p, i) => `${x(i)},${y(p.y)}`).join(' ')} fill="none" stroke="var(--tan)" stroke-width="2" />
              {pts.map((p, i) => <rect key={p.date} x={x(i) - 3} y={y(p.y) - 3} width="6" height="6" fill="var(--signal)" />)}
              {pts.map((p, i) => <text key={`l${p.date}`} x={x(i)} y={H - 8} text-anchor="middle" font-size="8" font-family="var(--font-timer)" fill="var(--muted)">{p.date.slice(5)}</text>)}
            </svg>
            {m.key === 'vitD25OH' && <div class="muted small" data-testid="vitd-status">Latest {last.y} {unit}: <strong>{vitDStatus(last.y, unit)}</strong> of the 40–60 ng/mL target band.</div>}
          </figure>
        );
      })}

      {rows.length > 0 && (
        <section class="card stack">
          <h3>PANELS</h3>
          {[...rows].reverse().map((r) => (
            <div key={r.date} class="row between" data-testid="panel-row">
              <div class="grow">
                <strong class="small">{fmtDate(r.date)}</strong>
                <div class="muted small">{LAB_MARKERS.filter((m) => r[m.key as LabMarker] !== null).map((m) => `${m.label} ${r[m.key as LabMarker]}`).join(' · ') || 'No values'}{r.lab ? ` · ${r.lab}` : ''}</div>
              </div>
              <button type="button" class="btn" onClick={() => setDraft(r)} aria-label={`Edit panel ${r.date}`}>Edit</button>
              <button type="button" class="btn btn-ghost" onClick={() => confirm('Delete this panel?') && deleteLabPanel(r.id!)} aria-label={`Delete panel ${r.date}`}>✕</button>
            </div>
          ))}
        </section>
      )}
      <div class="muted small">Values are shown as entered, with the 25-OH-D target band drawn for reference. The app makes no call beyond in band, below, or above.</div>
    </div>
  );
}
