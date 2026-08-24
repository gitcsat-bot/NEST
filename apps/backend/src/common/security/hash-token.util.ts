import { createHash, randomBytes } from 'crypto';

// TDS §12.1: the value stored server-side is a SHA-256 hash of the
// client-side token, so a read-only DB leak alone does not yield usable
// session/reset tokens. Used identically for session ids and password
// reset tokens (Database Design §4.2, §4.4).
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
