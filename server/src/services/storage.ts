import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

/**
 * Object storage for proof/reference photos, backed by Cloudflare R2 (S3 API).
 *
 * Objects are stored under unguessable UUID keys and served to browsers from a
 * PUBLIC bucket via R2_PUBLIC_BASE_URL (typically a Cloudflare custom domain like
 * https://img.chorechamps.com). Photos are short-lived by design — deleted on
 * task approval/rejection/deletion, with a bucket lifecycle rule as a backstop —
 * so a public bucket + non-enumerable keys is an acceptable trade for skipping
 * per-request URL signing. Switch to presigned GET URLs if stricter access
 * control is ever needed (that makes the serializers async).
 *
 * Falls back to a no-op stub when R2 env vars are absent, so local dev without
 * an R2 account still boots — uploads then throw a clear error at call time.
 */

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env;

const isConfigured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_BASE_URL,
);

if (!isConfigured) {
  console.warn('[storage] R2 is not fully configured; photo uploads will fail until it is set.');
}

const client: S3Client | null = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID as string,
        secretAccessKey: R2_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

const PUBLIC_BASE = (R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

/** True for a value we produced (a bare R2 key), false for a legacy '/uploads/x' or absolute URL. */
export function isStorageKey(value: string): boolean {
  return !/^https?:\/\//i.test(value) && !value.startsWith('/uploads/');
}

/** Best-guess content type for a stored key, from its extension. */
export function contentTypeForKey(key: string): string | null {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? null;
}

function requireClient(): S3Client {
  if (!client) {
    throw new Error('R2 storage is not configured (missing R2_* env vars)');
  }
  return client;
}

/**
 * Upload one object under `prefix/` and return its key. `prefix` is a logical
 * folder such as 'submissions' or 'references'.
 */
export async function uploadObject(
  buffer: Buffer,
  contentType: string,
  prefix: string,
): Promise<string> {
  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'bin';
  const key = `${prefix}/${randomUUID()}.${ext}`;
  await requireClient().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return key;
}

/** Download one object's bytes. Used to feed stored reference photos to the AI review. */
export async function downloadObject(key: string): Promise<Buffer> {
  const res = await requireClient().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Delete objects by key. Best-effort: logs and swallows failures so a cleanup
 * problem never rolls back a task state change that already committed. Ignores
 * values that aren't our keys (legacy local filenames, absolute URLs).
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  const realKeys = keys.filter(isStorageKey);
  if (realKeys.length === 0 || !client) {
    return;
  }
  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: { Objects: realKeys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  } catch (err) {
    console.error('[storage] failed to delete objects:', realKeys, err);
  }
}

/** Absolute, browser-loadable URL for a stored key. */
export function publicUrlForKey(key: string): string {
  return `${PUBLIC_BASE}/${key}`;
}
