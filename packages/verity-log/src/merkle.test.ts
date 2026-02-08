/**
 * Merkle Tree Tests
 */

import { describe, it, expect } from 'vitest';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import {
  computeLeafHash,
  computeNodeHash,
  computeMerkleRoot,
  computeInclusionProof,
  verifyInclusionProof,
} from './merkle.js';

// Helper to create test hex hashes (simulating content hashes)
function testHash(input: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

describe('Merkle Tree', () => {
  describe('computeLeafHash', () => {
    it('should compute leaf hash with domain separation', () => {
      const inputHash = testHash('test');
      const hash = computeLeafHash(inputHash);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Same input should produce same output
      const hash2 = computeLeafHash(inputHash);
      expect(hash).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = computeLeafHash(testHash('input1'));
      const hash2 = computeLeafHash(testHash('input2'));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeNodeHash', () => {
    it('should compute interior node hash', () => {
      const left = 'a'.repeat(64);
      const right = 'b'.repeat(64);
      const hash = computeNodeHash(left, right);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be order-dependent', () => {
      const a = 'a'.repeat(64);
      const b = 'b'.repeat(64);
      const hash1 = computeNodeHash(a, b);
      const hash2 = computeNodeHash(b, a);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeMerkleRoot', () => {
    it('should compute root for empty tree', () => {
      const root = computeMerkleRoot([]);
      expect(root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return single leaf as root', () => {
      const leaf = computeLeafHash(testHash('test'));
      const root = computeMerkleRoot([leaf]);
      expect(root).toBe(leaf);
    });

    it('should compute root for two leaves', () => {
      const leaf1 = computeLeafHash(testHash('a'));
      const leaf2 = computeLeafHash(testHash('b'));
      const root = computeMerkleRoot([leaf1, leaf2]);

      const expected = computeNodeHash(leaf1, leaf2);
      expect(root).toBe(expected);
    });

    it('should compute root for power-of-2 leaves', () => {
      const leaves = ['a', 'b', 'c', 'd'].map(x => computeLeafHash(testHash(x)));
      const root = computeMerkleRoot(leaves);

      const n01 = computeNodeHash(leaves[0], leaves[1]);
      const n23 = computeNodeHash(leaves[2], leaves[3]);
      const expected = computeNodeHash(n01, n23);

      expect(root).toBe(expected);
    });

    it('should handle odd number of leaves', () => {
      const leaves = ['a', 'b', 'c'].map(x => computeLeafHash(testHash(x)));
      const root = computeMerkleRoot(leaves);
      expect(root).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Inclusion Proofs', () => {
    it('should create and verify proof for single leaf', () => {
      const leaf = computeLeafHash(testHash('only'));
      const leaves = [leaf];
      const root = computeMerkleRoot(leaves);
      const proof = computeInclusionProof(0, leaves);

      expect(proof).toHaveLength(0);
      expect(verifyInclusionProof(leaf, 0, proof, 1, root)).toBe(true);
    });

    it('should create and verify proof for two leaves', () => {
      const leaves = ['a', 'b'].map(x => computeLeafHash(testHash(x)));
      const root = computeMerkleRoot(leaves);

      // Proof for first leaf
      const proof0 = computeInclusionProof(0, leaves);
      expect(proof0).toHaveLength(1);
      expect(proof0[0]).toBe(leaves[1]); // Sibling
      expect(verifyInclusionProof(leaves[0], 0, proof0, 2, root)).toBe(true);

      // Proof for second leaf
      const proof1 = computeInclusionProof(1, leaves);
      expect(proof1).toHaveLength(1);
      expect(proof1[0]).toBe(leaves[0]); // Sibling
      expect(verifyInclusionProof(leaves[1], 1, proof1, 2, root)).toBe(true);
    });

    it('should create and verify proof for four leaves', () => {
      const leaves = ['a', 'b', 'c', 'd'].map(x => computeLeafHash(testHash(x)));
      const root = computeMerkleRoot(leaves);

      for (let i = 0; i < 4; i++) {
        const proof = computeInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i], i, proof, 4, root)).toBe(true);
      }
    });

    it('should verify proof for larger tree', () => {
      const leaves = Array.from({ length: 10 }, (_, i) => computeLeafHash(testHash(`leaf-${i}`)));
      const root = computeMerkleRoot(leaves);

      for (let i = 0; i < 10; i++) {
        const proof = computeInclusionProof(i, leaves);
        expect(verifyInclusionProof(leaves[i], i, proof, 10, root)).toBe(true);
      }
    });

    it('should reject invalid proof', () => {
      const leaves = ['a', 'b', 'c', 'd'].map(x => computeLeafHash(testHash(x)));
      const root = computeMerkleRoot(leaves);
      const proof = computeInclusionProof(0, leaves);

      // Wrong leaf
      expect(verifyInclusionProof(leaves[1], 0, proof, 4, root)).toBe(false);

      // Wrong index
      expect(verifyInclusionProof(leaves[0], 1, proof, 4, root)).toBe(false);

      // Wrong root
      expect(verifyInclusionProof(leaves[0], 0, proof, 4, '0'.repeat(64))).toBe(false);

      // Tampered proof
      const tamperedProof = [...proof];
      tamperedProof[0] = '0'.repeat(64);
      expect(verifyInclusionProof(leaves[0], 0, tamperedProof, 4, root)).toBe(false);
    });
  });
});
