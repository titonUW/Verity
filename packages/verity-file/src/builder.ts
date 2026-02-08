/**
 * Verity Container Builder
 * High-level API for creating Verity containers
 */

import * as fs from 'fs';
import * as path from 'path';
import { lookup } from 'mime-types';
import { createManifest, type CreateManifestOptions } from './manifest.js';
import {
  createCaptureEvent,
  createChainedEvent,
  createEmptyEvents,
  addEvent,
  getLastEvent,
} from './events.js';
import {
  createSignature,
  createEmptySignatures,
  addSignature,
} from './signatures.js';
import { writeContainer, VERITY_EXTENSION } from './container.js';
import { getPublicKeyInfo } from './crypto.js';
import type {
  VerityManifest,
  VerityEvents,
  VeritySignatures,
  VerityLogProof,
  TrustReport,
  KeyPair,
  EventType,
} from './types.js';

// Lookup for mime-types
function getMimeType(filename: string): string {
  // Type assertion for lookup result
  const mimeResult = lookup(filename);
  return (mimeResult as string | false) || 'application/octet-stream';
}

/**
 * Builder for creating Verity containers step by step
 */
export class VerityContainerBuilder {
  private payload: Buffer | null = null;
  private mimeType: string | null = null;
  private originalFilename: string | null = null;
  private workflowHint: string | null = null;
  private captureDeviceKey: KeyPair | null = null;
  private manifest: VerityManifest | null = null;
  private events: VerityEvents = createEmptyEvents();
  private signatures: VeritySignatures = createEmptySignatures();
  private logProof: VerityLogProof | null = null;
  private trustReport: TrustReport | null = null;

  /**
   * Set the payload from a buffer
   * @param payload - Raw bytes
   * @param mimeType - MIME type
   * @param originalFilename - Original filename (optional)
   */
  setPayload(payload: Buffer, mimeType: string, originalFilename?: string): this {
    this.payload = payload;
    this.mimeType = mimeType;
    this.originalFilename = originalFilename ?? null;
    return this;
  }

  /**
   * Set the payload from a file
   * @param filePath - Path to file
   */
  async setPayloadFromFile(filePath: string): Promise<this> {
    this.payload = await fs.promises.readFile(filePath);
    this.mimeType = getMimeType(filePath);
    this.originalFilename = path.basename(filePath);
    return this;
  }

  /**
   * Set workflow hint
   * @param hint - Workflow name
   */
  setWorkflowHint(hint: string): this {
    this.workflowHint = hint;
    return this;
  }

  /**
   * Set the capture device key pair
   * This is used for creating the manifest and CAPTURE event
   * @param keyPair - Capture device key pair
   */
  setCaptureDeviceKey(keyPair: KeyPair): this {
    this.captureDeviceKey = keyPair;
    return this;
  }

  /**
   * Build the manifest
   * Must be called after setPayload and optionally setCaptureDeviceKey
   */
  buildManifest(): this {
    if (!this.payload || !this.mimeType) {
      throw new Error('Payload must be set before building manifest');
    }

    const options: CreateManifestOptions = {
      payload: this.payload,
      mimeType: this.mimeType,
    };

    if (this.captureDeviceKey) {
      options.captureDevice = getPublicKeyInfo(this.captureDeviceKey);
    }

    if (this.originalFilename) {
      options.originalFilename = this.originalFilename;
    }

    if (this.workflowHint) {
      options.workflowHint = this.workflowHint;
    }

    this.manifest = createManifest(options);
    return this;
  }

  /**
   * Add a CAPTURE event (should be the first event)
   * @param keyPair - Capture device key pair
   * @param metadata - Optional capture metadata
   */
  async addCaptureEvent(
    keyPair?: KeyPair,
    metadata?: Record<string, string>
  ): Promise<this> {
    const key = keyPair ?? this.captureDeviceKey;
    if (!key) {
      throw new Error('No key pair provided for capture event');
    }

    const event = await createCaptureEvent(key, metadata);
    this.events = addEvent(this.events, event);
    return this;
  }

