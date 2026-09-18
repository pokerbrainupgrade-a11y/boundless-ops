import { useRef, useState } from 'preact/hooks';
import type { StackItem } from '@/data/stackSchema';
import { REQUIREMENT_LABEL, INGREDIENTS } from '@/data/ingredients';
import { ceilingFlag, inventoryState, requiredUnits, unitsTaken, type LogMap } from '@/lib/stack';
import { logKey } from '@/lib/stack';
import { setStackCount, toggleStackItem, logRefill } from '@/lib/store';
import { settings } from '@/lib/settings';

export interface StackRowProps {
  item: StackItem;
  logs: LogMap;
  date: string;
  /** Cycle off day: struck through, needs a long press to log anyway. */
  offDay?: boolean;
  /** Shown under the row (fasted-day note, separation warning, trigger prompt). */
  note?: string;
  onLogged?: (item: StackItem) => void;
  compact?: boolean;
}

/** One supplement row: name, dose, requirement chip, and a checkbox or unit counter. */
export function StackRow({ item, logs, date, offDay = false, note, onLogged, compact = false }: StackRowProps) {
  const units = requiredUnits(item);
  const taken = unitsTaken(logs.get(logKey(date, item.id)), item);
  const done = taken >= units;
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ceiling = ceilingFlag(item);
  const inv = settings.value.inventoryOn ? inventoryState(item) : null;
  const ing = item.ingredientId ? INGREDIENTS[item.ingredientId] : undefined;

  const set = async (n: number) => {
    if (offDay && !armed) return;
    await setStackCount(item, n, date, offDay ? { offDayOverride: true } : {});
    if (n > taken) onLogged?.(item);
    if (offDay) setArmed(false);
  };
  const toggle = async () => {
    if (offDay && !armed) return;
    await toggleStackItem(item, date, offDay ? { offDayOverride: true } : {});
    if (!done) onLogged?.(item);
    if (offDay) setArmed(false);
  };

  // Long press on an off-day row arms it for a one-off log.
  const holdStart = () => {
    if (!offDay || armed) return;
    timer.current = setTimeout(() => setArmed(true), 600);
  };
  const holdEnd = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div class={`stack-row ${done ? 'done' : ''} ${offDay && !armed ? 'off-day' : ''}`} data-testid="stack-row" data-item={item.id} data-done={done} data-count={taken} data-off-day={offDay}
      onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onContextMenu={(e) => offDay && e.preventDefault()}>
      <div class="grow" style="min-width:0">
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <strong class={offDay && !armed ? 'struck' : ''}>{item.name}</strong>
          <span class="mono muted small">{item.doseText}</span>
        </div>
        <div class="row wrap" style="gap:4px;margin-top:2px">
          <span class={`chip chip-outline req-${item.requirement}`}>{REQUIREMENT_LABEL[item.requirement]}</span>
          {item.brand && !compact && <span class="muted small">{item.brand}</span>}
          {inv && <span class={`chip ${inv.level === 'red' ? 'chip-signal' : inv.level === 'amber' ? 'chip-tan' : 'chip-muted'}`} data-testid="inv-chip">{inv.daysRemaining} d left</span>}
          {inv && inv.level !== 'ok' && <button type="button" class="btn" style="min-height:32px;padding:2px 10px;font-size:0.8rem" onClick={() => logRefill(item)}>Logged a refill</button>}
        </div>
        {!compact && item.notes && <div class="muted small" style="margin-top:2px">{item.notes}</div>}
        {!compact && ing?.ul && <div class="muted small">Published adult upper limit: {ing.ul.amount.toLocaleString()} {ing.ul.unit}. {ing.ul.note}</div>}
        {ceiling && <div class="banner warn small" style="margin-top:4px" data-testid="ceiling-flag"><span>{ceiling}</span></div>}
        {note && <div class="banner info small" style="margin-top:4px" data-testid="row-note"><span>{note}</span></div>}
        {offDay && <div class="muted small" style="margin-top:2px">{armed ? 'Unlocked — tap to log anyway.' : 'Off day. Press and hold to log it anyway.'}</div>}
      </div>

      {units > 1 ? (
        <div class="units" role="group" aria-label={`${item.name}: ${taken} of ${units} units`} data-testid="unit-counter">
          {Array.from({ length: units }, (_, i) => (
            <button key={i} type="button" class={`unit ${i < taken ? 'on' : ''}`} aria-pressed={i < taken}
              aria-label={`${item.name} unit ${i + 1} of ${units}`} onClick={() => set(i + 1 === taken ? i : i + 1)}>
              {i < taken ? '✓' : i + 1}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" class={`stack-check ${done ? 'on' : ''}`} role="checkbox" aria-checked={done}
          aria-label={`${item.name}, ${item.doseText}`} data-testid="stack-check" onClick={toggle}>
          {done ? '✓' : ''}
        </button>
      )}
    </div>
  );
}
