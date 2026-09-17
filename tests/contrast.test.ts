import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** WCAG relative luminance and contrast ratio. */
function lum(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

const css = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))![1]!;

describe('design tokens meet WCAG AA', () => {
  const bgs = ['bg', 'surface', 'surface-2'];
  it('body and secondary text on every background ≥ 4.5', () => {
    for (const bg of bgs) {
      expect(contrast(token('text'), token(bg)), `text on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('tan'), token(bg)), `tan on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('muted'), token(bg)), `muted on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('signal (WORK) and rest-hi (REST text) on every background ≥ 4.5', () => {
    for (const bg of bgs) {
      expect(contrast(token('signal'), token(bg)), `signal on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token('rest-hi'), token(bg)), `rest-hi on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // --rest is used for large timer digits and fills on the app background only: ≥ 3 (AA large) everywhere, ≥ 4.5 on bg
    expect(contrast(token('rest'), token('bg'))).toBeGreaterThanOrEqual(4.5);
    for (const bg of bgs) expect(contrast(token('rest'), token(bg)), `rest on ${bg}`).toBeGreaterThanOrEqual(3);
  });
  it('ink on filled chips/buttons and text on olive drab ≥ 4.5', () => {
    for (const c of ['signal', 'tan', 'rest']) expect(contrast(token('ink'), token(c)), `ink on ${c}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('text'), token('od'))).toBeGreaterThanOrEqual(4.5);
  });
  it('danger is an accent (border) only; text over it is never required', () => {
    // documents the constraint: #C0392B does not reach 4.5 against the dark backgrounds, so it is used for borders and chips with --text
    expect(contrast(token('danger'), token('bg'))).toBeGreaterThanOrEqual(3);
  });
});
