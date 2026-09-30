import type { EngineSnapshot } from './engine';

/**
 * A timer in progress, kept in localStorage so a reload (or iOS killing the
 * PWA in the background) resumes it instead of losing the session.
 */
export interface ActiveRun {
  /** Hash route of the session screen, e.g. "/session/lightMovement?day=1&slot=am". */
  path: string;
  startedAt: string;
  /** Preset options chosen on the setup screen, so the same segments rebuild. */
  config?: object;
  snap: EngineSnapshot;
}

const KEY = 'bops.active';
/** A run older than this was abandoned; don't resurrect it. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function readActiveRun(path?: string): ActiveRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<ActiveRun>;
    if (!r.path || !r.startedAt || !r.snap) return null;
    if (r.snap.status !== 'running' && r.snap.status !== 'paused') return null;
    if (!(Date.now() - Date.parse(r.startedAt) < MAX_AGE_MS)) {
      clearActiveRun();
      return null;
    }
    if (path !== undefined && r.path !== path) return null;
    return r as ActiveRun;
  } catch {
    return null;
  }
}

export function writeActiveRun(r: ActiveRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage full or blocked: the run just won't survive a reload */
  }
}

export function clearActiveRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
