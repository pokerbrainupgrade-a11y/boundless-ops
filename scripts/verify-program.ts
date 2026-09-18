/**
 * Build-time gate for program.json. Exits non-zero on any failure and prints
 * the day-by-day table. Weeks 1 and 2 are diffed by eye against the source
 * pages 1 and 7; weeks 3 to 6 must repeat that pattern with the rotations.
 */
import { program, sevenMinuteMoves, tabataRotationFor, sprintPresetFor, BLOCK_DAYS } from '../src/data/program';

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}

console.log('verify-program');
assert(program.days.length === 42 && BLOCK_DAYS === 42, '42 days (6 weeks)');
assert(program.meta.blockWeeks === 6, 'blockWeeks = 6');
assert(program.foundation.seqA.length === 7, 'Seq A = 7');
assert(program.foundation.seqB.length === 6, 'Seq B = 6');
assert(program.foundation.seqB[4]?.name === 'Woodpecker Rotation', 'Seq B #5 is Woodpecker Rotation');
assert(program.mobilityStations.length === 15, '15 mobility stations');
assert(program.sevenMinute.length === 12, '12 seven-minute moves');
assert(program.sevenMinute.filter((m) => m.w2Swap).length === 7, '7 seven-minute explosive swaps');
assert(program.superSlowPatterns.length === 4, '4 super-slow patterns');
for (const letter of 'ABCDEFGHIJKL') assert(program.sessions[letter]?.letter === letter, `session ${letter} defined`);
for (const id of ['coldShower', 'coldImmersion', 'fastedCardio', 'lightMovement', 'postMealWalk', 'decompression']) assert(!!program.sessions[id], `protocol ${id} defined`);

const refs = (d: (typeof program.days)[number]) => [...d.am, ...d.main, ...d.pm].map((r) => r.id);
const dayAt = (w: number, d: number) => program.days[(w - 1) * 7 + d - 1]!;
assert(refs(dayAt(2, 6)).includes('H'), 'W2 D6 = H');
assert(refs(dayAt(2, 7)).includes('L'), 'W2 D7 contains L');
assert(refs(dayAt(1, 6)).includes('G'), 'W1 D6 = G');
assert(refs(dayAt(1, 7)).includes('K') && refs(dayAt(1, 7)).includes('J'), 'W1 D7 = K + J');

// Every SessionRef resolves
const unresolved: string[] = [];
for (const d of program.days) {
  assert(d.n === (d.week - 1) * 7 + d.day, `day ${d.n} numbering (W${d.week} D${d.day})`);
  for (const r of [...d.am, ...d.main, ...d.pm]) {
    if (!program.sessions[r.id]) unresolved.push(`day ${d.n}: ${r.id}`);
    if (r.id === 'A' && r.variant && !program.tabataMovements.find((m) => m.id === r.variant)) unresolved.push(`day ${d.n}: tabata movement ${r.variant}`);
    if (r.id === 'B' && r.variant && !['seqA', 'seqB', 'applied'].includes(r.variant)) unresolved.push(`day ${d.n}: foundation variant ${r.variant}`);
    if (r.id === 'G' && r.variant && !['G1', 'G2', 'G3'].includes(r.variant)) unresolved.push(`day ${d.n}: sprint preset ${r.variant}`);
  }
}
assert(unresolved.length === 0, `every SessionRef resolves ${unresolved.join(', ')}`);

// Weekly pattern: odd weeks mirror W1 (G on D6, K on D7), even weeks mirror W2 (H on D6, L on D7); Foundation daily
for (let w = 1; w <= 6; w++) {
  const odd = w % 2 === 1;
  assert(refs(dayAt(w, 6)).includes(odd ? 'G' : 'H'), `W${w} D6 = ${odd ? 'G (sprints)' : 'H (5x4)'}`);
  assert(refs(dayAt(w, 7)).includes(odd ? 'K' : 'L'), `W${w} D7 = ${odd ? 'K (yoga)' : 'L (stamina)'}`);
  assert(refs(dayAt(w, 7)).includes('J'), `W${w} D7 ends with J (contrast)`);
  assert(refs(dayAt(w, 2)).includes('C') && refs(dayAt(w, 3)).includes('E') && refs(dayAt(w, 4)).includes('F') && refs(dayAt(w, 5)).includes('I'), `W${w} D2 C · D3 E · D4 F · D5 I`);
  const explosive = dayAt(w, 2).main.find((r) => r.id === 'C')!.note?.includes('explosive') ?? false;
  assert(explosive === !odd, `W${w} 7-minute ${odd ? 'base moves' : 'explosive swaps'}`);
  const tab = [1, 3, 5].map((d) => dayAt(w, d).main.find((r) => r.id === 'A')?.variant);
  assert(JSON.stringify(tab) === JSON.stringify(tabataRotationFor(w)), `W${w} tabata rotation ${tab.join('/')}`);
  assert(new Set(tab).size === 3, `W${w} three different tabata movements`);
  if (odd) assert(dayAt(w, 6).main.find((r) => r.id === 'G')?.variant === sprintPresetFor(w), `W${w} sprint preset ${sprintPresetFor(w)}`);
  for (let d = 1; d <= 7; d++) {
    const day = dayAt(w, d);
    const want = d === 7 ? 'applied' : d % 2 === 1 ? 'A' : 'B';
    assert(day.foundation === want && day.main.some((r) => r.id === 'B'), `W${w} D${d} foundation ${want}`);
  }
}
const trios = [1, 2, 3, 4, 5, 6].map((w) => tabataRotationFor(w).join('/'));
assert(new Set(trios).size === 6, 'six distinct weekly tabata trios');
for (const id of program.tabataRotation.weeks.flat()) assert(!!program.tabataMovements.find((m) => m.id === id), `tabata movement ${id} defined`);
assert(Object.keys(sevenMinuteMoves).length === 19, '12 base + 7 swap seven-minute moves');

// Day table
const label = (r: { id: string; variant?: string; note?: string; optional?: boolean }) => {
  const s = program.sessions[r.id]!;
  let t = s.letter ? `${s.letter}. ${s.short ?? s.name}` : (s.short ?? s.name);
  if (r.variant) t += ` (${r.variant})`;
  if (r.note) t += ` [${r.note}]`;
  if (r.optional) t += ' (opt)';
  return t;
};
console.log('\nDay table (weeks 1–2: compare with source pages 1 and 7; weeks 3–6: rotated repeats)');
console.log('N  | W D | Load               | Time        | Fnd     | AM                            | MAIN                                                        | PM');
for (const d of program.days) {
  const row = [
    String(d.n).padEnd(2),
    `${d.week} ${d.day}`,
    d.load.padEnd(18),
    d.timeEstimate.padEnd(11),
    `${d.foundation}/${d.foundationMode}`.padEnd(7),
    d.am.map(label).join(' + ').padEnd(29),
    d.main.map(label).join(' + ').padEnd(59),
    d.pm.map(label).join(' + ') || '—',
  ];
  console.log(row.join(' | '));
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s)`);
if (failures > 0) process.exit(1);
