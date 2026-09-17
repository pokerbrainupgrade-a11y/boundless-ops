import { describe, it, expect } from 'vitest';
import { buildHealthRequest, parseHealthResponse, shortcutUrl, healthErrorMessage } from '@/lib/health';

describe('health clipboard bridge', () => {
  it('builds the request string', () => {
    expect(buildHealthRequest('abc123', '2026-09-16T13:00:00.000Z', '2026-09-16T13:30:00.000Z')).toBe('BOPS|abc123|2026-09-16T13:00:00.000Z|2026-09-16T13:30:00.000Z');
    expect(shortcutUrl()).toBe('shortcuts://run-shortcut?name=Boundless%20HR');
  });
  it('parses a valid response', () => {
    expect(parseHealthResponse('BOPS-HR|abc123|142.4|171', 'abc123')).toEqual({ ok: true, sessionKey: 'abc123', avg: 142, max: 171 });
    expect(parseHealthResponse('  BOPS-HR | abc123 | 142 bpm | 171 bpm \n', 'abc123')).toEqual({ ok: true, sessionKey: 'abc123', avg: 142, max: 171 });
  });
  it('rejects wrong prefix', () => {
    expect(parseHealthResponse('BOPS|abc123|x|y', 'abc123')).toEqual({ ok: false, reason: 'wrong-prefix' });
    expect(parseHealthResponse('hello', 'abc123')).toEqual({ ok: false, reason: 'wrong-prefix' });
  });
  it('rejects wrong session', () => {
    expect(parseHealthResponse('BOPS-HR|other|142|171', 'abc123')).toEqual({ ok: false, reason: 'wrong-session' });
  });
  it('rejects garbage and empties', () => {
    expect(parseHealthResponse('', 'abc123')).toEqual({ ok: false, reason: 'empty' });
    expect(parseHealthResponse(null, 'abc123')).toEqual({ ok: false, reason: 'empty' });
    expect(parseHealthResponse('BOPS-HR|abc123|142', 'abc123')).toEqual({ ok: false, reason: 'malformed' });
    expect(parseHealthResponse('BOPS-HR|abc123|abc|def', 'abc123')).toEqual({ ok: false, reason: 'bad-numbers' });
    expect(parseHealthResponse('BOPS-HR|abc123|0|999', 'abc123')).toEqual({ ok: false, reason: 'bad-numbers' });
  });
  it('has a message for every reason', () => {
    for (const r of ['empty', 'wrong-prefix', 'malformed', 'wrong-session', 'bad-numbers'] as const) expect(healthErrorMessage(r).length).toBeGreaterThan(5);
  });
});
