/**
 * Container Module Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  writeContainer,
  readContainer,
  verifyContainer,
  isVerityFile,
  getContainerPath,
} from './container.js';
import { createManifest } from './manifest.js';
import { createCaptureEvent, createEmptyEvents, addEvent } from './events.js';
import { createSignature, createEmptySignatures, addSignature } from './signatures.js';
import { generateKeyPair, sha256Hash } from './crypto.js';

describe('Container Module', () => {
  let tempDir: string;
  let containerPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verity-test-'));
    containerPath = path.join(tempDir, 'test.verity');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('writeContainer and readContainer', () => {
    it('should write and read a container', async () => {
      const keyPair = await generateKeyPair();
      const payload = Buffer.from('Hello, Verity!');

      const manifest = createManifest({
        payload,
        mimeType: 'text/plain',
      });

      const captureEvent = await createCaptureEvent(keyPair);
      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);

      const signature = await createSignature({
        manifest,
        events,
        signerKeyPair: keyPair,
      });
      let signatures = createEmptySignatures();
      signatures = addSignature(signatures, signature);

      await writeContainer({
        outputPath: containerPath,
        payload,
        manifest,
        events,
        signatures,
      });

      // Verify file was created
      expect(fs.existsSync(containerPath)).toBe(true);

      // Read back
      const container = await readContainer(containerPath);

      expect(container.payload.toString()).toBe('Hello, Verity!');
      expect(container.manifest.payload_sha256).toBe(sha256Hash(payload));
      expect(container.manifest.payload_size).toBe(payload.length);
      expect(container.events.events).toHaveLength(1);
      expect(container.signatures.signatures).toHaveLength(1);
    });

    it('should handle optional fields', async () => {
      const keyPair = await generateKeyPair();
      const payload = Buffer.from('Test content');

      const manifest = createManifest({
        payload,
        mimeType: 'text/plain',
        originalFilename: 'test.txt',
        workflowHint: 'test-workflow',
      });

      const captureEvent = await createCaptureEvent(keyPair, { source: 'test' });
      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);

      const signature = await createSignature({ manifest, events, signerKeyPair: keyPair });
      let signatures = createEmptySignatures();
      signatures = addSignature(signatures, signature);

      await writeContainer({
        outputPath: containerPath,
        payload,
        manifest,
        events,
        signatures,
      });

      const container = await readContainer(containerPath);

      expect(container.manifest.original_filename).toBe('test.txt');
      expect(container.manifest.workflow_hint).toBe('test-workflow');
      expect(container.events.events[0].metadata?.source).toBe('test');
    });
  });

  describe('verifyContainer', () => {
    it('should verify a valid container', async () => {
      const keyPair = await generateKeyPair();
      const payload = Buffer.from('Valid content');

      const manifest = createManifest({ payload, mimeType: 'text/plain' });
      const captureEvent = await createCaptureEvent(keyPair);
      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);

      const signature = await createSignature({ manifest, events, signerKeyPair: keyPair });
      let signatures = createEmptySignatures();
      signatures = addSignature(signatures, signature);

      await writeContainer({
        outputPath: containerPath,
        payload,
        manifest,
        events,
        signatures,
      });

      const container = await readContainer(containerPath);
      const result = await verifyContainer(container);

      expect(result.valid).toBe(true);
      expect(result.integrity.payload_hash_ok).toBe(true);
      expect(result.integrity.manifest_signature_ok).toBe(true);
      expect(result.integrity.event_chain_ok).toBe(true);
    });

    it('should detect tampered payload', async () => {
      const keyPair = await generateKeyPair();
      const payload = Buffer.from('Original content');

      const manifest = createManifest({ payload, mimeType: 'text/plain' });
      const captureEvent = await createCaptureEvent(keyPair);
      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);

      const signature = await createSignature({ manifest, events, signerKeyPair: keyPair });
      let signatures = createEmptySignatures();
      signatures = addSignature(signatures, signature);

      // Create container with tampered payload
      const tamperedPayload = Buffer.from('Tampered content');

      await writeContainer({
        outputPath: containerPath,
        payload: tamperedPayload, // Wrong payload!
        manifest,
        events,
        signatures,
      });

      const container = await readContainer(containerPath);
      const result = await verifyContainer(container);

      expect(result.valid).toBe(false);
      expect(result.integrity.payload_hash_ok).toBe(false);
    });

    it('should detect invalid signature', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      const payload = Buffer.from('Content');

      const manifest = createManifest({ payload, mimeType: 'text/plain' });
      const captureEvent = await createCaptureEvent(keyPair1);
      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);

      // Sign with different key
      const signature = await createSignature({ manifest, events, signerKeyPair: keyPair2 });
      let signatures = createEmptySignatures();
      signatures = addSignature(signatures, signature);

      // Tamper with manifest after signing
      const tamperedManifest = { ...manifest, workflow_hint: 'tampered' };

      await writeContainer({
        outputPath: containerPath,
        payload,
        manifest: tamperedManifest,
        events,
        signatures,
      });

      const container = await readContainer(containerPath);
      const result = await verifyContainer(container);

      expect(result.valid).toBe(false);
      expect(result.integrity.manifest_signature_ok).toBe(false);
    });
  });

  describe('isVerityFile', () => {
    it('should identify .verity files', () => {
      expect(isVerityFile('document.verity')).toBe(true);
      expect(isVerityFile('/path/to/file.VERITY')).toBe(true);
      expect(isVerityFile('test.verity')).toBe(true);
    });

    it('should reject non-.verity files', () => {
      expect(isVerityFile('document.pdf')).toBe(false);
      expect(isVerityFile('file.txt')).toBe(false);
      expect(isVerityFile('verity.zip')).toBe(false);
    });
  });

  describe('getContainerPath', () => {
    it('should append .verity extension', () => {
      expect(getContainerPath('document.pdf')).toBe('document.pdf.verity');
      expect(getContainerPath('/path/to/file.txt')).toBe('/path/to/file.txt.verity');
    });
  });
});
