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

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface GcpCredentials {
  client_email: string;
  private_key: string;
}

// VPS-friendly ADC: Google's 2026 policy blocks API keys and may block
// downloading service-account JSON, so the ADC file is generated on the server
// (`gcloud auth application-default login --no-browser`) and its CONTENTS are
// pasted into Coolify as GOOGLE_APPLICATION_CREDENTIALS_JSON. We materialize
// that into a temp file and point GOOGLE_APPLICATION_CREDENTIALS at it, so the
// SDK/google-auth-library pick it up as standard ADC (works for both
// authorized_user and service_account credential types).
let adcMaterialized = false;
export function ensureAdcFromEnv(): void {
  if (adcMaterialized) return;
  adcMaterialized = true; // attempt once

  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!json) return;
  // An explicit file path always wins — don't overwrite it.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  try {
    JSON.parse(json);
  } catch {
    console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON — ignoring');
    return;
  }
  try {
    const path = join(tmpdir(), 'gcp-adc.json');
    writeFileSync(path, json, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  } catch (err) {
    console.error('Failed to materialize ADC credentials file', err);
  }
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
// resolved at call time (inline env → GOOGLE_APPLICATION_CREDENTIALS_JSON → ADC).
// We don't gate on a key being present, so pure-ADC setups work.
export function isGcpConfigured(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID);
}
