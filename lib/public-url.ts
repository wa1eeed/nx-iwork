// The user-facing host where company landing pages live: bznss.one/<slug>.
// Derived from NEXT_PUBLIC_APP_URL so it follows the deployment without code
// changes; falls back to a sane default for local/dev.
export function publicHost(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    return new URL(raw).host;
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

// Full public landing URL for a slug, e.g. "bznss.one/acme".
export function landingUrl(slug: string): string {
  return `${publicHost()}/${slug}`;
}
