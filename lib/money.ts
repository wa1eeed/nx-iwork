// Money math for the wallet (SAR, 2 decimals). Keep all money math going through
// round2 so cent-level float artifacts never reach the DB or the screen.
// Display formatting (Latin digits, no price grouping) lives in lib/format.ts.

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
