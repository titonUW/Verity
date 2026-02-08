/**
 * Merkle Tree Implementation
 * Certificate Transparency-style Merkle tree for the Verity Log
 *
 * Implements RFC 6962 style Merkle tree with:
 * - Leaf hashing: SHA256(0x00 || data)
 * - Interior node hashing: SHA256(0x01 || left || right)
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// Domain separation prefixes (RFC 6962)
const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);

/**
 * Compute leaf hash for a data item
 * @param data - Raw data bytes or hex string
 * @returns Leaf hash (hex)
 */
export function computeLeafHash(data: Uint8Array | string): string {
  const dataBytes = typeof data === 'string' ? hexToBytes(data) : data;
  const combined = new Uint8Array(LEAF_PREFIX.length + dataBytes.length);
  combined.set(LEAF_PREFIX);
  combined.set(dataBytes, LEAF_PREFIX.length);
  return bytesToHex(sha256(combined));
}

/**
 * Compute interior node hash
 * @param left - Left child hash (hex)
 * @param right - Right child hash (hex)
 * @returns Node hash (hex)
 */
export function computeNodeHash(left: string, right: string): string {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  const combined = new Uint8Array(
    NODE_PREFIX.length + leftBytes.length + rightBytes.length
  );
  combined.set(NODE_PREFIX);
  combined.set(leftBytes, NODE_PREFIX.length);
  combined.set(rightBytes, NODE_PREFIX.length + leftBytes.length);
  return bytesToHex(sha256(combined));
}

/**
 * Compute the Merkle root of a list of leaf hashes
 * @param leafHashes - Array of leaf hashes (hex)
 * @returns Root hash (hex), or empty string if no leaves
 */
export function computeMerkleRoot(leafHashes: string[]): string {
  if (leafHashes.length === 0) {
    // Empty tree has hash of empty string
    return bytesToHex(sha256(new Uint8Array(0)));
  }

  if (leafHashes.length === 1) {
    return leafHashes[0];
  }

  // Build tree bottom-up
  let currentLevel = [...leafHashes];

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        // Pair exists
        nextLevel.push(computeNodeHash(currentLevel[i], currentLevel[i + 1]));
      } else {
        // Odd node - promote directly
        nextLevel.push(currentLevel[i]);
      }
    }

    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Compute Merkle inclusion proof for a leaf
 * @param leafIndex - Index of the leaf (0-based)
 * @param leafHashes - All leaf hashes
 * @returns Array of proof hashes (siblings on path to root)
 */
export function computeInclusionProof(
  leafIndex: number,
  leafHashes: string[]
): string[] {
  if (leafHashes.length === 0 || leafIndex >= leafHashes.length) {
    throw new Error('Invalid leaf index');
  }

  if (leafHashes.length === 1) {
    return []; // Single leaf needs no proof
  }

  const proof: string[] = [];
  let currentLevel = [...leafHashes];
  let index = leafIndex;

  while (currentLevel.length > 1) {
    // Determine sibling
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;

    if (siblingIndex < currentLevel.length) {
      proof.push(currentLevel[siblingIndex]);
    }
    // If no sibling (odd node at end), no hash to add

    // Build next level
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      if (i + 1 < currentLevel.length) {
        nextLevel.push(computeNodeHash(currentLevel[i], currentLevel[i + 1]));
      } else {
        nextLevel.push(currentLevel[i]);
      }
    }

    currentLevel = nextLevel;
    index = Math.floor(index / 2);
  }

  return proof;
}

/**
 * Verify a Merkle inclusion proof
 * @param leafHash - Hash of the leaf
 * @param leafIndex - Index of the leaf
 * @param proofHashes - Proof hashes (siblings)
 * @param treeSize - Total number of leaves
 * @param rootHash - Expected root hash
 * @returns True if proof is valid
 */
export function verifyInclusionProof(
  leafHash: string,
  leafIndex: number,
  proofHashes: string[],
  treeSize: number,
  rootHash: string
): boolean {
  if (treeSize === 0 || leafIndex >= treeSize) {
    return false;
  }

  if (treeSize === 1) {
    return leafHash === rootHash && proofHashes.length === 0;
  }

  let currentHash = leafHash;
  let index = leafIndex;
  let proofIndex = 0;
  let levelSize = treeSize;

  while (levelSize > 1) {
    const isLeftChild = index % 2 === 0;
    const hasRightSibling = isLeftChild && index + 1 < levelSize;
    const hasLeftSibling = !isLeftChild;

    if (hasRightSibling || hasLeftSibling) {
      if (proofIndex >= proofHashes.length) {
        return false;
      }
      const sibling = proofHashes[proofIndex++];

      if (isLeftChild) {
        currentHash = computeNodeHash(currentHash, sibling);
      } else {
        currentHash = computeNodeHash(sibling, currentHash);
      }
    }
    // If no sibling (last node in odd-sized level), current hash promotes

    index = Math.floor(index / 2);
    levelSize = Math.ceil(levelSize / 2);
  }

  return currentHash === rootHash;
}

/**
 * Compute the root at a specific tree size
 * This is useful for computing historical roots
 * @param leafHashes - All leaf hashes (only first treeSize will be used)
 * @param treeSize - Size of tree to compute
 * @returns Root hash
 */
export function computeRootAtSize(leafHashes: string[], treeSize: number): string {
  if (treeSize > leafHashes.length) {
    throw new Error('Tree size exceeds available leaves');
  }
  return computeMerkleRoot(leafHashes.slice(0, treeSize));
}

export { bytesToHex, hexToBytes };
