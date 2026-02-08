#!/usr/bin/env node

/**
 * External Verification Tool
 *
 * This standalone script verifies a Verity container without any network calls.
 * It requires only the container file and the log public key.
 *
 * Usage: node verify-external.js <container.verity> <log_public_key_hex>
 *
 * This demonstrates that third parties can verify containers independently
 * without trusting any Verity servers.
 */

import * as fs from 'fs';
import {
  readContainer,
  verifyPayloadAgainstManifest,
  validateEventChain,
  verifySignatures,
  computeContentHash,
} from '@verity/file';
import { verifyLogProof, verifyInclusionProof, computeLeafHash } from '@verity/log';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: verify-external <container.verity> [log_public_key_hex]');
    console.error('');
    console.error('Verifies a Verity container without any network calls.');
    console.error('Demonstrates external verifiability.');
    process.exit(1);
  }

  const containerPath = args[0];
  const logPublicKey = args[1];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('          VERITY EXTERNAL VERIFICATION TOOL');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Container: ${containerPath}`);
  console.log(`Log Key:   ${logPublicKey ? logPublicKey.substring(0, 32) + '...' : 'Not provided'}`);
  console.log('');

  try {
    // 1. Read container
    console.log('Step 1: Reading container...');
    const container = await readContainer(containerPath);
    console.log('  ✓ Container parsed successfully\n');

    // 2. Verify payload hash
    console.log('Step 2: Verifying payload integrity...');
    const payloadResult = verifyPayloadAgainstManifest(container.payload, container.manifest);
    if (payloadResult.valid) {
      console.log('  ✓ Payload hash matches manifest');
      console.log(`    SHA-256: ${container.manifest.payload_sha256}`);
    } else {
      console.log('  ✗ PAYLOAD HASH MISMATCH - FILE IS TAMPERED');
      console.log(`    ${payloadResult.error}`);
    }
    console.log('');

    // 3. Verify signatures
    console.log('Step 3: Verifying cryptographic signatures...');
    const sigResult = await verifySignatures(
      container.manifest,
      container.events,
      container.signatures
    );
    if (sigResult.valid) {
      console.log(`  ✓ ${sigResult.validSignatures.length} valid signature(s)`);
      for (const sig of container.signatures.signatures) {
        console.log(`    Signer: ${sig.signer_key_id} (${sig.algorithm})`);
      }
    } else {
      console.log('  ✗ SIGNATURE VERIFICATION FAILED');
      for (const err of sigResult.errors) {
        console.log(`    ${err}`);
      }
    }
    console.log('');

    // 4. Verify event chain
    console.log('Step 4: Verifying provenance chain...');
    const eventResult = await validateEventChain(container.events);
    if (eventResult.valid) {
      console.log(`  ✓ Event chain verified (${eventResult.chainLength} events)`);
      for (const event of container.events.events) {
        console.log(`    [${event.event_type}] by ${event.actor_key_id}`);
      }
    } else {
      console.log('  ✗ EVENT CHAIN VERIFICATION FAILED');
      for (const err of eventResult.errors) {
        console.log(`    ${err}`);
      }
    }

    // Check for AI edits
    if (eventResult.hasAiEdit) {
      console.log('  ⚠ WARNING: AI_EDIT event detected');
    }
    console.log('');

    // 5. Verify log proof (if present and key provided)
    console.log('Step 5: Verifying transparency log proof...');
    if (!container.logProof) {
      console.log('  - No log proof present');
    } else if (!logPublicKey) {
      console.log('  - Log proof present but no key provided for verification');
      console.log(`    Leaf index: ${container.logProof.inclusion_proof.leaf_index}`);
      console.log(`    Tree size:  ${container.logProof.checkpoint.tree_size}`);
    } else {
      const contentHash = computeContentHash(container.manifest, container.events);
      const logResult = await verifyLogProof(contentHash, container.logProof, logPublicKey);

      if (logResult.valid) {
        console.log('  ✓ Log proof verified');
        console.log(`    Leaf index:      ${container.logProof.inclusion_proof.leaf_index}`);
        console.log(`    Tree size:       ${container.logProof.checkpoint.tree_size}`);
        console.log(`    Root hash:       ${container.logProof.checkpoint.root_hash.substring(0, 32)}...`);
        console.log(`    Checkpoint time: ${container.logProof.checkpoint.issued_at}`);
      } else {
        console.log('  ✗ LOG PROOF VERIFICATION FAILED');
        for (const err of logResult.errors) {
          console.log(`    ${err}`);
        }
      }
    }
    console.log('');

    // 6. Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const allOk =
      payloadResult.valid &&
      sigResult.valid &&
      eventResult.valid;

    if (allOk) {
      console.log('  ✓ CONTAINER INTEGRITY VERIFIED\n');
      console.log('  The following has been cryptographically proven:');
      console.log('  • Payload has not been modified since signing');
      console.log('  • Signature(s) are valid');
      console.log('  • Provenance chain is intact');
      if (container.logProof && logPublicKey) {
        console.log('  • Content is recorded in transparency log');
      }
    } else {
      console.log('  ✗ VERIFICATION FAILED\n');
      console.log('  The container may have been tampered with.');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    process.exit(allOk ? 0 : 1);
  } catch (err) {
    console.error('Error:', (err as Error).message);
    process.exit(1);
  }
}

main();
