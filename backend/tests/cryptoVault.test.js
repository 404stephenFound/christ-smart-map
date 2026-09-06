import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt } from '../utils/cryptoVault.js';

describe('CryptoVault AES-256-GCM Token Encryption', () => {
  before(() => {
    process.env.TOKEN_ENCRYPTION_KEY = 'test_secret_key_christ_smart_map_2026';
  });

  test('should successfully encrypt and decrypt a refresh token', () => {
    const rawToken = '1//04abc123DEF_mock_google_refresh_token_xyz987';
    const encrypted = encrypt(rawToken);

    assert.ok(encrypted, 'Encrypted token should not be empty');
    assert.notEqual(encrypted, rawToken, 'Encrypted output must not match raw token');

    // Verify format: iv:ciphertext:authTag
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3, 'Payload must have 3 colon-separated hex components');

    const decrypted = decrypt(encrypted);
    assert.equal(decrypted, rawToken, 'Decrypted token must exactly match raw token');
  });

  test('should return null when encrypting null or empty values', () => {
    assert.equal(encrypt(null), null);
    assert.equal(encrypt(''), null);
    assert.equal(decrypt(null), null);
    assert.equal(decrypt(''), null);
  });

  test('should reject invalid or tampered encrypted payloads', () => {
    assert.throws(() => {
      decrypt('invalid_malformed_payload');
    }, /Invalid encrypted payload format/);

    const validEncrypted = encrypt('sample_token');
    const [iv, cipher] = validEncrypted.split(':');
    // Tamper with the authentication tag
    const tampered = `${iv}:${cipher}:00112233445566778899aabbccddeeff`;

    assert.throws(() => {
      decrypt(tampered);
    }, 'Tampered payload should fail decipher auth tag check');
  });
});
