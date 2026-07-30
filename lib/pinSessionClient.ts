// lib/pinSessionClient.ts
// Display-only. The real spending-cap enforcement lives entirely
// server-side (lib/pinSession.ts, an httpOnly cookie + Firestore record)
// — this file only decides what NUMBERS to show on screen, which is not
// a security boundary. Cleared automatically when the tab/session ends
// (sessionStorage, not localStorage) so a shared/public device doesn't
// carry a mode across visits.
const KEY = 'ibi_pin_mode';

export type PinMode = 'main' | 'duress' | null;

export function getClientPinMode(): PinMode {
  if (typeof window === 'undefined') return null;
  const v = sessionStorage.getItem(KEY);
  return v === 'main' || v === 'duress' ? v : null;
}

export function setClientPinMode(mode: 'main' | 'duress') {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, mode);
}

export function clearClientPinMode() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

/** Scales a real amount for display under the current mode. Duress shows 1% of the real figure. */
export function scaleForDisplay(realAmount: number, mode: PinMode): number {
  if (mode === 'duress') return Math.floor(realAmount / 100);
  return realAmount;
}
