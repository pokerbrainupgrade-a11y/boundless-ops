import type { SessionLog } from './db';

/**
 * The After Action Report being filled in, autosaved on every input so a
 * reload doesn't lose the session before FILE REPORT. One draft at a time.
 */
export interface ReportDraft {
  /** Route the form lives on: the session URL for a new report, /aar/:id for an edit. */
  path: string;
  log: SessionLog;
  note?: string;
  savedAt: string;
}

const KEY = 'bops.report';
/** A draft older than this was abandoned. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function readReportDraft(path?: string): ReportDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ReportDraft>;
    if (!d.path || !d.log || !d.savedAt) return null;
    if (!(Date.now() - Date.parse(d.savedAt) < MAX_AGE_MS)) {
      clearReportDraft();
      return null;
    }
    if (path !== undefined && d.path !== path) return null;
    return d as ReportDraft;
  } catch {
    return null;
  }
}

export function writeReportDraft(path: string, log: SessionLog, note?: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, log, note, savedAt: new Date().toISOString() } satisfies ReportDraft));
  } catch {
    /* storage full or blocked: the draft just won't survive a reload */
  }
}

export function clearReportDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
