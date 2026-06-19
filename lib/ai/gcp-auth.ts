// Google Cloud credentials resolution for Vertex AI (chat + embeddings).
//
// Preferred: inline env credentials (GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY) — copied
// straight from the service-account JSON. This keeps secrets in env (12-factor),
// so swapping Google accounts is a paste-and-restart in Coolify with no file
// mounts. Fallback: Application Default Credentials via
// GOOGLE_APPLICATION_CREDENTIALS (a mounted JSON path) — still supported so
// existing setups don't break.

export interface GcpCredentials {
  client_email: string;
  private_key: string;
}

// Returns inline credentials from env, or null when they're not both set.
// Env stores the private key on one line with escaped "\n"; restore real
// newlines (no-op if the value already contains real newlines).
export function getGcpCredentials(): GcpCredentials | null {
  const client_email = process.env.GCP_CLIENT_EMAIL;
  const rawKey = process.env.GCP_PRIVATE_KEY;
  if (!client_email || !rawKey) return null;
  return { client_email, private_key: rawKey.replace(/\\n/g, '\n') };
}

// True when SOME credential source is configured (inline env OR a file path).
export function hasGcpAuth(): boolean {
  return Boolean(
    (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}
