/**
 * Verity Events (Provenance Chain)
 * Create and validate the chain-of-custody events
 */

import { sign, verify, generateId } from './crypto.js';
import { canonicalize, canonicalHash, rfc3339Now } from './canonical.js';
import type { VerityEvent, VerityEvents, EventType, KeyPair } from './types.js';

// ============================================================================
// Event Creation
// ============================================================================

export interface CreateEventOptions {
  /** Type of event */
  eventType: EventType;
  /** Key pair of the actor performing the event */
  actorKeyPair: KeyPair;
  /** Previous event hash (empty string for first event) */
  prevEventHash?: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
  /** Override event time (for testing) */
  eventTime?: Date;
}

/**
 * Create a new event in the provenance chain
 * @param options - Event creation options
 * @returns Signed event
 */
export async function createEvent(options: CreateEventOptions): Promise<VerityEvent> {
  const {
    eventType,
    actorKeyPair,
    prevEventHash = '',
    metadata,
    eventTime,
  } = options;

  // Build the event without hash/signature first
  const eventBase = {
    event_id: generateId(),
    event_type: eventType,
    event_time: (eventTime ?? new Date()).toISOString(),
    actor_key_id: actorKeyPair.keyId,
    actor_pubkey: actorKeyPair.publicKey,
    prev_event_hash: prevEventHash,
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
  };

  // Compute event hash over the canonical event (without hash/signature fields)
  const eventHash = canonicalHash(eventBase);

  // Sign the event hash
  const eventSignature = await sign(eventHash, actorKeyPair.privateKey);

  // Return complete event
  return {
    ...eventBase,
    event_hash: eventHash,
    event_signature: eventSignature,
  };
}

/**
 * Create a CAPTURE event (first event in chain)
 * @param actorKeyPair - Capture device key pair
 * @param metadata - Optional capture metadata
 * @returns Signed capture event
 */
export async function createCaptureEvent(
  actorKeyPair: KeyPair,
  metadata?: Record<string, string>
): Promise<VerityEvent> {
  return createEvent({
    eventType: 'CAPTURE',
    actorKeyPair,
    prevEventHash: '',
    metadata,
  });
}

/**
 * Create an event that chains to a previous event
 * @param eventType - Type of event
 * @param actorKeyPair - Actor's key pair
 * @param previousEvent - Previous event in chain
 * @param metadata - Optional metadata
 * @returns Signed event
 */
export async function createChainedEvent(
  eventType: EventType,
  actorKeyPair: KeyPair,
  previousEvent: VerityEvent,
  metadata?: Record<string, string>
): Promise<VerityEvent> {
  return createEvent({
    eventType,
    actorKeyPair,
    prevEventHash: previousEvent.event_hash,
    metadata,
  });
}

// ============================================================================
// Events Serialization
// ============================================================================

/**
 * Serialize events to canonical JSON
 * @param events - Events object
 * @returns Canonical JSON string
 */
export function serializeEvents(events: VerityEvents): string {
  return canonicalize(events);
}

/**
 * Parse events from JSON string
 * @param json - JSON string
 * @returns Parsed events
 */
export function parseEvents(json: string): VerityEvents {
  const parsed = JSON.parse(json) as VerityEvents;
  return parsed;
}

/**
 * Compute canonical hash of events
 * @param events - Events to hash
 * @returns SHA-256 hash (hex)
 */
export function hashEvents(events: VerityEvents): string {
  return canonicalHash(events);
}

// ============================================================================
// Event Chain Validation
// ============================================================================

export interface EventChainValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Index of the first capture event (-1 if none) */
  firstCaptureIndex: number;
  /** Whether any AI_EDIT event exists */
  hasAiEdit: boolean;
  /** Chain length */
  chainLength: number;
}

/**
 * Verify a single event's signature and hash
 * @param event - Event to verify
 * @returns Validation result
 */
