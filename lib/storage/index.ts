// Entry point for the storage layer. Reads env config and returns the active
// provider. Business code imports getStorage()/companyKey() from here only.

import { createR2Provider } from './r2';
import type { StorageProvider } from './types';

export * from './types';

let cached: StorageProvider | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL
  );
}

// Throws a clear error if storage isn't configured, so the caller can surface
// "storage not set up" instead of a vague SDK failure.
export function getStorage(): StorageProvider {
  if (cached) return cached;
  if (!isStorageConfigured()) {
    throw new Error(
      'Storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL.'
    );
  }
  cached = createR2Provider({
    endpoint: process.env.R2_ENDPOINT!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!,
  });
  return cached;
}

// Tenant isolation for files: every object lives under the company's prefix.
// Sanitises parts to avoid path traversal / weird keys.
export function companyKey(companyId: string, ...parts: string[]): string {
  const clean = parts
    .join('/')
    .replace(/\.\.+/g, '')
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '');
  return `companies/${companyId}/${clean}`;
}
