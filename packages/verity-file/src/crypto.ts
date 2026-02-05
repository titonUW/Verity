/**
 * Verity Cryptographic Utilities
 * Ed25519 signing and SHA-256 hashing
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as ed from '@noble/ed25519';
import type { KeyPair, PublicKeyInfo } from './types.js';

// Node.js 20+ has globalThis.crypto built-in, but we ensure it's available
import { webcrypto } from 'crypto';

// Ensure crypto is available for noble/ed25519
if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore - polyfill for older Node.js
  globalThis.crypto = webcrypto as unknown as Crypto;
}

// ============================================================================
// Hashing
// ============================================================================

/**
 * Compute SHA-256 hash of data
 * @param data - Input bytes
 * @returns Hex-encoded hash
 */
export function sha256Hash(data: Uint8Array | Buffer | string): string {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return bytesToHex(sha256(input));
}

/**
 * Compute SHA-256 hash and return raw bytes
 * @param data - Input bytes
 * @returns Raw hash bytes
 */
export function sha256HashBytes(data: Uint8Array | Buffer | string): Uint8Array {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return sha256(input);
}

/**
 * Generate a short key ID from a public key
 * @param publicKey - Public key (hex)
 * @returns First 16 characters of SHA-256(publicKey)
 */
export function generateKeyId(publicKey: string): string {
  const hash = sha256Hash(publicKey);
  return hash.substring(0, 16);
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a new Ed25519 key pair
 * @returns KeyPair with public key, private key, and key ID
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const publicKeyHex = bytesToHex(publicKey);
  const privateKeyHex = bytesToHex(privateKey);
  const keyId = generateKeyId(publicKeyHex);

  return {
    publicKey: publicKeyHex,
    privateKey: privateKeyHex,
    keyId,
  };
}

/**
 * Derive public key info from a key pair
 * @param keyPair - Full key pair
 * @returns Public key info only
 */
export function getPublicKeyInfo(keyPair: KeyPair): PublicKeyInfo {
  return {
    publicKey: keyPair.publicKey,
    keyId: keyPair.keyId,
  };
}

/**
 * Load a key pair from hex-encoded strings
 * @param publicKeyHex - Public key in hex
 * @param privateKeyHex - Private key in hex
 * @returns KeyPair
 */
export function loadKeyPair(publicKeyHex: string, privateKeyHex: string): KeyPair {
  const keyId = generateKeyId(publicKeyHex);
  return {
    publicKey: publicKeyHex,
    privateKey: privateKeyHex,
    keyId,
  };
}

// ============================================================================
// Signing
// ============================================================================

/**
 * Sign a message with an Ed25519 private key
 * @param message - Message to sign (hex-encoded hash or raw bytes)
 * @param privateKey - Private key (hex)
 * @returns Signature (hex)
 */
export async function sign(
  message: string | Uint8Array,
  privateKey: string
): Promise<string> {
  const messageBytes = typeof message === 'string'
    ? hexToBytes(message)
    : message;
  const privateKeyBytes = hexToBytes(privateKey);

  const signature = await ed.signAsync(messageBytes, privateKeyBytes);
  return bytesToHex(signature);
}

/**
 * Sign raw string data (will hash it first)
 * @param data - String data to sign
 * @param privateKey - Private key (hex)
 * @returns Signature (hex)
 */
export async function signData(data: string, privateKey: string): Promise<string> {
  const hash = sha256HashBytes(data);
  return sign(hash, privateKey);
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Verify an Ed25519 signature
 * @param signature - Signature (hex)
 * @param message - Original message (hex-encoded hash or raw bytes)
 * @param publicKey - Public key (hex)
 * @returns True if signature is valid
 */
export async function verify(
  signature: string,
  message: string | Uint8Array,
  publicKey: string
): Promise<boolean> {
  try {
    const signatureBytes = hexToBytes(signature);
    const messageBytes = typeof message === 'string'
      ? hexToBytes(message)
      : message;
    const publicKeyBytes = hexToBytes(publicKey);

    return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Verify a signature over string data (hashed with SHA-256)
 * @param signature - Signature (hex)
 * @param data - Original string data
 * @param publicKey - Public key (hex)
 * @returns True if signature is valid
 */
export async function verifyData(
  signature: string,
  data: string,
  publicKey: string
): Promise<boolean> {
  const hash = sha256HashBytes(data);
  return verify(signature, hash, publicKey);
}

// ============================================================================
// Utility
// ============================================================================

export { bytesToHex, hexToBytes };

/**
 * Generate a random UUID-like identifier
 * @returns Random hex string suitable for IDs
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = bytesToHex(bytes);
  // Format as UUID-like: 8-4-4-4-12
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
