#!/usr/bin/env node

/**
 * Verity Demo Script
 *
 * This script demonstrates the complete Verity workflow:
 * 1. Generate/load keys
 * 2. Wrap a file into a Verity container
 * 3. Add CAPTURE event and sign
 * 4. Start local log server
 * 5. Publish to transparency log
 * 6. Generate Trust Report
 * 7. Evaluate workflow policy
 * 8. Demonstrate external verification
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Import from built packages
const {
  wrapFile,
  readContainer,
  updateContainer,
  verifyContainerFile,
  computeContentHash,
  generateKeyPair,
  loadKeyPair,
  hashContainer
} = await import('@verity/file');

const {
  VerityLogService,
  InMemoryLogStore,
  createLogServer,
  verifyLogProof
} = await import('@verity/log');

const {
  createVerifyEngine
} = await import('@verity/verify');

// Color helpers for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function header(msg) {
  console.log('\n' + '═'.repeat(60));
  log(msg, colors.bright + colors.cyan);
  console.log('═'.repeat(60));
}

function success(msg) {
  log(`✓ ${msg}`, colors.green);
}

function info(msg) {
  log(`  ${msg}`, colors.reset);
}

function warn(msg) {
  log(`⚠ ${msg}`, colors.yellow);
}

// ============================================================================
// Key Management
// ============================================================================

const KEY_DIR = path.join(ROOT_DIR, 'devkeys');

async function loadOrGenerateKey(name) {
  const keyPath = path.join(KEY_DIR, `${name}.key.json`);

  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }

  if (fs.existsSync(keyPath)) {
    const data = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    return loadKeyPair(data.publicKey, data.privateKey);
  }

  const keyPair = await generateKeyPair();
  fs.writeFileSync(keyPath, JSON.stringify({
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    keyId: keyPair.keyId,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  return keyPair;
}

// ============================================================================
// Main Demo
// ============================================================================

async function main() {
  console.log(`
  ${colors.cyan}${colors.bright}
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   ██╗   ██╗███████╗██████╗ ██╗████████╗██╗   ██╗              ║
  ║   ██║   ██║██╔════╝██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝              ║
  ║   ██║   ██║█████╗  ██████╔╝██║   ██║    ╚████╔╝               ║
  ║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗██║   ██║     ╚██╔╝                ║
  ║    ╚████╔╝ ███████╗██║  ██║██║   ██║      ██║                 ║
  ║     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝                 ║
  ║                                                               ║
  ║         Trust Infrastructure for Digital Content              ║
  ╚═══════════════════════════════════════════════════════════════╝
  ${colors.reset}
  `);

  // -------------------------------------------------------------------------
  // Step 1: Generate/Load Keys
  // -------------------------------------------------------------------------
  header('STEP 1: Key Generation');

  log('Loading or generating development keys...', colors.blue);
  const rootKey = await loadOrGenerateKey('root');
  const captureKey = await loadOrGenerateKey('capture');
  const logKey = await loadOrGenerateKey('log');

  success('Root key loaded');
  info(`  ID: ${rootKey.keyId}`);
  info(`  Public: ${rootKey.publicKey.substring(0, 32)}...`);

  success('Capture device key loaded');
  info(`  ID: ${captureKey.keyId}`);

  success('Log key loaded');
  info(`  ID: ${logKey.keyId}`);

  // -------------------------------------------------------------------------
  // Step 2: Wrap a File
  // -------------------------------------------------------------------------
  header('STEP 2: Create Verity Container');

  const sampleFile = path.join(ROOT_DIR, 'samples', 'sample-document.txt');
  const containerPath = path.join(ROOT_DIR, 'samples', 'sample-document.txt.verity');

  log(`Wrapping file: ${sampleFile}`, colors.blue);

  await wrapFile(sampleFile, containerPath, captureKey, rootKey, {
    workflowHint: 'vendor-bank-change',
    metadata: { source: 'demo-script' },
  });

  success(`Container created: ${containerPath}`);

  // Read and display container info
  const container = await readContainer(containerPath);
  info(`  Payload: ${container.manifest.payload_size} bytes`);
  info(`  MIME: ${container.manifest.payload_mime}`);
  info(`  Hash: ${container.manifest.payload_sha256.substring(0, 32)}...`);
  info(`  Events: ${container.events.events.length} (${container.events.events.map(e => e.event_type).join(', ')})`);
  info(`  Signatures: ${container.signatures.signatures.length}`);

  // -------------------------------------------------------------------------
  // Step 3: Verify Container
  // -------------------------------------------------------------------------
  header('STEP 3: Verify Container Integrity');

  log('Running cryptographic verification...', colors.blue);

  const verifyResult = await verifyContainerFile(containerPath);

  if (verifyResult.valid) {
    success('Container integrity verified!');
  } else {
    warn('Container verification failed!');
  }

  info(`  Payload hash: ${verifyResult.integrity.payload_hash_ok ? '✓' : '✗'}`);
  info(`  Signatures: ${verifyResult.integrity.manifest_signature_ok ? '✓' : '✗'}`);
  info(`  Event chain: ${verifyResult.integrity.event_chain_ok ? '✓' : '✗'}`);
  info(`  Log proof: ${verifyResult.integrity.transparency_log_ok === null ? 'N/A' : verifyResult.integrity.transparency_log_ok ? '✓' : '✗'}`);

  // -------------------------------------------------------------------------
  // Step 4: Start Local Log Server
  // -------------------------------------------------------------------------
  header('STEP 4: Transparency Log');

  log('Starting in-memory transparency log...', colors.blue);

  const logStore = new InMemoryLogStore();
  const logService = new VerityLogService(logStore, {
    privateKey: logKey.privateKey,
    publicKey: logKey.publicKey,
    keyId: logKey.keyId,
  });

  success('Log service initialized');

  // Publish to log
  log('Publishing container to transparency log...', colors.blue);

  const contentHash = computeContentHash(container.manifest, container.events);
  const { leafIndex, leafHash, checkpoint } = await logService.addLeaf(contentHash);

  success(`Published to log!`);
  info(`  Leaf index: ${leafIndex}`);
  info(`  Leaf hash: ${leafHash.substring(0, 32)}...`);
  info(`  Tree size: ${checkpoint.tree_size}`);
  info(`  Root hash: ${checkpoint.root_hash.substring(0, 32)}...`);

  // Get and store log proof
  log('Generating inclusion proof...', colors.blue);
  const logProof = await logService.generateLogProof(leafIndex);

  // Update container with log proof
  await updateContainer(containerPath, { logProof });
  success('Log proof embedded in container');

  // -------------------------------------------------------------------------
  // Step 5: Verify Log Proof
  // -------------------------------------------------------------------------
  header('STEP 5: Verify Log Proof (Offline)');

  log('Verifying inclusion proof without network...', colors.blue);

  const updatedContainer = await readContainer(containerPath);
  const logVerifyResult = await verifyLogProof(
    contentHash,
    updatedContainer.logProof,
    logKey.publicKey
  );

  if (logVerifyResult.valid) {
    success('Log proof verified offline!');
    info('  This proves the content was recorded in the transparency log');
    info('  Third parties can verify this without trusting Verity servers');
  } else {
    warn('Log proof verification failed!');
    for (const err of logVerifyResult.errors) {
      info(`  Error: ${err}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Generate Trust Report
  // -------------------------------------------------------------------------
  header('STEP 6: Generate Trust Report');

  log('Creating verify engine...', colors.blue);

  const engine = createVerifyEngine({
    trustedCaptureKeyIds: new Set([captureKey.keyId]),
    logPublicKey: logKey.publicKey,
  });

  // Load policies
  const policyDir = path.join(ROOT_DIR, 'policies');
  if (fs.existsSync(policyDir)) {
    engine.loadPolicies(policyDir);
    success('Loaded workflow policies');
  }

  log('Generating Trust Report...', colors.blue);

  const trustReport = await engine.verify(updatedContainer, {
    workflow: 'vendor-bank-change',
  });

  success('Trust Report generated!');
  console.log('');

  // Display report
  const originColor = trustReport.human_origin_proof.value === 'YES' ? colors.green :
                      trustReport.human_origin_proof.value === 'NO' ? colors.red : colors.yellow;

  log(`  ${colors.bright}Human-Origin Proof:${colors.reset} ${originColor}${trustReport.human_origin_proof.value}${colors.reset}`);
  info(`    ${trustReport.human_origin_proof.reason}`);

  const scoreColor = trustReport.reality_confidence.score >= 70 ? colors.green :
                     trustReport.reality_confidence.score >= 50 ? colors.yellow : colors.red;

  log(`  ${colors.bright}Reality Confidence:${colors.reset} ${scoreColor}${trustReport.reality_confidence.score}/100${colors.reset}`);

  // Show top signals
  const topSignals = [...trustReport.reality_confidence.reasons]
    .sort((a, b) => Math.abs(b.score_delta) - Math.abs(a.score_delta))
    .slice(0, 5);

  for (const signal of topSignals) {
    const delta = signal.score_delta >= 0 ? colors.green + '+' + signal.score_delta : colors.red + signal.score_delta;
    info(`    ${delta}${colors.reset} ${signal.name}: ${signal.explanation}`);
  }

  const decisionColor = trustReport.context_decision.decision === 'ALLOW' ? colors.green :
                        trustReport.context_decision.decision === 'WARN' ? colors.yellow :
                        trustReport.context_decision.decision === 'REQUIRE_EXTRA_VERIFICATION' ? colors.magenta :
                        colors.red;

  log(`  ${colors.bright}Context Decision:${colors.reset} ${decisionColor}${trustReport.context_decision.decision}${colors.reset}`);
  info(`    Workflow: ${trustReport.context_decision.workflow}`);
  info(`    Rationale: ${trustReport.context_decision.rationale}`);

  // Save report to container
  await updateContainer(containerPath, { trustReport });
  success('Trust Report embedded in container');

  // -------------------------------------------------------------------------
  // Step 7: Demonstrate Tamper Detection
  // -------------------------------------------------------------------------
  header('STEP 7: Tamper Detection Demo');

  log('Creating a tampered copy of the container...', colors.blue);

  const tamperedPath = path.join(ROOT_DIR, 'samples', 'tampered.verity');

  // Read original, modify payload, write back (this creates invalid container)
  const originalContainer = await readContainer(containerPath);

  // Modify payload
  const tamperedPayload = Buffer.from(originalContainer.payload.toString() + '\n[TAMPERED CONTENT]');

  // Write tampered container manually (bypassing normal write which would rehash)
  const archiver = (await import('archiver')).default;
  const output = fs.createWriteStream(tamperedPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);

  const { canonicalize } = await import('@verity/file');
  archive.append(tamperedPayload, { name: 'payload.bin' });
  archive.append(canonicalize(originalContainer.manifest), { name: 'manifest.json' });
  archive.append(canonicalize(originalContainer.events), { name: 'events.json' });
  archive.append(canonicalize(originalContainer.signatures), { name: 'signatures.json' });
  if (originalContainer.logProof) {
    archive.append(canonicalize(originalContainer.logProof), { name: 'log_proof.json' });
  }

  await new Promise(resolve => {
    output.on('close', resolve);
    archive.finalize();
  });

  success('Created tampered container');

  log('Verifying tampered container...', colors.blue);

  const tamperedResult = await verifyContainerFile(tamperedPath);

  if (!tamperedResult.valid) {
    success('TAMPER DETECTED!');
    info(`  Payload hash: ${tamperedResult.integrity.payload_hash_ok ? '✓' : '✗ MISMATCH'}`);
    info(`  Signatures: ${tamperedResult.integrity.manifest_signature_ok ? '✓' : '✗'}`);
    for (const err of tamperedResult.errors) {
      info(`  ${colors.red}Error: ${err}${colors.reset}`);
    }
  } else {
    warn('Tamper detection failed!');
  }

  // Clean up tampered file
  fs.unlinkSync(tamperedPath);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  header('DEMO COMPLETE');

  console.log(`
  ${colors.green}The Verity proof-of-concept has demonstrated:${colors.reset}

  1. ${colors.bright}Cryptographic wrapping${colors.reset} - Files are wrapped with SHA-256 hashes
     and Ed25519 signatures in a tamper-evident container.

  2. ${colors.bright}Provenance tracking${colors.reset} - Events form a hash chain documenting
     the content's chain of custody from capture to publication.

  3. ${colors.bright}Transparency logging${colors.reset} - Content hashes are recorded in a
     Certificate Transparency-style Merkle log with signed checkpoints.

  4. ${colors.bright}External verifiability${colors.reset} - Third parties can verify
     containers offline using only the log public key.

  5. ${colors.bright}Trust Reports${colors.reset} - The verification engine produces
     comprehensive reports with human-origin proof, confidence scores,
     and policy-based decisions.

  6. ${colors.bright}Tamper detection${colors.reset} - Any modification to the payload
     is immediately detected through cryptographic verification.

  ${colors.cyan}Container location: ${containerPath}${colors.reset}

  To explore further:

    # View container info
    npx verity info ${containerPath}

    # Generate a fresh report
    npx verity report ${containerPath}

    # Evaluate against a different workflow
    npx verity policy-eval ${containerPath} wire-transfer

    # External verification (standalone)
    node packages/verity-cli/dist/verify-external.js ${containerPath} ${logKey.publicKey}
  `);
}

// Run the demo
main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
