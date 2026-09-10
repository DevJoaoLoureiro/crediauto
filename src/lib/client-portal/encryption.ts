import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

function getKey() {
  const raw =
    process.env.PORTAL_TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      'PORTAL_TOKEN_ENCRYPTION_KEY não definida.',
    );
  }

  const key =
    Buffer.from(raw, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'PORTAL_TOKEN_ENCRYPTION_KEY deve ter 32 bytes.',
    );
  }

  return key;
}

export function encryptPortalToken(
  token: string,
) {
  const key = getKey();
  const iv = randomBytes(12);

  const cipher =
    createCipheriv(
      'aes-256-gcm',
      key,
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        token,
        'utf8',
      ),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString(
      'base64url',
    ),
  ].join('.');
}

export function decryptPortalToken(
  value: string,
) {
  const [
    version,
    ivEncoded,
    tagEncoded,
    dataEncoded,
  ] = value.split('.');

  if (
    version !== 'v1' ||
    !ivEncoded ||
    !tagEncoded ||
    !dataEncoded
  ) {
    throw new Error(
      'Token cifrado inválido.',
    );
  }

  const key = getKey();

  const decipher =
    createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(
        ivEncoded,
        'base64url',
      ),
    );

  decipher.setAuthTag(
    Buffer.from(
      tagEncoded,
      'base64url',
    ),
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          dataEncoded,
          'base64url',
        ),
      ),
      decipher.final(),
    ]);

  return decrypted.toString(
    'utf8',
  );
}