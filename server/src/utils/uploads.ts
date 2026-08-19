import path from 'path';

/**
 * Root directory for locally stored proof photos.
 * Override with UPLOADS_DIR; defaults to <server>/uploads.
 */
export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads'),
);

/**
 * Resolve a client-supplied photo path to an absolute path inside UPLOADS_DIR.
 *
 * photoUrl arrives in the request body, so it is never trusted as a filesystem
 * path — without this check a child could point submit/approve at any file the
 * server process can read or delete. Returns null when the value escapes
 * UPLOADS_DIR or is otherwise unusable.
 *
 * Accepts both '/uploads/proof.jpg' (as served over HTTP) and a bare
 * 'proof.jpg', plus nested paths under the uploads root.
 */
export function resolveUploadPath(photoUrl: string): string | null {
  const trimmed = photoUrl.trim();
  if (!trimmed) {
    return null;
  }

  const relative = trimmed
    .replace(/^[\\/]?uploads[\\/]/i, '')
    .replace(/^[\\/]+/, '');

  // Reject absolute paths and Windows drive-qualified paths outright: resolve()
  // would ignore UPLOADS_DIR entirely for those.
  if (!relative || path.isAbsolute(relative) || /^[a-zA-Z]:/.test(relative)) {
    return null;
  }

  const resolved = path.resolve(UPLOADS_DIR, relative);
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }

  return resolved;
}
