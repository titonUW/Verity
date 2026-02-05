/**
 * Events Module Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createEvent,
  createCaptureEvent,
  createChainedEvent,
  verifyEvent,
  validateEventChain,
  createEmptyEvents,
  addEvent,
  getLastEvent,
} from './events.js';
import { generateKeyPair } from './crypto.js';

describe('Events Module', () => {
  describe('createCaptureEvent', () => {
    it('should create a valid capture event', async () => {
      const keyPair = await generateKeyPair();
      const event = await createCaptureEvent(keyPair);

      expect(event.event_type).toBe('CAPTURE');
      expect(event.actor_key_id).toBe(keyPair.keyId);
      expect(event.actor_pubkey).toBe(keyPair.publicKey);
      expect(event.prev_event_hash).toBe('');
      expect(event.event_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(event.event_signature).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should create a capture event with metadata', async () => {
      const keyPair = await generateKeyPair();
      const metadata = { device: 'test-device', location: 'lab' };
      const event = await createCaptureEvent(keyPair, metadata);

      expect(event.metadata).toEqual(metadata);
    });
  });

  describe('createChainedEvent', () => {
    it('should chain events correctly', async () => {
      const keyPair = await generateKeyPair();
      const firstEvent = await createCaptureEvent(keyPair);
      const secondEvent = await createChainedEvent('EDIT', keyPair, firstEvent);

      expect(secondEvent.event_type).toBe('EDIT');
      expect(secondEvent.prev_event_hash).toBe(firstEvent.event_hash);
    });

    it('should create different event types', async () => {
      const keyPair = await generateKeyPair();
      const captureEvent = await createCaptureEvent(keyPair);

      const editEvent = await createChainedEvent('EDIT', keyPair, captureEvent);
      expect(editEvent.event_type).toBe('EDIT');

      const aiEditEvent = await createChainedEvent('AI_EDIT', keyPair, editEvent);
      expect(aiEditEvent.event_type).toBe('AI_EDIT');
    });
  });

  describe('verifyEvent', () => {
    it('should verify a valid event', async () => {
      const keyPair = await generateKeyPair();
      const event = await createCaptureEvent(keyPair);

      const result = await verifyEvent(event);
      expect(result.valid).toBe(true);
    });

    it('should detect tampered event hash', async () => {
      const keyPair = await generateKeyPair();
      const event = await createCaptureEvent(keyPair);

      // Tamper with the event type
      const tamperedEvent = { ...event, event_type: 'AI_EDIT' as const };

      const result = await verifyEvent(tamperedEvent);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hash mismatch');
    });

    it('should detect invalid signature', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();
      const event = await createCaptureEvent(keyPair1);

      // Replace signature with one from different key
      const tamperedEvent = {
        ...event,
        event_signature: await (await import('./crypto.js')).sign(
          event.event_hash,
          keyPair2.privateKey
        ),
      };

      const result = await verifyEvent(tamperedEvent);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid signature');
    });
  });

  describe('validateEventChain', () => {
    it('should validate an empty chain', async () => {
      const events = createEmptyEvents();
      const result = await validateEventChain(events);

      expect(result.valid).toBe(true);
      expect(result.chainLength).toBe(0);
    });

    it('should validate a single-event chain', async () => {
      const keyPair = await generateKeyPair();
      const captureEvent = await createCaptureEvent(keyPair);

      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);

      const result = await validateEventChain(events);
      expect(result.valid).toBe(true);
      expect(result.chainLength).toBe(1);
      expect(result.firstCaptureIndex).toBe(0);
      expect(result.hasAiEdit).toBe(false);
    });

    it('should validate a multi-event chain', async () => {
      const keyPair = await generateKeyPair();
      const captureEvent = await createCaptureEvent(keyPair);
      const editEvent = await createChainedEvent('EDIT', keyPair, captureEvent);
      const publishEvent = await createChainedEvent('PUBLISH', keyPair, editEvent);

      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);
      events = addEvent(events, editEvent);
      events = addEvent(events, publishEvent);

      const result = await validateEventChain(events);
      expect(result.valid).toBe(true);
      expect(result.chainLength).toBe(3);
    });

    it('should detect AI_EDIT events', async () => {
      const keyPair = await generateKeyPair();
      const captureEvent = await createCaptureEvent(keyPair);
      const aiEditEvent = await createChainedEvent('AI_EDIT', keyPair, captureEvent);

      let events = createEmptyEvents();
      events = addEvent(events, captureEvent);
      events = addEvent(events, aiEditEvent);

      const result = await validateEventChain(events);
      expect(result.valid).toBe(true);
      expect(result.hasAiEdit).toBe(true);
    });

    it('should detect broken chain', async () => {
      const keyPair = await generateKeyPair();
      const event1 = await createCaptureEvent(keyPair);
      const event2 = await createCaptureEvent(keyPair); // Not chained!

      let events = createEmptyEvents();
      events = addEvent(events, event1);
      events = addEvent(events, event2);

      const result = await validateEventChain(events);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('chain'))).toBe(true);
    });
  });

  describe('getLastEvent', () => {
    it('should return undefined for empty events', () => {
      const events = createEmptyEvents();
      expect(getLastEvent(events)).toBeUndefined();
    });

    it('should return the last event', async () => {
      const keyPair = await generateKeyPair();
      const event1 = await createCaptureEvent(keyPair);
      const event2 = await createChainedEvent('EDIT', keyPair, event1);

      let events = createEmptyEvents();
      events = addEvent(events, event1);
      events = addEvent(events, event2);

      const last = getLastEvent(events);
      expect(last?.event_id).toBe(event2.event_id);
    });
  });
});
