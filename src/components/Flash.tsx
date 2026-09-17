import { signal } from '@preact/signals';
import { settings } from '@/lib/settings';

const flashKind = signal<'work' | 'rest' | null>(null);
const flashKey = signal(0);
let lastFlash = 0;

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Full-screen color flash, 250 ms, never faster than 3 Hz. */
export function flash(kind: 'work' | 'rest') {
  if (!settings.value.flash || reduced()) return;
  const now = performance.now();
  if (now - lastFlash < 334) return;
  lastFlash = now;
  flashKind.value = kind;
  flashKey.value++;
  setTimeout(() => {
    if (flashKey.value && flashKind.value === kind) flashKind.value = null;
  }, 260);
}

export function FlashOverlay() {
  const k = flashKind.value;
  return <div key={flashKey.value} class={`flash ${k ?? ''} ${k ? 'on' : ''}`} aria-hidden="true" />;
}
