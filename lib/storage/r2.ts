// Cloudflare R2 adapter (S3-compatible). Uses the AWS S3 v3 SDK pointed at R2's
// endpoint, so the exact same code runs against AWS S3 or Alibaba OSS by
// changing endpoint/credentials only.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignedUpload, StorageProvider } from './types';

export interface R2Config {
  endpoint: string; // https://<accountid>.r2.cloudflarestorage.com
  region?: string; // R2 ignores region but the SDK requires one
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL (R2 public bucket domain or custom domain). */
  publicBaseUrl: string;
}

export function createR2Provider(config: R2Config): StorageProvider {
  const client = new S3Client({
    region: config.region ?? 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const publicUrl = (key: string) =>
    `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`;

  return {
    id: 'r2',

    async createUploadUrl({ key, contentType, expiresIn = 300 }): Promise<PresignedUpload> {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      return { uploadUrl, key, publicUrl: publicUrl(key), contentType };
    },

    async createDownloadUrl(key, expiresIn = 300): Promise<string> {
      const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn });
    },

    publicUrl,

    async delete(key): Promise<void> {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
      );
    },
  };
}
