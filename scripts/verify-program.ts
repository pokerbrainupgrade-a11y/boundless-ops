/**
 * Build-time gate for program.json. Exits non-zero on any failure and prints
 * the day-by-day table for a by-eye diff against the source pages 1 and 7.
 */
import { program, sevenMinuteMoves } from '../src/data/program';

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}

console.log('verify-program');
assert(program.days.length === 14, '14 days');
assert(program.foundation.seqA.length === 7, 'Seq A = 7');
assert(program.foundation.seqB.length === 6, 'Seq B = 6');
assert(program.foundation.seqB[4]?.name === 'Woodpecker Rotation', 'Seq B #5 is Woodpecker Rotation');
assert(program.mobilityStations.length === 15, '15 mobility stations');
assert(program.sevenMinute.length === 12, '12 seven-minute moves');
assert(program.sevenMinute.filter((m) => m.w2Swap).length === 7, '7 seven-minute W2 swaps');
assert(program.superSlowPatterns.length === 4, '4 super-slow patterns');
for (const letter of 'ABCDEFGHIJKL') assert(program.sessions[letter]?.letter === letter, `session ${letter} defined`);
for (const id of ['coldShower', 'coldImmersion', 'fastedCardio', 'lightMovement', 'postMealWalk', 'decompression']) assert(!!program.sessions[id], `protocol ${id} defined`);

const w2d6 = program.days[12]!;
const w2d7 = program.days[13]!;
const refs = (d: typeof w2d6) => [...d.am, ...d.main, ...d.pm].map((r) => r.id);
assert(w2d6.week === 2 && w2d6.day === 6 && refs(w2d6).includes('H'), 'W2 D6 = H');
assert(w2d7.week === 2 && w2d7.day === 7 && refs(w2d7).includes('L'), 'W2 D7 contains L');
assert(refs(program.days[5]!).includes('G'), 'W1 D6 = G');
assert(refs(program.days[6]!).includes('K') && refs(program.days[6]!).includes('J'), 'W1 D7 = K + J');

// Every SessionRef resolves
const unresolved: string[] = [];
for (const d of program.days) {
  assert(d.n === (d.week - 1) * 7 + d.day, `day ${d.n} numbering (W${d.week} D${d.day})`);
  for (const r of [...d.am, ...d.main, ...d.pm]) {
    if (!program.sessions[r.id]) unresolved.push(`day ${d.n}: ${r.id}`);
    if (r.id === 'A' && r.variant && !program.tabataMovements.find((m) => m.id === r.variant)) unresolved.push(`day ${d.n}: tabata movement ${r.variant}`);
    if (r.id === 'B' && r.variant && !['seqA', 'seqB', 'applied'].includes(r.variant)) unresolved.push(`day ${d.n}: foundation variant ${r.variant}`);
  }
}
assert(unresolved.length === 0, `every SessionRef resolves ${unresolved.join(', ')}`);

// Foundation runs every day: A on D1/3/5, B on D2/4/6, applied on D7
for (const d of program.days) {
  const want = d.day === 7 ? 'applied' : d.day % 2 === 1 ? 'A' : 'B';
  assert(d.foundation === want && d.main.some((r) => r.id === 'B'), `day ${d.n} foundation ${want}`);
}

// Tabata rotation
const rot = program.tabataRotation;
const tabataDays = program.days.filter((d) => d.main.some((r) => r.id === 'A'));
const w1 = tabataDays.filter((d) => d.week === 1).map((d) => d.main.find((r) => r.id === 'A')!.variant);
const w2 = tabataDays.filter((d) => d.week === 2).map((d) => d.main.find((r) => r.id === 'A')!.variant);
assert(JSON.stringify(w1) === JSON.stringify(rot.w1), `W1 tabata rotation ${w1.join('/')}`);
assert(JSON.stringify(w2) === JSON.stringify(rot.w2), `W2 tabata rotation ${w2.join('/')}`);
for (const id of [...rot.w1, ...rot.w2]) assert(!!program.tabataMovements.find((m) => m.id === id), `tabata movement ${id} defined`);
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
console.log('\nDay table (compare with source pages 1 and 7)');
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
