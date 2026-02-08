/**
 * Log Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPair, sha256Hash } from '@verity/file';
import { VerityLogService, verifyCheckpoint, verifyLogProof } from './log.js';
import { InMemoryLogStore } from './store.js';

// Helper to create valid 64-char hex hashes
function makeHash(input: string): string {
  return sha256Hash(input);
}

describe('Verity Log Service', () => {
  let logService: VerityLogService;
  let logKey: Awaited<ReturnType<typeof generateKeyPair>>;

  beforeEach(async () => {
    logKey = await generateKeyPair();
    const store = new InMemoryLogStore();
    logService = new VerityLogService(store, {
      privateKey: logKey.privateKey,
      publicKey: logKey.publicKey,
      keyId: logKey.keyId,
    });
  });

  describe('addLeaf', () => {
    it('should add a leaf and return checkpoint', async () => {
      const contentHash = makeHash('test-content-a');
      const result = await logService.addLeaf(contentHash);

      expect(result.leafIndex).toBe(0);
      expect(result.leafHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.checkpoint.tree_size).toBe(1);
      expect(result.checkpoint.log_pubkey).toBe(logKey.publicKey);
    });

    it('should increment leaf index', async () => {
      const result1 = await logService.addLeaf(makeHash('content-a'));
      const result2 = await logService.addLeaf(makeHash('content-b'));
      const result3 = await logService.addLeaf(makeHash('content-c'));

      expect(result1.leafIndex).toBe(0);
      expect(result2.leafIndex).toBe(1);
      expect(result3.leafIndex).toBe(2);
      expect(result3.checkpoint.tree_size).toBe(3);
    });
  });

  describe('getCheckpoint', () => {
    it('should return signed checkpoint', async () => {
      await logService.addLeaf(makeHash('test-content'));
      const checkpoint = await logService.getCheckpoint();

      expect(checkpoint.tree_size).toBe(1);
      expect(checkpoint.root_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(checkpoint.signature).toMatch(/^[a-f0-9]{128}$/);
      expect(checkpoint.log_pubkey).toBe(logKey.publicKey);
    });
  });

  describe('verifyCheckpoint', () => {
    it('should verify a valid checkpoint', async () => {
      await logService.addLeaf(makeHash('test-content'));
      const checkpoint = await logService.getCheckpoint();

      const isValid = await verifyCheckpoint(checkpoint);
      expect(isValid).toBe(true);
    });

    it('should reject tampered checkpoint', async () => {
      await logService.addLeaf(makeHash('test-content'));
      const checkpoint = await logService.getCheckpoint();

      // Tamper with tree size
      const tampered = { ...checkpoint, tree_size: 999 };
      const isValid = await verifyCheckpoint(tampered);
      expect(isValid).toBe(false);
    });
  });

  describe('getInclusionProof', () => {
    it('should return valid inclusion proof', async () => {
      await logService.addLeaf(makeHash('content-a'));
      await logService.addLeaf(makeHash('content-b'));
      await logService.addLeaf(makeHash('content-c'));

      const { inclusionProof, checkpoint } = await logService.getInclusionProof(1);

      expect(inclusionProof.leaf_index).toBe(1);
      expect(inclusionProof.tree_size).toBe(3);
      expect(inclusionProof.proof_hashes.length).toBeGreaterThan(0);
    });

    it('should throw for non-existent leaf', async () => {
      await expect(logService.getInclusionProof(99)).rejects.toThrow('not found');
    });
  });

  describe('generateLogProof', () => {
    it('should generate complete log proof', async () => {
      const contentHash = makeHash('my-content-to-log');
      const { leafIndex } = await logService.addLeaf(contentHash);
      const proof = await logService.generateLogProof(leafIndex, 'http://localhost:3001');

      expect(proof.obtained_at).toBeDefined();
      expect(proof.log_url).toBe('http://localhost:3001');
      expect(proof.checkpoint).toBeDefined();
      expect(proof.inclusion_proof).toBeDefined();
    });
  });

  describe('verifyLogProof', () => {
    it('should verify a valid log proof', async () => {
      const contentHash = makeHash('valid-content');
      const { leafIndex } = await logService.addLeaf(contentHash);
      const proof = await logService.generateLogProof(leafIndex);

      const result = await verifyLogProof(contentHash, proof, logKey.publicKey);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject proof with wrong content hash', async () => {
      const contentHash = makeHash('original-content');
      const { leafIndex } = await logService.addLeaf(contentHash);
      const proof = await logService.generateLogProof(leafIndex);

      const wrongHash = makeHash('different-content');
      const result = await verifyLogProof(wrongHash, proof, logKey.publicKey);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Leaf hash'))).toBe(true);
    });

    it('should reject proof with wrong log key', async () => {
      const contentHash = makeHash('test-content');
      const { leafIndex } = await logService.addLeaf(contentHash);
      const proof = await logService.generateLogProof(leafIndex);

      const wrongKey = await generateKeyPair();
      const result = await verifyLogProof(contentHash, proof, wrongKey.publicKey);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('different key'))).toBe(true);
    });
  });
});
