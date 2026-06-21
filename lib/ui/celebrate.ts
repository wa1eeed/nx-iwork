// Brand-colored confetti for genuine milestones (first agent hired, setup
// complete, first sale). Used sparingly — celebration loses meaning if it fires
// for routine actions. Lazy-imports canvas-confetti so it stays out of the
// initial bundle, and honors prefers-reduced-motion.

const BRAND = ['#22d3ee', '#0ea5e9', '#8b5cf6', '#a855f7', '#ffffff'];

export async function celebrate(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  try {
    const confetti = (await import('canvas-confetti')).default;
    const fire = (ratio: number, opts: Record<string, unknown>) =>
      confetti({ origin: { y: 0.7 }, colors: BRAND, disableForReducedMotion: true, particleCount: Math.floor(180 * ratio), ...opts });

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  } catch {
    /* confetti is non-essential — ignore load/runtime errors */
  }
}
