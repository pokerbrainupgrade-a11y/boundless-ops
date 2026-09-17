/**
 * Apple Health clipboard bridge.
 * Request:  BOPS|<sessionId>|<startISO>|<endISO>
 * Response: BOPS-HR|<sessionId>|<avg>|<max>
 */
export const REQUEST_PREFIX = 'BOPS';
export const RESPONSE_PREFIX = 'BOPS-HR';
export const SHORTCUT_NAME = 'Boundless HR';

export function buildHealthRequest(sessionKey: string, startISO: string, endISO: string): string {
  return `${REQUEST_PREFIX}|${sessionKey}|${startISO}|${endISO}`;
}

export function shortcutUrl(name = SHORTCUT_NAME): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}

export type HealthParse =
  | { ok: true; sessionKey: string; avg: number; max: number }
  | { ok: false; reason: 'empty' | 'wrong-prefix' | 'malformed' | 'wrong-session' | 'bad-numbers' };

export function parseHealthResponse(text: string | null | undefined, expectedSessionKey: string): HealthParse {
  const raw = (text ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  const parts = raw.split('|').map((p) => p.trim());
  if (parts[0] !== RESPONSE_PREFIX) return { ok: false, reason: 'wrong-prefix' };
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [, sessionKey, avgS, maxS] = parts as [string, string, string, string];
  if (sessionKey !== expectedSessionKey) return { ok: false, reason: 'wrong-session' };
  const avg = Number(avgS.replace(/[^0-9.]/g, ''));
  const max = Number(maxS.replace(/[^0-9.]/g, ''));
  if (!isFinite(avg) || !isFinite(max) || avg <= 0 || max <= 0 || avg > 260 || max > 260) return { ok: false, reason: 'bad-numbers' };
  return { ok: true, sessionKey, avg: Math.round(avg), max: Math.round(max) };
}

export function healthErrorMessage(reason: Exclude<HealthParse, { ok: true }>['reason']): string {
  switch (reason) {
    case 'empty': return 'Clipboard is empty. Run the Boundless HR shortcut first.';
    case 'wrong-prefix': return "Clipboard doesn't hold a Boundless HR result.";
    case 'malformed': return 'The HR result is incomplete. Check the shortcut steps.';
    case 'wrong-session': return 'That HR result is for a different session.';
    case 'bad-numbers': return 'The HR numbers look wrong. Enter them by hand instead.';
  }
}
