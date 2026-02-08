#!/usr/bin/env node

/**
 * Verity CLI
 * Command-line interface for the Verity trust infrastructure
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import {
  wrapFile,
  readContainer,
  verifyContainerFile,
  updateContainer,
  hashContainer,
  computeContentHash,
  type VerityContainer,
  type TrustReport,
} from '@verity/file';
import {
  VerityLogClient,
  VerityLogService,
  InMemoryLogStore,
  verifyLogProof,
} from '@verity/log';
import { VerityVerifyEngine, createVerifyEngine } from '@verity/verify';
import { loadOrGenerateKeys, loadKey, loadPublicKey, loadTrustedKeyIds } from './keys.js';

const program = new Command();

// Default paths
const DEFAULT_KEY_DIR = './devkeys';
const DEFAULT_POLICY_DIR = './policies';

program
  .name('verity')
  .description('Verity - Trust infrastructure for digital content')
  .version('0.1.0');

// ============================================================================
// Key Generation Command
// ============================================================================

program
  .command('keygen')
  .description('Generate or load development keys')
  .option('-d, --dir <path>', 'Key directory', DEFAULT_KEY_DIR)
  .action(async (options) => {
    const spinner = ora('Loading/generating keys...').start();
    try {
      const keys = await loadOrGenerateKeys(options.dir);
      spinner.succeed('Keys ready');
      console.log('\nKey Information:');
      console.log(`  Root:    ${keys.root.keyId} (${keys.root.publicKey.substring(0, 32)}...)`);
      console.log(`  Capture: ${keys.capture.keyId} (${keys.capture.publicKey.substring(0, 32)}...)`);
      console.log(`  Log:     ${keys.log.keyId} (${keys.log.publicKey.substring(0, 32)}...)`);
    } catch (err) {
      spinner.fail('Failed to generate keys');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Wrap Command
// ============================================================================

program
  .command('wrap')
  .description('Wrap a file into a Verity container')
  .argument('<input>', 'Input file path')
  .option('-o, --output <path>', 'Output path (default: <input>.verity)')
  .option('-k, --keydir <path>', 'Key directory', DEFAULT_KEY_DIR)
  .option('-w, --workflow <name>', 'Workflow hint')
  .action(async (input, options) => {
    const spinner = ora('Wrapping file...').start();
    try {
      // Load keys
      const keys = await loadOrGenerateKeys(options.keydir);

      // Wrap the file
      const output = options.output || `${input}.verity`;
      await wrapFile(input, output, keys.capture, keys.root, {
        workflowHint: options.workflow,
      });

      spinner.succeed(`Created: ${output}`);

      // Show container info
      const container = await readContainer(output);
      console.log('\nContainer Info:');
      console.log(`  Payload:  ${container.manifest.payload_size} bytes (${container.manifest.payload_mime})`);
      console.log(`  Hash:     ${container.manifest.payload_sha256.substring(0, 32)}...`);
      console.log(`  Created:  ${container.manifest.created_at}`);
      console.log(`  Events:   ${container.events.events.length}`);
      console.log(`  Signatures: ${container.signatures.signatures.length}`);
    } catch (err) {
      spinner.fail('Failed to wrap file');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Verify Command
// ============================================================================

program
  .command('verify')
  .description('Verify a Verity container')
  .argument('<container>', 'Path to .verity file')
  .option('-k, --keydir <path>', 'Key directory for trusted keys', DEFAULT_KEY_DIR)
  .action(async (containerPath, options) => {
    const spinner = ora('Verifying container...').start();
    try {
      // Load trusted key IDs
      const trustedKeyIds = loadTrustedKeyIds(options.keydir);

      // Verify
      const result = await verifyContainerFile(containerPath, trustedKeyIds);

      if (result.valid) {
        spinner.succeed('Container is valid');
      } else {
        spinner.fail('Container verification failed');
      }

      console.log('\nIntegrity Checks:');
      console.log(`  Payload hash:     ${result.integrity.payload_hash_ok ? chalk.green('OK') : chalk.red('FAILED')}`);
      console.log(`  Signature:        ${result.integrity.manifest_signature_ok ? chalk.green('OK') : chalk.red('FAILED')}`);
      console.log(`  Event chain:      ${result.integrity.event_chain_ok ? chalk.green('OK') : chalk.red('FAILED')}`);
      console.log(`  Transparency log: ${result.integrity.transparency_log_ok === null ? chalk.gray('N/A') : result.integrity.transparency_log_ok ? chalk.green('OK') : chalk.red('FAILED')}`);

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
      }

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  - ${warning}`));
        }
      }

      process.exit(result.valid ? 0 : 1);
    } catch (err) {
      spinner.fail('Failed to verify');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Publish Command
// ============================================================================

program
  .command('publish')
  .description('Publish a container to the transparency log')
  .argument('<container>', 'Path to .verity file')
  .option('-l, --log-url <url>', 'Log server URL', 'http://localhost:3001')
  .action(async (containerPath, options) => {
    const spinner = ora('Publishing to transparency log...').start();
    try {
      // Read container
      const container = await readContainer(containerPath);

      // Compute content hash
      const contentHash = computeContentHash(container.manifest, container.events);

      // Create log client
      const client = new VerityLogClient({ baseUrl: options.logUrl });

      // Publish and get proof
      const logProof = await client.publishAndGetProof(contentHash);

      // Update container with log proof
      await updateContainer(containerPath, { logProof });

      spinner.succeed('Published to transparency log');
      console.log('\nLog Proof:');
      console.log(`  Leaf index: ${logProof.inclusion_proof.leaf_index}`);
      console.log(`  Tree size:  ${logProof.checkpoint.tree_size}`);
      console.log(`  Root hash:  ${logProof.checkpoint.root_hash.substring(0, 32)}...`);
    } catch (err) {
      spinner.fail('Failed to publish');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Prove Command (Offline Verification)
// ============================================================================

program
  .command('prove')
  .description('Verify inclusion proof offline')
  .argument('<container>', 'Path to .verity file')
  .option('-k, --keydir <path>', 'Key directory', DEFAULT_KEY_DIR)
  .option('--log-pubkey <key>', 'Log public key (hex)')
  .action(async (containerPath, options) => {
    const spinner = ora('Verifying inclusion proof...').start();
    try {
      // Read container
      const container = await readContainer(containerPath);

      if (!container.logProof) {
        spinner.fail('Container has no log proof');
        process.exit(1);
      }

      // Get log public key
      let logPubkey = options.logPubkey;
      if (!logPubkey) {
        const logKeyPath = path.join(options.keydir, 'log.key.json');
        logPubkey = loadPublicKey(logKeyPath);
        if (!logPubkey) {
          spinner.fail('No log public key provided or found');
          process.exit(1);
        }
      }

      // Compute content hash
      const contentHash = computeContentHash(container.manifest, container.events);

      // Verify proof
      const result = await verifyLogProof(contentHash, container.logProof, logPubkey);

      if (result.valid) {
        spinner.succeed('Inclusion proof is valid');
        console.log('\nVerification Details:');
        console.log(`  Leaf index: ${container.logProof.inclusion_proof.leaf_index}`);
        console.log(`  Tree size:  ${container.logProof.checkpoint.tree_size}`);
        console.log('  Checkpoint signature: ' + chalk.green('VALID'));
        console.log('  Merkle proof: ' + chalk.green('VALID'));
      } else {
        spinner.fail('Inclusion proof verification failed');
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
        process.exit(1);
      }
    } catch (err) {
      spinner.fail('Failed to verify proof');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Report Command
// ============================================================================

program
  .command('report')
  .description('Generate a Trust Report')
  .argument('<container>', 'Path to .verity file')
  .option('-k, --keydir <path>', 'Key directory', DEFAULT_KEY_DIR)
  .option('-p, --policy-dir <path>', 'Policy directory', DEFAULT_POLICY_DIR)
  .option('-w, --workflow <name>', 'Workflow name')
  .option('-o, --output <path>', 'Save report to file')
  .option('--embed', 'Embed report in container')
  .action(async (containerPath, options) => {
    const spinner = ora('Generating Trust Report...').start();
    try {
      // Read container
      const container = await readContainer(containerPath);

      // Load trusted key IDs
      const trustedKeyIds = loadTrustedKeyIds(options.keydir);

      // Load log public key
      const logKeyPath = path.join(options.keydir, 'log.key.json');
      const logPubkey = loadPublicKey(logKeyPath);

      // Create verify engine
      const engine = createVerifyEngine({
        trustedCaptureKeyIds: trustedKeyIds,
        logPublicKey: logPubkey ?? undefined,
      });

      // Load policies
      if (fs.existsSync(options.policyDir)) {
        engine.loadPolicies(options.policyDir);
      }

      // Generate report
      const report = await engine.verify(container, {
        workflow: options.workflow || container.manifest.workflow_hint,
      });

      // Set container hash
      report.container_hash = await hashContainer(containerPath);

      spinner.succeed('Trust Report generated');

      // Display report
      console.log('\n' + chalk.bold('═══ TRUST REPORT ═══'));

      // Human Origin
      const originColor =
        report.human_origin_proof.value === 'YES' ? chalk.green :
        report.human_origin_proof.value === 'NO' ? chalk.red :
        chalk.yellow;
      console.log(`\n${chalk.bold('Human-Origin Proof:')} ${originColor(report.human_origin_proof.value)}`);
      console.log(`  Reason: ${report.human_origin_proof.reason}`);

      // Reality Confidence
      const scoreColor =
        report.reality_confidence.score >= 70 ? chalk.green :
        report.reality_confidence.score >= 50 ? chalk.yellow :
        chalk.red;
      console.log(`\n${chalk.bold('Reality Confidence:')} ${scoreColor(report.reality_confidence.score + '/100')}`);

      // Show top signals
      const sortedSignals = [...report.reality_confidence.reasons]
        .sort((a, b) => Math.abs(b.score_delta) - Math.abs(a.score_delta));
      console.log('  Top signals:');
      for (const signal of sortedSignals.slice(0, 5)) {
        const delta = signal.score_delta >= 0 ? chalk.green(`+${signal.score_delta}`) : chalk.red(`${signal.score_delta}`);
        console.log(`    ${delta} ${signal.name}: ${signal.explanation}`);
      }

      // Context Decision
      const decisionColor =
        report.context_decision.decision === 'ALLOW' ? chalk.green :
        report.context_decision.decision === 'WARN' ? chalk.yellow :
        report.context_decision.decision === 'REQUIRE_EXTRA_VERIFICATION' ? chalk.yellow :
        chalk.red;
      console.log(`\n${chalk.bold('Context Decision:')} ${decisionColor(report.context_decision.decision)}`);
      console.log(`  Workflow: ${report.context_decision.workflow}`);
      console.log(`  Rationale: ${report.context_decision.rationale}`);

      console.log('\n' + chalk.bold('════════════════════'));

      // Save to file if requested
      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
        console.log(`\nReport saved to: ${options.output}`);
      }

      // Embed in container if requested
      if (options.embed) {
        await updateContainer(containerPath, { trustReport: report });
        console.log('\nReport embedded in container');
      }
    } catch (err) {
      spinner.fail('Failed to generate report');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Policy Eval Command
// ============================================================================

program
  .command('policy-eval')
  .description('Evaluate a policy against a container')
  .argument('<container>', 'Path to .verity file')
  .argument('<workflow>', 'Workflow name')
  .option('-p, --policy-dir <path>', 'Policy directory', DEFAULT_POLICY_DIR)
  .option('-k, --keydir <path>', 'Key directory', DEFAULT_KEY_DIR)
  .action(async (containerPath, workflow, options) => {
    const spinner = ora('Evaluating policy...').start();
    try {
      // Use the report command internally
      const container = await readContainer(containerPath);
      const trustedKeyIds = loadTrustedKeyIds(options.keydir);
      const logKeyPath = path.join(options.keydir, 'log.key.json');
      const logPubkey = loadPublicKey(logKeyPath);

      const engine = createVerifyEngine({
        trustedCaptureKeyIds: trustedKeyIds,
        logPublicKey: logPubkey ?? undefined,
      });

      if (fs.existsSync(options.policyDir)) {
        engine.loadPolicies(options.policyDir);
      }

      const report = await engine.verify(container, { workflow });

      spinner.stop();

      const decisionColor =
        report.context_decision.decision === 'ALLOW' ? chalk.green :
        report.context_decision.decision === 'WARN' ? chalk.yellow :
        report.context_decision.decision === 'REQUIRE_EXTRA_VERIFICATION' ? chalk.magenta :
        chalk.red;

      console.log(`\n${chalk.bold('Policy Evaluation Result:')}`);
      console.log(`  Workflow:  ${workflow}`);
      console.log(`  Decision:  ${decisionColor(report.context_decision.decision)}`);
      console.log(`  Rationale: ${report.context_decision.rationale}`);
      console.log(`  Rules:     ${report.context_decision.matched_rules.join(', ')}`);

      // Exit code based on decision
      const exitCode =
        report.context_decision.decision === 'ALLOW' ? 0 :
        report.context_decision.decision === 'WARN' ? 0 :
        1;
      process.exit(exitCode);
    } catch (err) {
      spinner.fail('Failed to evaluate policy');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// ============================================================================
// Info Command
// ============================================================================

program
  .command('info')
  .description('Display container information')
  .argument('<container>', 'Path to .verity file')
  .action(async (containerPath) => {
    try {
      const container = await readContainer(containerPath);

      console.log(chalk.bold('\nVerity Container Info'));
      console.log('═'.repeat(40));

      console.log(chalk.bold('\nManifest:'));
      console.log(`  Version:     ${container.manifest.version}`);
      console.log(`  Payload:     ${container.manifest.payload_size} bytes`);
      console.log(`  MIME:        ${container.manifest.payload_mime}`);
      console.log(`  SHA-256:     ${container.manifest.payload_sha256}`);
      console.log(`  Created:     ${container.manifest.created_at}`);
      if (container.manifest.original_filename) {
        console.log(`  Filename:    ${container.manifest.original_filename}`);
      }
      if (container.manifest.workflow_hint) {
        console.log(`  Workflow:    ${container.manifest.workflow_hint}`);
      }
      if (container.manifest.capture_device_key_id) {
        console.log(`  Capture Key: ${container.manifest.capture_device_key_id}`);
      }

      console.log(chalk.bold('\nEvents:'));
      for (const event of container.events.events) {
        console.log(`  [${event.event_type}] ${event.event_time} by ${event.actor_key_id}`);
      }

      console.log(chalk.bold('\nSignatures:'));
      for (const sig of container.signatures.signatures) {
        console.log(`  ${sig.algorithm} by ${sig.signer_key_id} at ${sig.signed_at}`);
      }

      console.log(chalk.bold('\nLog Proof:') + (container.logProof ? ' Present' : chalk.gray(' None')));
      if (container.logProof) {
        console.log(`  Index:     ${container.logProof.inclusion_proof.leaf_index}`);
        console.log(`  Tree Size: ${container.logProof.checkpoint.tree_size}`);
      }

      console.log(chalk.bold('\nTrust Report:') + (container.trustReport ? ' Present' : chalk.gray(' None')));
      if (container.trustReport) {
        console.log(`  Score:    ${container.trustReport.reality_confidence.score}/100`);
        console.log(`  Decision: ${container.trustReport.context_decision.decision}`);
      }
    } catch (err) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// Parse and run
program.parse();
