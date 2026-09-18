import { useState } from 'preact/hooks';
import { navigate } from '@/router';
import { BLOCK_ORDER, parseSeed, type StackItem, type StackBlock, type Requirement, type StackSeed } from '@/data/stackSchema';
import { REQUIREMENT_LABEL, DEFAULT_BLOCK_TIMES } from '@/data/ingredients';
import { REMINDERS_GUIDE } from '@/data/remindersGuide';
import { stackItems, stackMeta, importStackSeed, saveStackItem, deleteStackItem, todayYmd } from '@/lib/store';
import { settings, updateSettings } from '@/lib/settings';
import { blockLabel } from '@/screens/Stack';

const REQUIREMENTS: Requirement[] = ['empty-stomach', 'with-food', 'with-fat', 'any'];

function newItem(block: StackBlock, order: number): StackItem {
  return { id: `item-${Date.now().toString(36)}`, name: '', dose: { amount: 1, unit: 'cap', perServing: 1 }, doseText: '', block, requirement: 'any', optional: false, order };
}

/** Stack settings: import, per-item editing, block times, cycle anchor, inventory, reminders. */
export function KitStack() {
  const items = stackItems.value;
  const s = settings.value;
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<StackSeed | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const r = parseSeed(await f.text());
    input.value = '';
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setPending(r.data);
    setMsg(null);
  };

  const doImport = async () => {
    if (!pending) return;
    await importStackSeed(pending);
    setMsg(`Imported ${pending.items.length} items. Your adherence log and lab panels were kept.`);
    setPending(null);
  };

  return (
    <>
      <section class="card stack" data-testid="kit-stack">
        <h3>STACK</h3>
        <p class="muted small">Your protocol is personal health data. It never ships with the app and never leaves this device: import the seed once, then it lives here with the rest of your data and rides along in the JSON export.</p>
        <div class="muted small" data-testid="stack-status">
          {items.length > 0 ? <>Loaded: <strong>{items.length} items</strong>{stackMeta.value?.title ? ` · ${stackMeta.value.title}` : ''}{s.stackImportedAt ? ` · imported ${s.stackImportedAt.slice(0, 10)}` : ''}</> : 'No stack loaded yet.'}
        </div>
        <label class="btn btn-primary" style="cursor:pointer"><span>{items.length > 0 ? 'Re-import Stack' : 'Import Stack'}</span>
          <input type="file" accept="application/json,.json" data-testid="stack-import-input" class="sr-only" onChange={onFile} />
        </label>
        {pending && (
          <div class="banner warn stack" data-testid="stack-import-prompt">
            <span>{pending.title}: {pending.items.length} items across {pending.blocks.length} blocks. This replaces the item list. Your logs and lab panels are kept.</span>
            <div class="row">
              <button type="button" class="btn btn-rest grow" data-testid="stack-import-confirm" onClick={doImport}>Import</button>
              <button type="button" class="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
        {msg && <div class="banner info" role="status" data-testid="stack-msg">{msg}</div>}
        {items.length > 0 && <button type="button" class="btn" onClick={() => navigate('/stack')}>Open the Stack tab</button>}
      </section>

      {items.length > 0 && (
        <section class="card stack" data-testid="kit-stack-blocks">
          <h3>BLOCK TIMES</h3>
          <p class="muted small">A block shows a DUE badge once its time has passed and it is still open. These are also the times to use for the iOS reminders below.</p>
          {BLOCK_ORDER.map((b) => (
            <label key={b} class="row between" style="gap:12px">
              <span class="small">{blockLabel(b)}</span>
              <input class="input" style="width:130px" type="time" data-testid={`block-time-${b}`}
                value={s.blockTimes[b] ?? DEFAULT_BLOCK_TIMES[b]}
                onInput={(e) => updateSettings({ blockTimes: { ...s.blockTimes, [b]: (e.target as HTMLInputElement).value } })} />
            </label>
          ))}
          <label class="field"><span>Cycle anchor date (day 1 of the on-phase)</span>
            <input class="input" type="date" data-testid="cycle-anchor" value={s.cycleAnchor ?? items.find((i) => i.cycle)?.cycle?.anchorDate ?? todayYmd.value}
              onInput={(e) => updateSettings({ cycleAnchor: (e.target as HTMLInputElement).value || null })} />
          </label>
          {s.cycleAnchor && <button type="button" class="btn" onClick={() => updateSettings({ cycleAnchor: null })}>Use the date from the seed</button>}
          <label class="switch"><span>Track inventory and refills</span>
            <input type="checkbox" data-testid="inventory-toggle" checked={s.inventoryOn} onChange={(e) => updateSettings({ inventoryOn: (e.target as HTMLInputElement).checked })} />
          </label>
        </section>
      )}

      {items.length > 0 && (
        <section class="card stack" data-testid="kit-stack-items">
          <div class="row between"><h3>ITEMS</h3><span class="muted small">{items.length}</span></div>
          {BLOCK_ORDER.map((b) => {
            const inBlock = items.filter((i) => i.block === b).sort((x, y) => x.order - y.order);
            return (
              <div key={b} class="stack" style="gap:6px">
                <span class="chip chip-od">{blockLabel(b)}</span>
                {inBlock.map((item) => (
                  <div key={item.id} class="stack" style="gap:4px">
                    <button type="button" class="row between" style="background:none;border:0;color:inherit;text-align:left;cursor:pointer;min-height:var(--tap);width:100%"
                      onClick={() => setEditing(editing === item.id ? null : item.id)} data-testid="kit-item">
                      <span class="grow" style="min-width:0"><strong class="small">{item.name || '(unnamed)'}</strong> <span class="muted small mono">{item.doseText}</span></span>
                      <span class="muted">{editing === item.id ? '▾' : '›'}</span>
                    </button>
                    {editing === item.id && <ItemEditor item={item} onClose={() => setEditing(null)} />}
                  </div>
                ))}
                <button type="button" class="btn" style="min-height:40px" onClick={async () => { const it = newItem(b, inBlock.length + 1); await saveStackItem(it); setEditing(it.id); }}>+ Add item to {blockLabel(b).replace(/^\d+ · /, '')}</button>
              </div>
            );
          })}
        </section>
      )}

      <section class="card stack" data-testid="reminders-guide">
        <h3>REMINDERS</h3>
        <p class="small muted">{REMINDERS_GUIDE.intro}</p>
        <details>
          <summary>Build four repeating iOS reminders</summary>
          <table class="tbl" style="margin-top:8px"><thead><tr><th>Block</th><th>Time</th><th>Title</th></tr></thead>
            <tbody>{REMINDERS_GUIDE.reminders.map((r) => <tr key={r.block}><td>{r.block}</td><td class="mono">{r.time}</td><td>{r.title}</td></tr>)}</tbody></table>
          <ol class="small" style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
            {REMINDERS_GUIDE.steps.map((st, i) => <li key={i}><strong>{st.action}</strong> <span class="muted">{st.detail}</span></li>)}
          </ol>
        </details>
        <details>
          <summary>One Shortcuts automation instead</summary>
          <ol class="small" style="margin-top:8px">{REMINDERS_GUIDE.shortcutAlternative.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </details>
        <details>
          <summary>Why the app can't do this itself</summary>
          <ul class="small" style="margin-top:8px">{REMINDERS_GUIDE.why.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <ul class="small">{REMINDERS_GUIDE.notes.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </details>
      </section>
    </>
  );
}

function ItemEditor({ item, onClose }: { item: StackItem; onClose: () => void }) {
  const [d, setD] = useState<StackItem>(item);
  const inv = d.inventory ?? { unitsPerContainer: 0, unitsPerDay: 0, containersOnHand: 0, lastRefillDate: null };
  const setInv = (patch: Partial<typeof inv>) => setD({ ...d, inventory: { ...inv, ...patch } });
  const numv = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0);
  return (
    <div class="card stack" style="gap:8px;background:var(--surface-2)" data-testid="item-editor">
      <label class="field"><span>Name</span><input class="input" data-testid="edit-name" value={d.name} onInput={(e) => setD({ ...d, name: (e.target as HTMLInputElement).value })} /></label>
      <label class="field"><span>Brand</span><input class="input" value={d.brand ?? ''} onInput={(e) => setD({ ...d, brand: (e.target as HTMLInputElement).value || undefined })} /></label>
      <label class="field"><span>Dose text (what the card shows)</span><input class="input" data-testid="edit-dosetext" value={d.doseText} onInput={(e) => setD({ ...d, doseText: (e.target as HTMLInputElement).value })} /></label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <label class="field"><span class="small">Amount</span><input class="input" type="number" inputMode="decimal" value={d.dose.amount} onInput={(e) => setD({ ...d, dose: { ...d.dose, amount: numv((e.target as HTMLInputElement).value) } })} /></label>
        <label class="field"><span class="small">Unit</span><input class="input" value={d.dose.unit} onInput={(e) => setD({ ...d, dose: { ...d.dose, unit: (e.target as HTMLInputElement).value } })} /></label>
        <label class="field"><span class="small">Units/dose</span><input class="input" type="number" inputMode="numeric" min="1" data-testid="edit-perserving" value={d.dose.perServing} onInput={(e) => setD({ ...d, dose: { ...d.dose, perServing: Math.max(1, numv((e.target as HTMLInputElement).value)) } })} /></label>
      </div>
      <label class="field"><span>Block</span>
        <select class="input" value={d.block} onChange={(e) => setD({ ...d, block: (e.target as HTMLSelectElement).value as StackBlock })}>
          {BLOCK_ORDER.map((b) => <option key={b} value={b}>{blockLabel(b)}</option>)}
        </select>
      </label>
      <label class="field"><span>Requirement</span>
        <select class="input" value={d.requirement} onChange={(e) => setD({ ...d, requirement: (e.target as HTMLSelectElement).value as Requirement })}>
          {REQUIREMENTS.map((r) => <option key={r} value={r}>{REQUIREMENT_LABEL[r]}</option>)}
        </select>
      </label>
      <label class="switch"><span>As needed (never counts toward the streak)</span>
        <input type="checkbox" checked={d.optional} onChange={(e) => { const on = (e.target as HTMLInputElement).checked; setD({ ...d, optional: on, optionalTrigger: on ? d.optionalTrigger ?? 'some-days' : undefined }); }} />
      </label>
      {d.optional && (
        <label class="field"><span>When</span>
          <select class="input" value={d.optionalTrigger ?? 'some-days'} onChange={(e) => setD({ ...d, optionalTrigger: (e.target as HTMLSelectElement).value as 'high-load-day' | 'some-days' })}>
            <option value="some-days">Some days</option>
            <option value="high-load-day">High-load training days</option>
          </select>
        </label>
      )}
      <label class="switch"><span>Cycle on and off</span>
        <input type="checkbox" checked={!!d.cycle} onChange={(e) => setD({ ...d, cycle: (e.target as HTMLInputElement).checked ? d.cycle ?? { onDays: 5, offDays: 2, anchorDate: todayYmd.value } : undefined })} />
      </label>
      {d.cycle && (
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <label class="field"><span class="small">Days on</span><input class="input" type="number" inputMode="numeric" min="1" value={d.cycle.onDays} onInput={(e) => setD({ ...d, cycle: { ...d.cycle!, onDays: Math.max(1, numv((e.target as HTMLInputElement).value)) } })} /></label>
          <label class="field"><span class="small">Days off</span><input class="input" type="number" inputMode="numeric" min="0" value={d.cycle.offDays} onInput={(e) => setD({ ...d, cycle: { ...d.cycle!, offDays: numv((e.target as HTMLInputElement).value) } })} /></label>
        </div>
      )}
      <label class="field"><span>Notes</span><textarea class="input" value={d.notes ?? ''} onInput={(e) => setD({ ...d, notes: (e.target as HTMLTextAreaElement).value || undefined })} /></label>
      <details open={settings.value.inventoryOn}>
        <summary class="muted small">Inventory</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
          <label class="field"><span class="small">Per container</span><input class="input" type="number" inputMode="numeric" data-testid="edit-percontainer" value={inv.unitsPerContainer} onInput={(e) => setInv({ unitsPerContainer: numv((e.target as HTMLInputElement).value) })} /></label>
          <label class="field"><span class="small">Per day</span><input class="input" type="number" inputMode="numeric" value={inv.unitsPerDay} onInput={(e) => setInv({ unitsPerDay: numv((e.target as HTMLInputElement).value) })} /></label>
          <label class="field"><span class="small">On hand</span><input class="input" type="number" inputMode="numeric" data-testid="edit-onhand" value={inv.containersOnHand} onInput={(e) => setInv({ containersOnHand: numv((e.target as HTMLInputElement).value) })} /></label>
        </div>
        {inv.lastRefillDate && <div class="muted small">Last refill {inv.lastRefillDate}</div>}
      </details>
      <div class="row">
        <button type="button" class="btn btn-danger" onClick={async () => { if (confirm(`Remove ${d.name || 'this item'} from the stack? Past log entries stay.`)) { await deleteStackItem(d.id); onClose(); } }}>Remove</button>
        <button type="button" class="btn btn-primary grow" data-testid="save-item" onClick={async () => { await saveStackItem(d); onClose(); }}>Save item</button>
      </div>
    </div>
  );
}