  /**
   * Add an event to the chain
   * @param eventType - Type of event
   * @param actorKeyPair - Actor's key pair
   * @param metadata - Optional metadata
   */
  async addEvent(
    eventType: EventType,
    actorKeyPair: KeyPair,
    metadata?: Record<string, string>
  ): Promise<this> {
    const lastEvent = getLastEvent(this.events);

    if (!lastEvent) {
      // First event - create as capture if type is CAPTURE, otherwise error
      if (eventType === 'CAPTURE') {
        return this.addCaptureEvent(actorKeyPair, metadata);
      }
      throw new Error('First event must be CAPTURE');
    }

    const event = await createChainedEvent(eventType, actorKeyPair, lastEvent, metadata);
    this.events = addEvent(this.events, event);
    return this;
  }

  /**
   * Sign the manifest and events
   * @param signerKeyPair - Signer's key pair
   */
  async sign(signerKeyPair: KeyPair): Promise<this> {
    if (!this.manifest) {
      throw new Error('Manifest must be built before signing');
    }

    const signature = await createSignature({
      manifest: this.manifest,
      events: this.events,
      signerKeyPair,
    });

    this.signatures = addSignature(this.signatures, signature);
    return this;
  }

  /**
   * Set log proof
   * @param proof - Log inclusion proof
   */
  setLogProof(proof: VerityLogProof): this {
    this.logProof = proof;
    return this;
  }

  /**
   * Set trust report
   * @param report - Trust report
   */
  setTrustReport(report: TrustReport): this {
    this.trustReport = report;
    return this;
  }

  /**
   * Write the container to disk
   * @param outputPath - Output file path
   */
  async write(outputPath: string): Promise<void> {
    if (!this.payload) {
      throw new Error('Payload must be set');
    }
    if (!this.manifest) {
      throw new Error('Manifest must be built');
    }
    if (this.signatures.signatures.length === 0) {
      throw new Error('Container must have at least one signature');
    }

    // Ensure .verity extension
    let finalPath = outputPath;
    if (!outputPath.endsWith(VERITY_EXTENSION)) {
      finalPath = `${outputPath}${VERITY_EXTENSION}`;
    }

    await writeContainer({
      outputPath: finalPath,
      payload: this.payload,
      manifest: this.manifest,
      events: this.events,
      signatures: this.signatures,
      logProof: this.logProof ?? undefined,
      trustReport: this.trustReport ?? undefined,
    });
  }

  /**
   * Get the current state of the builder
   */
  getState(): {
    hasPayload: boolean;
    hasManifest: boolean;
    eventCount: number;
    signatureCount: number;
    hasLogProof: boolean;
    hasTrustReport: boolean;
  } {
    return {
      hasPayload: this.payload !== null,
      hasManifest: this.manifest !== null,
      eventCount: this.events.events.length,
      signatureCount: this.signatures.signatures.length,
      hasLogProof: this.logProof !== null,
      hasTrustReport: this.trustReport !== null,
    };
  }

  /**
   * Get the manifest (if built)
   */
  getManifest(): VerityManifest | null {
    return this.manifest;
  }

  /**
   * Get the events
   */
  getEvents(): VerityEvents {
    return this.events;
  }

  /**
   * Get the signatures
   */
  getSignatures(): VeritySignatures {
    return this.signatures;
  }
}

/**
 * Create a Verity container from a file with minimal setup
 * This is a convenience function for simple use cases
 *
 * @param inputPath - Path to file to wrap
 * @param outputPath - Output path (optional, defaults to input.verity)
 * @param captureKey - Capture device key pair
 * @param signerKey - Signer key pair (can be same as capture)
 * @param options - Additional options
 */
export async function wrapFile(
  inputPath: string,
  outputPath: string | undefined,
  captureKey: KeyPair,
  signerKey?: KeyPair,
  options?: {
    workflowHint?: string;
    metadata?: Record<string, string>;
  }
): Promise<string> {
  const builder = new VerityContainerBuilder();

  await builder.setPayloadFromFile(inputPath);
  builder.setCaptureDeviceKey(captureKey);

  if (options?.workflowHint) {
    builder.setWorkflowHint(options.workflowHint);
  }

  builder.buildManifest();

  await builder.addCaptureEvent(captureKey, options?.metadata);
  await builder.sign(signerKey ?? captureKey);

  const finalOutput = outputPath ?? `${inputPath}${VERITY_EXTENSION}`;
  await builder.write(finalOutput);

  return finalOutput;
}
