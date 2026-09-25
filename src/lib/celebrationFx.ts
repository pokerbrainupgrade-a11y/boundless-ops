/**
 * Side effects a celebration plays: haptics and sound, plus the reduced-motion check.
 * Everything feature-detects and fails silent. iOS Safari has no Vibration API, so haptics
 * simply do not happen there; sound still plays when the tap that finished the day unlocked audio.
 */
import type { CelebrationTier } from './celebration';
import { celebrationDayChime, celebrationMilestoneFanfare } from './audio';

/** Distinct vibration pattern per tier, in ms on/off. */
export const HAPTIC_PATTERN: Record<CelebrationTier, number[]> = {
  day: [35, 45, 70],
  milestone: [60, 50, 60, 50, 60, 60, 180],
};

export const DURATION_MS: Record<CelebrationTier, number> = { day: 1500, milestone: 3000 };

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** True when the user asked for less motion: no particles, no draw-in, a static card instead. */
export function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function vibrate(tier: CelebrationTier): boolean {
  if (!hapticsSupported()) return false;
  try {
    return navigator.vibrate(HAPTIC_PATTERN[tier]);
  } catch {
    return false;
  }
}

export function playSound(tier: CelebrationTier): void {
  if (tier === 'day') celebrationDayChime();
  else celebrationMilestoneFanfare();
}

/** Fire haptics and sound for a tier. Called once when the overlay mounts. */
export function playCelebrationFx(tier: CelebrationTier): void {
  vibrate(tier);
  playSound(tier);
}
