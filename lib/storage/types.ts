// Provider-agnostic storage layer.
//
// Same philosophy as lib/ai/: business code talks to this neutral interface,
// never to a vendor SDK. The default adapter targets Cloudflare R2 (S3-compatible,
// zero egress), but because the surface is plain S3 semantics, swapping to AWS
// S3 / Alibaba OSS later is an endpoint + credentials change, nothing more.
//
// Uploads are direct-to-bucket via presigned PUT URLs: the app server only
// signs, the file bytes never transit the VPS. That keeps storage off the VPS's
// resources and scales independently of the app.

export interface PresignedUpload {
  /** PUT the raw file body here (direct to the bucket). */
  uploadUrl: string;
  /** The object key the file will live at. Persist this, not the URL. */
  key: string;
  /** Public URL to read the object (when the bucket/prefix is public). */
  publicUrl: string;
  /** Echoed so the client sends a matching Content-Type on the PUT. */
  contentType: string;
}

export interface StorageProvider {
  readonly id: string;

  /** Mint a presigned PUT URL for a direct client→bucket upload. */
  createUploadUrl(opts: {
    key: string;
    contentType: string;
    /** Link lifetime in seconds (default 300). */
    expiresIn?: number;
  }): Promise<PresignedUpload>;

  /** Server-side upload of a buffer straight to the bucket (e.g. after sharp
   *  compression, where the bytes must pass through the server briefly). */
  put(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string
  ): Promise<{ key: string; publicUrl: string }>;

  /** Presigned GET for private objects (default 300s). */
  createDownloadUrl(key: string, expiresIn?: number): Promise<string>;

  /** Stable public URL for an object (public buckets only). */
  publicUrl(key: string): string;

  delete(key: string): Promise<void>;
}
