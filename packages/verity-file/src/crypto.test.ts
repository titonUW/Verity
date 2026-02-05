/**
 * Crypto Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  sha256Hash,
  generateKeyPair,
  loadKeyPair,
  sign,
  verify,
  signData,
  verifyData,
  generateKeyId,
  generateId,
} from './crypto.js';

describe('Crypto Module', () => {
  describe('sha256Hash', () => {
    it('should hash a string correctly', () => {
      const hash = sha256Hash('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should hash a buffer correctly', () => {
      const buffer = Buffer.from('hello world');
      const hash = sha256Hash(buffer);
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should produce 64-character hex string', () => {
      const hash = sha256Hash('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Key Generation', () => {
    it('should generate a valid key pair', async () => {
      const keyPair = await generateKeyPair();

      expect(keyPair.publicKey).toMatch(/^[a-f0-9]{64}$/);
      expect(keyPair.privateKey).toMatch(/^[a-f0-9]{64}$/);
      expect(keyPair.keyId).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should generate different key pairs each time', async () => {
      const key1 = await generateKeyPair();
      const key2 = await generateKeyPair();

      expect(key1.publicKey).not.toBe(key2.publicKey);
      expect(key1.privateKey).not.toBe(key2.privateKey);
    });

    it('should load a key pair from hex strings', async () => {
      const original = await generateKeyPair();
      const loaded = loadKeyPair(original.publicKey, original.privateKey);

      expect(loaded.publicKey).toBe(original.publicKey);
      expect(loaded.privateKey).toBe(original.privateKey);
      expect(loaded.keyId).toBe(original.keyId);
    });
  });

  describe('generateKeyId', () => {
    it('should generate a 16-character key ID', () => {
      const keyId = generateKeyId('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234');
      expect(keyId).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should be deterministic', () => {
      const pubKey = 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234';
      const id1 = generateKeyId(pubKey);
      const id2 = generateKeyId(pubKey);
      expect(id1).toBe(id2);
    });
  });

  describe('Signing and Verification', () => {
    it('should sign and verify a message', async () => {
      const keyPair = await generateKeyPair();
      const messageHash = sha256Hash('test message');

      const signature = await sign(messageHash, keyPair.privateKey);
      expect(signature).toMatch(/^[a-f0-9]{128}$/);

      const isValid = await verify(signature, messageHash, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should fail verification with wrong public key', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      const messageHash = sha256Hash('test message');

      const signature = await sign(messageHash, keyPair1.privateKey);
      const isValid = await verify(signature, messageHash, keyPair2.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong message', async () => {
      const keyPair = await generateKeyPair();
      const messageHash1 = sha256Hash('message 1');
      const messageHash2 = sha256Hash('message 2');

      const signature = await sign(messageHash1, keyPair.privateKey);
      const isValid = await verify(signature, messageHash2, keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should sign and verify data directly', async () => {
      const keyPair = await generateKeyPair();
      const data = 'test data to sign';

      const signature = await signData(data, keyPair.privateKey);
      const isValid = await verifyData(signature, data, keyPair.publicKey);

      expect(isValid).toBe(true);
    });
  });

  describe('generateId', () => {
    it('should generate a UUID-like string', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
