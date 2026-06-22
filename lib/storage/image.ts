// Server-side image compression (sharp). Runs before the bytes go to R2 — the
// file passes through the server only for this momentary pass.
//
// Policy: convert to WebP @ quality 80 (keeps text readable for Gemini OCR while
// dropping size to ~hundreds of KB), and cap the width at 1200px (never enlarge).
// On any sharp failure we fall back to the ORIGINAL bytes (logged) so an upload
// is never blocked by an odd/corrupt image. Non-images pass through untouched.

import sharp from 'sharp';

const MAX_WIDTH = 1200;
const QUALITY = 80;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  ext: string;
  compressed: boolean;
}

export async function processImage(input: Buffer, originalType: string): Promise<ProcessedImage> {
  // Only raster images go through sharp; PDFs / others pass through as-is.
  if (!originalType.startsWith('image/')) {
    return { buffer: input, contentType: originalType, ext: EXT[originalType] ?? 'bin', compressed: false };
  }

  try {
    const out = await sharp(input)
      .rotate() // honor EXIF orientation
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    return { buffer: out, contentType: 'image/webp', ext: 'webp', compressed: true };
  } catch (err) {
    console.error('[image] sharp compression failed — uploading the original', err);
    return { buffer: input, contentType: originalType, ext: EXT[originalType] ?? 'bin', compressed: false };
  }
}
