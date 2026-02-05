/**
 * Verity Log Service
 * Core log operations with Merkle tree and signed checkpoints
 */

import { sign, verify } from '@verity/file';
import { computeMerkleRoot, computeInclusionProof, computeLeafHash } from './merkle.js';
import type {
  LogStore,
  LogEntry,
  LogCheckpoint,
  LogInclusionProof,
  VerityLogProof,
} from './types.js';

export interface LogServiceConfig {
  /** Private key for signing checkpoints (hex) */
  privateKey: string;
  /** Public key (hex) */
  publicKey: string;
  /** Key ID */
  keyId: string;
}

/**
 * Main Verity Log service
 */
export class VerityLogService {
  private store: LogStore;
  private config: LogServiceConfig;

  constructor(store: LogStore, config: LogServiceConfig) {
    this.store = store;
    this.config = config;
  }

  /**
   * Add a leaf to the log
   * @param contentHash - Hash of the content to log
   * @returns Index of the added leaf
   */
  async addLeaf(contentHash: string): Promise<{
    leafIndex: number;
    leafHash: string;
    checkpoint: LogCheckpoint;
  }> {
    // Compute leaf hash using RFC 6962 domain separation
    const leafHash = computeLeafHash(contentHash);

    // Add to store
    const leafIndex = await this.store.addLeaf(leafHash, contentHash);

    // Generate new checkpoint
    const checkpoint = await this.getCheckpoint();

    return {
      leafIndex,
      leafHash,
      checkpoint,
    };
  }

  /**
   * Get the current signed checkpoint
   * @returns Signed checkpoint
   */
  async getCheckpoint(): Promise<LogCheckpoint> {
    const treeSize = await this.store.getTreeSize();
    const leafHashes = await this.store.getAllLeafHashes();
    const rootHash = computeMerkleRoot(leafHashes);
    const issuedAt = new Date().toISOString();

    // Create checkpoint data to sign
    const checkpointData = `${treeSize}|${rootHash}|${issuedAt}`;

    // Sign the checkpoint
    const signature = await sign(
      new TextEncoder().encode(checkpointData),
      this.config.privateKey
    );

    return {
      tree_size: treeSize,
      root_hash: rootHash,
      issued_at: issuedAt,
      signature,
      log_pubkey: this.config.publicKey,
      log_key_id: this.config.keyId,
    };
  }

  /**
   * Get inclusion proof for a leaf
   * @param leafIndex - Index of the leaf
   * @returns Inclusion proof and current checkpoint
   */
  async getInclusionProof(leafIndex: number): Promise<{
    inclusionProof: LogInclusionProof;
    checkpoint: LogCheckpoint;
  }> {
    const entry = await this.store.getEntry(leafIndex);
    if (!entry) {
      throw new Error(`Leaf at index ${leafIndex} not found`);
    }

    const leafHashes = await this.store.getAllLeafHashes();
    const proofHashes = computeInclusionProof(leafIndex, leafHashes);
    const treeSize = leafHashes.length;

    const inclusionProof: LogInclusionProof = {
      leaf_index: leafIndex,
      leaf_hash: entry.leaf_hash,
      proof_hashes: proofHashes,
      tree_size: treeSize,
    };

    const checkpoint = await this.getCheckpoint();

    return { inclusionProof, checkpoint };
  }

  /**
   * Get a log entry by index
   * @param index - Entry index
   * @returns Log entry or null
   */
  async getEntry(index: number): Promise<LogEntry | null> {
    return this.store.getEntry(index);
  }

  /**
   * Get the current tree size
   * @returns Number of leaves in the log
   */
  async getTreeSize(): Promise<number> {
    return this.store.getTreeSize();
  }

  /**
   * Generate a complete VerityLogProof for a container
   * @param leafIndex - Index of the leaf
   * @param logUrl - Optional log URL for reference
   * @returns Complete log proof for embedding in container
   */
  async generateLogProof(leafIndex: number, logUrl?: string): Promise<VerityLogProof> {
    const { inclusionProof, checkpoint } = await this.getInclusionProof(leafIndex);

    return {
      obtained_at: new Date().toISOString(),
      log_url: logUrl,
      checkpoint,
      inclusion_proof: inclusionProof,
    };
  }

  /**
   * Close the underlying store
   */
  async close(): Promise<void> {
    await this.store.close();
  }
}

/**
 * Verify a checkpoint signature
 * @param checkpoint - Checkpoint to verify
 * @returns True if valid
 */
export async function verifyCheckpoint(checkpoint: LogCheckpoint): Promise<boolean> {
  const checkpointData = `${checkpoint.tree_size}|${checkpoint.root_hash}|${checkpoint.issued_at}`;
  return verify(
    checkpoint.signature,
    new TextEncoder().encode(checkpointData),
    checkpoint.log_pubkey
  );
}

/**
 * Verify a complete log proof (offline verification)
 * @param contentHash - Hash of the content that was logged
 * @param proof - The log proof to verify
 * @param logPublicKey - Log's public key (for checkpoint verification)
 * @returns Verification result
 */
export async function verifyLogProof(
  contentHash: string,
  proof: VerityLogProof,
  logPublicKey: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Verify checkpoint signature
  if (proof.checkpoint.log_pubkey !== logPublicKey) {
    errors.push('Checkpoint signed by different key than expected');
  }

  const checkpointValid = await verifyCheckpoint(proof.checkpoint);
  if (!checkpointValid) {
    errors.push('Checkpoint signature is invalid');
    return { valid: false, errors };
  }

  // 2. Verify leaf hash matches content
  const expectedLeafHash = computeLeafHash(contentHash);
  if (proof.inclusion_proof.leaf_hash !== expectedLeafHash) {
    errors.push('Leaf hash does not match content hash');
  }

  // 3. Verify inclusion proof
  const { verifyInclusionProof: verifyProof } = await import('./merkle.js');
  const proofValid = verifyProof(
    proof.inclusion_proof.leaf_hash,
    proof.inclusion_proof.leaf_index,
    proof.inclusion_proof.proof_hashes,
    proof.checkpoint.tree_size,
    proof.checkpoint.root_hash
  );

  if (!proofValid) {
    errors.push('Merkle inclusion proof is invalid');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
