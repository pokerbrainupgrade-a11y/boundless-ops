/**
 * Validates a local stack seed against the schema and prints its item table for
 * a line-by-line diff against the source protocol.
 *
 * The seed holds personal health data and is gitignored, so this is a no-op
 * when the file is absent (CI has no seed and must still pass).
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseSeed } from '../src/data/stackSchema';
import { INGREDIENTS } from '../src/data/ingredients';
import { cycleState, ceilingFlag } from '../src/lib/stack';

const path = process.env.STACK_SEED ?? 'stack-seed.json';
if (!existsSync(path)) {
  console.log(`verify-stack-seed: no local seed at ${path} — skipping (the seed never enters the repo).`);
  process.exit(0);
}

const parsed = parseSeed(readFileSync(path, 'utf8'));
if (!parsed.ok) {
  console.log(`  FAIL ${parsed.error}`);
  process.exit(1);
}
const seed = parsed.data;
let failures = 0;
const assert = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
};

console.log(`verify-stack-seed (${path})`);
assert(seed.items.length > 0, `${seed.items.length} items`);
assert(new Set(seed.items.map((i) => i.id)).size === seed.items.length, 'every item id is unique');
assert(seed.blocks.length === 4, '4 blocks with rule text');
for (const b of seed.blocks) assert(b.rule.trim().length > 0 && /^\d{2}:\d{2}$/.test(b.defaultTime), `block ${b.block}: rule + default time`);
const ids = new Set(seed.items.map((i) => i.id));
for (const i of seed.items) {
  if (i.splitOf) assert(ids.has(i.splitOf), `split ${i.id} resolves to parent ${i.splitOf}`);
  if (i.ingredientId) assert(!!INGREDIENTS[i.ingredientId], `${i.id}: ingredient "${i.ingredientId}" is in the dictionary`);
  assert(i.doseText.trim().length > 0, `${i.id}: dose text present`);
  if (i.optional) assert(!!i.optionalTrigger, `${i.id}: optional item declares a trigger`);
}
const blocksSeen = new Set(seed.items.map((i) => i.block));
for (const b of seed.blocks) assert(blocksSeen.has(b.block), `block ${b.block} has at least one item`);

console.log('\nItem table (compare line by line with the source protocol)');
console.log('BLOCK      | ID                   | NAME                           | DOSE                 | REQUIREMENT    | FLAGS');
for (const b of seed.blocks) {
  for (const i of seed.items.filter((x) => x.block === b.block).sort((x, y) => x.order - y.order)) {
    const flags: string[] = [];
    if (i.optional) flags.push(`optional:${i.optionalTrigger}`);
    if (i.cycle) flags.push(`cycle ${i.cycle.onDays}on/${i.cycle.offDays}off from ${i.cycle.anchorDate}`);
    if (i.dose.perServing > 1) flags.push(`${i.dose.perServing} units`);
    if (i.ceiling) flags.push(`ceiling ${i.ceiling.amount} ${i.ceiling.unit}${ceilingFlag(i) ? ' (flagged)' : ''}`);
    if (i.inventory) flags.push(`inv ${i.inventory.unitsPerDay}/day`);
    if (i.brand) flags.push(i.brand);
    console.log([b.block.padEnd(10), i.id.padEnd(20), i.name.slice(0, 30).padEnd(30), i.doseText.slice(0, 20).padEnd(20), i.requirement.padEnd(14), flags.join(' · ')].join(' | '));
  }
}
const cycled = seed.items.find((i) => i.cycle);
if (cycled) {
  const c = cycled.cycle!;
  const sample = Array.from({ length: c.onDays + c.offDays }, (_, k) => {
    const [y, m, dd] = c.anchorDate.split('-').map(Number) as [number, number, number];
    const d = new Date(Date.UTC(y, m - 1, dd + k));
    const ymd = d.toISOString().slice(0, 10);
    const st = cycleState(c, ymd);
    return `${ymd} ${st.on ? 'ON' : 'off'} ${st.dayOfPhase}/${st.phaseLength}`;
  });
  console.log(`\nCycle preview for ${cycled.id}:\n  ${sample.join('\n  ')}`);
}
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s)`);
if (failures > 0) process.exit(1);
