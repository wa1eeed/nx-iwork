// Google Cloud credentials resolution for Vertex AI (chat + embeddings).
//
// Keyless-first (recommended): set only GCP_PROJECT_ID (+ GCP_LOCATION) and let
// Application Default Credentials (ADC) resolve auth automatically — from
// `gcloud auth application-default login` locally, or the attached service
// account / Workload Identity on a GCP/VPS host. No JSON files, no secrets in
// env. The SDK and google-auth-library use ADC out of the box when we pass no
// explicit credentials.
//
// Optional override: inline env credentials (GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY)
// for hosts where ADC isn't available. If both are set we pass them explicitly;
// otherwise the libraries fall back to ADC.

export interface GcpCredentials {
  client_email: string;
  private_key: string;
}

// Inline credentials from env, or null to defer to ADC. The private key is
// stored one-line with escaped "\n"; restore real newlines (no-op if already
// real newlines).
export function getGcpCredentials(): GcpCredentials | null {
  const client_email = process.env.GCP_CLIENT_EMAIL;
  const rawKey = process.env.GCP_PRIVATE_KEY;
  if (!client_email || !rawKey) return null;
  return { client_email, private_key: rawKey.replace(/\\n/g, '\n') };
}

// Vertex/embeddings are "configured" once a project is set — auth itself is
// resolved at call time (inline env → ADC). We don't gate on a key being
// present, so pure-ADC setups work.
export function isGcpConfigured(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID);
}
