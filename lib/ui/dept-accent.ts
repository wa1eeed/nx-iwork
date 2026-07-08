// One hue per department (the design's harmonious multi-accent system). Feed the
// returned hue into `--dept-h` on an element, then use the `.dept-*` utilities
// (globals.css) — they derive accent/tint/ink from it via a shared oklch formula.

import type { CSSProperties } from 'react';

// Known department names → the handoff's canonical hues.
const NAMED: Record<string, number> = {
  sales: 155,
  marketing: 40,
  support: 305,
  operations: 200,
  finance: 80,
  appointments: 250,
  bookings: 250,
  hr: 340,
  'human resources': 340,
};

// Deterministic fallback palette for custom departments.
const PALETTE = [250, 40, 155, 305, 80, 200, 340, 20];

/** Stable hue for a department (by known name, else a deterministic hash). */
export function deptHue(input: { name?: string | null; nameEn?: string | null; id?: string | null }): number {
  const key = (input.nameEn || input.name || '').trim().toLowerCase();
  for (const [needle, hue] of Object.entries(NAMED)) {
    if (key.includes(needle)) return hue;
  }
  const seed = input.id || key || 'x';
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[n % PALETTE.length];
}

/** Inline style object that sets `--dept-h` for the `.dept-*` utilities. */
export function deptStyle(input: Parameters<typeof deptHue>[0]): CSSProperties {
  return { '--dept-h': String(deptHue(input)) } as CSSProperties;
}
