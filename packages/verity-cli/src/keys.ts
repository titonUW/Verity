/**
 * Key Management Utilities
 * Generate, load, and store Ed25519 keys for the CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateKeyPair, loadKeyPair, type KeyPair } from '@verity/file';

export interface KeySet {
  root: KeyPair;
  capture: KeyPair;
  log: KeyPair;
}

/**
 * Load or generate a complete key set
 * @param keyDir - Directory to store keys
 * @returns KeySet
 */
export async function loadOrGenerateKeys(keyDir: string): Promise<KeySet> {
  // Ensure directory exists
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
  }

  const rootKeyPath = path.join(keyDir, 'root.key.json');
  const captureKeyPath = path.join(keyDir, 'capture.key.json');
  const logKeyPath = path.join(keyDir, 'log.key.json');

  // Load or generate each key
  const root = await loadOrGenerateKey(rootKeyPath, 'root');
  const capture = await loadOrGenerateKey(captureKeyPath, 'capture');
  const log = await loadOrGenerateKey(logKeyPath, 'log');

  return { root, capture, log };
}

/**
 * Load or generate a single key
 * @param keyPath - Path to key file
 * @param name - Key name for logging
 * @returns KeyPair
 */
async function loadOrGenerateKey(keyPath: string, name: string): Promise<KeyPair> {
  if (fs.existsSync(keyPath)) {
    const data = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as {
      publicKey: string;
      privateKey: string;
    };
    console.log(`Loaded ${name} key: ${data.publicKey.substring(0, 16)}...`);
    return loadKeyPair(data.publicKey, data.privateKey);
  }

  // Generate new key
  const keyPair = await generateKeyPair();
  fs.writeFileSync(
    keyPath,
    JSON.stringify(
      {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        keyId: keyPair.keyId,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`Generated ${name} key: ${keyPair.publicKey.substring(0, 16)}...`);
  return keyPair;
}

/**
 * Load a single key from file
 * @param keyPath - Path to key file
 * @returns KeyPair or null if not found
 */
export function loadKey(keyPath: string): KeyPair | null {
  if (!fs.existsSync(keyPath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as {
    publicKey: string;
    privateKey: string;
  };
  return loadKeyPair(data.publicKey, data.privateKey);
}

/**
 * Load public key only from file
 * @param keyPath - Path to key file
 * @returns Public key (hex) or null
 */
export function loadPublicKey(keyPath: string): string | null {
  if (!fs.existsSync(keyPath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as {
    publicKey: string;
  };
  return data.publicKey;
}

/**
 * Save a key pair to file
 * @param keyPair - Key pair to save
 * @param keyPath - Path to save to
 */
export function saveKey(keyPair: KeyPair, keyPath: string): void {
  fs.writeFileSync(
    keyPath,
    JSON.stringify(
      {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        keyId: keyPair.keyId,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

/**
 * Load trusted key IDs from a directory
 * @param keyDir - Directory containing key files
 * @returns Set of key IDs
 */
export function loadTrustedKeyIds(keyDir: string): Set<string> {
  const keyIds = new Set<string>();

  if (!fs.existsSync(keyDir)) {
    return keyIds;
  }

  const files = fs.readdirSync(keyDir);
  for (const file of files) {
    if (file.endsWith('.key.json')) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(keyDir, file), 'utf-8')
        ) as { keyId: string };
        if (data.keyId) {
          keyIds.add(data.keyId);
        }
      } catch {
        // Skip invalid files
      }
    }
  }

  return keyIds;
}
