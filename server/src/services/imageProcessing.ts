import sharp from 'sharp';

/**
 * Downscale + re-encode an uploaded photo so it stays visually solid but small.
 *
 * 1600px longest edge / JPEG q80 (mozjpeg) turns a typical 3–5 MB phone photo
 * into ~150–350 KB with no quality loss that matters for "is the chore done"
 * proof. `.rotate()` bakes in EXIF orientation and drops all other metadata
 * (GPS included). The same compressed buffer is what we send to Anthropic, so
 * this also cuts vision-token cost and latency.
 *
 * If sharp cannot decode the input (e.g. an exotic HEIC variant), the original
 * bytes are returned untouched rather than failing the upload — the photo is
 * still stored and shown; only the AI step may skip it.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 80;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
}

export async function compressPhoto(
  input: Buffer,
  originalContentType: string,
): Promise<ProcessedImage> {
  try {
    const buffer = await sharp(input)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buffer, contentType: 'image/jpeg' };
  } catch (err) {
    console.warn('[imageProcessing] compression failed; storing original', err);
    return { buffer: input, contentType: originalContentType };
  }
}
