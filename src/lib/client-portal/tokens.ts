import {
  createHash,
  randomBytes,
} from 'crypto';

export function generateClientPortalToken() {
  return randomBytes(32).toString('base64url');
}

export function hashClientPortalToken(
  token: string,
) {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}