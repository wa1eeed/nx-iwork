import { deptHue } from '@/lib/ui/dept-accent';

// A generated **holographic AI-employee avatar**. Deterministic from `seed`
// (the agent id) so every agent gets a distinct, stable persona: the hue and the
// facets/eyes/scanlines all derive from the seed — no two agents look alike, and
// no external image assets. Pure SVG → server-renderable, RTL-safe, tiny.

type Status = 'ONLINE' | 'ONBOARDING' | 'PAUSED' | 'IDLE' | 'NEEDS_YOU' | 'ARCHIVED';

const STATUS_FILL: Record<Status, string> = {
  ONLINE: 'oklch(0.62 0.15 155)',
  ONBOARDING: 'oklch(0.72 0.14 80)',
  NEEDS_YOU: 'oklch(0.64 0.16 45)',
  PAUSED: '#c9c0af',
  IDLE: '#c9c0af',
  ARCHIVED: '#c9c0af',
};

// Small deterministic PRNG (xmur3 seed → mulberry32).
function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function HolographicAvatar({
  seed,
  hue,
  dept,
  size = 46,
  status,
  ring = true,
  className,
}: {
  seed: string;
  hue?: number;
  dept?: { name?: string | null; nameEn?: string | null; id?: string | null };
  size?: number;
  status?: Status;
  ring?: boolean;
  className?: string;
}) {
  const r = makeRng(seed);
  const H = hue ?? (dept ? deptHue(dept) : Math.floor(r() * 360));
  const uid = `ha_${Math.abs(hashCode(seed)).toString(36)}`;

  // Feature variation (the "ملامح مختلفة").
  const facets = 3 + Math.floor(r() * 4); // 3–6 holographic bands
  const spin = Math.floor(r() * 60); // band rotation
  const eyeY = 40 + r() * 8;
  const eyeGap = 12 + r() * 8;
  const eyeR = 3.4 + r() * 1.8;
  const coreX = 46 + r() * 8;
  const visor = r() > 0.5;

  const light = `oklch(0.92 0.06 ${H})`;
  const mid = `oklch(0.72 0.15 ${H})`;
  const deep = `oklch(0.5 0.16 ${H})`;
  const accent = `oklch(0.64 0.13 ${H})`;
  const bright = `oklch(0.98 0.04 ${H})`;

  const dot = size * 0.28;

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id={`${uid}_bg`} cx="42%" cy="36%" r="72%">
            <stop offset="0%" stopColor={light} />
            <stop offset="55%" stopColor={mid} />
            <stop offset="100%" stopColor={deep} />
          </radialGradient>
          <clipPath id={`${uid}_clip`}>
            <circle cx="50" cy="50" r="48" />
          </clipPath>
        </defs>

        <g clipPath={`url(#${uid}_clip)`}>
          <circle cx="50" cy="50" r="48" fill={`url(#${uid}_bg)`} />

          {/* Holographic sheen bands — count + angle vary per agent. */}
          <g transform={`rotate(${spin} 50 50)`} opacity="0.5">
            {Array.from({ length: facets }).map((_, i) => (
              <ellipse
                key={i}
                cx="50"
                cy={18 + (i * 64) / facets}
                rx="70"
                ry={3 + (i % 2) * 2}
                fill={light}
                opacity={0.12 + (i % 3) * 0.05}
              />
            ))}
          </g>

          {/* Scanlines. */}
          <g opacity="0.10">
            {Array.from({ length: 7 }).map((_, i) => (
              <rect key={i} x="0" y={12 + i * 11} width="100" height="1.2" fill="#fff" />
            ))}
          </g>

          {/* Bright core + asymmetric highlight nodes (the "eyes"/features). */}
          <circle cx={coreX} cy="34" r="8" fill={light} opacity="0.5" />
          <circle cx={50 - eyeGap / 2} cy={eyeY} r={eyeR} fill={bright} />
          <circle cx={50 + eyeGap / 2} cy={eyeY} r={eyeR} fill={light} />
          {visor ? (
            <path d={`M ${50 - eyeGap} ${eyeY + 12} Q 50 ${eyeY + 18} ${50 + eyeGap} ${eyeY + 12}`} stroke={light} strokeWidth="2" fill="none" opacity="0.7" />
          ) : (
            <rect x={50 - eyeGap} y={eyeY + 11} width={eyeGap * 2} height="2.4" rx="1.2" fill={light} opacity="0.6" />
          )}
        </g>

        {ring && <circle cx="50" cy="50" r="47" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.9" />}
      </svg>

      {status && (
        <span
          style={{
            position: 'absolute',
            insetInlineEnd: 0,
            bottom: 0,
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: STATUS_FILL[status],
            boxShadow: '0 0 0 2.5px hsl(var(--card))',
          }}
          className={status === 'ONBOARDING' ? 'animate-pulse' : undefined}
        />
      )}
    </span>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
