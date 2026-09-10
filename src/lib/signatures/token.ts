import {
  createHash,
  randomBytes,
} from 'crypto';

export function generateSignatureToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSignatureToken(
  token: string,
) {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}