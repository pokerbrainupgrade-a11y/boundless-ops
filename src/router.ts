import { signal } from '@preact/signals';

export interface Route {
  /** e.g. "/moves/tabata" */
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = typeof location === 'undefined' ? '' : location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  const parts = p.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, query: new URLSearchParams(q) };
}

export const route = signal<Route>(parse());

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parse();
  });
}

export function navigate(to: string, replace = false): void {
  const hash = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to);
  if (replace) {
    const url = location.pathname + location.search + hash;
    history.replaceState(null, '', url);
    route.value = parse();
  } else {
    location.hash = hash;
  }
}

export function back(): void {
  if (history.length > 1) history.back();
  else navigate('/today');
}
