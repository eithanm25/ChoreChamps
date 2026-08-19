import { createHmac } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'chorechamps-dev-secret-change-in-production';

export interface AuthTokenPayload {
  userId: string;
  role: string;
  familyId: string | null;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

/**
 * Minimal HMAC-signed token (JWT-shaped) without external jsonwebtoken dependency.
 */
export function signToken(payload: AuthTokenPayload): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
    }),
  );
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expectedSignature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as AuthTokenPayload & { iat?: number };
    if (!parsed.userId || !parsed.role) {
      return null;
    }
    return {
      userId: parsed.userId,
      role: parsed.role,
      familyId: parsed.familyId ?? null,
    };
  } catch {
    return null;
  }
}