export async function verifyEvent(
  event: VerityEvent
): Promise<{ valid: boolean; error?: string }> {
  // Reconstruct the event base (without hash/signature)
  const eventBase: Record<string, unknown> = {
    event_id: event.event_id,
    event_type: event.event_type,
    event_time: event.event_time,
    actor_key_id: event.actor_key_id,
    actor_pubkey: event.actor_pubkey,
    prev_event_hash: event.prev_event_hash,
  };

  if (event.metadata && Object.keys(event.metadata).length > 0) {
    eventBase.metadata = event.metadata;
  }

  // Verify hash
  const computedHash = canonicalHash(eventBase);
  if (computedHash !== event.event_hash) {
    return {
      valid: false,
      error: `Event hash mismatch for event ${event.event_id}`,
    };
  }

  // Verify signature
  const signatureValid = await verify(
    event.event_signature,
    event.event_hash,
    event.actor_pubkey
  );

  if (!signatureValid) {
    return {
      valid: false,
      error: `Invalid signature for event ${event.event_id}`,
    };
  }

  return { valid: true };
}

/**
 * Validate the entire event chain
 * @param events - Events to validate
 * @returns Validation result
 */
export async function validateEventChain(
  events: VerityEvents
): Promise<EventChainValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let firstCaptureIndex = -1;
  let hasAiEdit = false;

  if (!events.events || !Array.isArray(events.events)) {
    return {
      valid: false,
      errors: ['Events must be an array'],
      warnings: [],
      firstCaptureIndex: -1,
      hasAiEdit: false,
      chainLength: 0,
    };
  }

  const eventList = events.events;

  // Check for empty chain
  if (eventList.length === 0) {
    warnings.push('Event chain is empty');
    return {
      valid: true,
      errors: [],
      warnings,
      firstCaptureIndex: -1,
      hasAiEdit: false,
      chainLength: 0,
    };
  }

  // Verify each event and chain integrity
  for (let i = 0; i < eventList.length; i++) {
    const event = eventList[i];

    // Track event types
    if (event.event_type === 'CAPTURE' && firstCaptureIndex === -1) {
      firstCaptureIndex = i;
    }
    if (event.event_type === 'AI_EDIT') {
      hasAiEdit = true;
    }

    // Verify individual event
    const eventResult = await verifyEvent(event);
    if (!eventResult.valid) {
      errors.push(eventResult.error!);
      continue;
    }

    // Verify chain linkage
    if (i === 0) {
      // First event should have empty prev_event_hash
      if (event.prev_event_hash !== '') {
        warnings.push('First event has non-empty prev_event_hash');
      }
    } else {
      // Subsequent events should link to previous
      const prevEvent = eventList[i - 1];
      if (event.prev_event_hash !== prevEvent.event_hash) {
        errors.push(
          `Event ${event.event_id} does not properly chain to previous event`
        );
      }
    }

    // Check timestamp ordering
    if (i > 0) {
      const prevTime = new Date(eventList[i - 1].event_time);
      const currTime = new Date(event.event_time);
      if (currTime < prevTime) {
        warnings.push(`Event ${event.event_id} has earlier timestamp than previous event`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    firstCaptureIndex,
    hasAiEdit,
    chainLength: eventList.length,
  };
}

/**
 * Get the last event in the chain
 * @param events - Events object
 * @returns Last event or undefined if empty
 */
export function getLastEvent(events: VerityEvents): VerityEvent | undefined {
  if (events.events.length === 0) {
    return undefined;
  }
  return events.events[events.events.length - 1];
}

/**
 * Add an event to the chain
 * @param events - Current events
 * @param event - Event to add
 * @returns New events object
 */
export function addEvent(events: VerityEvents, event: VerityEvent): VerityEvents {
  return {
    events: [...events.events, event],
  };
}

/**
 * Create an empty events object
 * @returns Empty events
 */
export function createEmptyEvents(): VerityEvents {
  return { events: [] };
}
