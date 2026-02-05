# Verity Container Specification

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2024

## Overview

The Verity Container format (`.verity`) is a tamper-evident wrapper for digital content that provides:

1. **Cryptographic integrity** - Content cannot be modified without detection
2. **Provenance tracking** - Complete chain of custody from capture to publication
3. **External verifiability** - Third parties can verify without trusting Verity servers
4. **Policy evaluation** - Context-aware decisions based on verification results

## Container Structure

A Verity container is a standard ZIP archive with the `.verity` extension containing:

```
container.verity (ZIP)
├── payload.bin          # Original file content (raw bytes)
├── manifest.json        # Metadata and payload hash (canonical JSON)
├── events.json          # Provenance event chain (canonical JSON)
├── signatures.json      # Detached signatures (canonical JSON)
├── log_proof.json       # [Optional] Transparency log inclusion proof
└── trust_report.json    # [Optional] Generated Trust Report
```

All JSON files MUST use [RFC 8785 JSON Canonicalization Scheme (JCS)](https://tools.ietf.org/html/rfc8785) for deterministic serialization.

## Manifest (`manifest.json`)

The manifest contains metadata about the payload and signing context.

### Schema

```json
{
  "version": "1.0",
  "payload_sha256": "hex-encoded SHA-256 hash of payload.bin",
  "payload_mime": "MIME type string",
  "payload_size": 12345,
  "created_at": "RFC3339 timestamp",
  "capture_device_pubkey": "[optional] Ed25519 public key (hex)",
  "capture_device_key_id": "[optional] 16-char hex key ID",
  "signer_cert_chain": "[optional] array of certificate info",
  "workflow_hint": "[optional] suggested workflow name",
  "original_filename": "[optional] original filename"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version, always "1.0" |
| `payload_sha256` | string | Yes | SHA-256 hash of `payload.bin` (64 hex chars) |
| `payload_mime` | string | Yes | MIME type of the payload |
| `payload_size` | integer | Yes | Size of payload in bytes |
| `created_at` | string | Yes | RFC3339 timestamp of container creation |
| `capture_device_pubkey` | string | No | Ed25519 public key of capture device (64 hex chars) |
| `capture_device_key_id` | string | No | Short identifier for capture key (16 hex chars) |
| `signer_cert_chain` | array | No | Certificate chain for trust verification |
| `workflow_hint` | string | No | Suggested workflow for policy evaluation |
| `original_filename` | string | No | Original filename before wrapping |

### Certificate Info Schema

```json
{
  "subject": "string identifier",
  "issuer": "string identifier",
  "public_key": "Ed25519 public key (hex)",
  "key_id": "16-char hex",
  "valid_from": "RFC3339",
  "valid_until": "RFC3339",
  "is_root": true
}
```

## Events (`events.json`)

Events form a hash-linked chain tracking the provenance of the content.

### Schema

```json
{
  "events": [
    {
      "event_id": "UUID",
      "event_type": "CAPTURE|EDIT|TRANSCODE|AI_EDIT|PUBLISH|SIGN|OTHER",
      "event_time": "RFC3339 timestamp",
      "actor_key_id": "16-char hex",
      "actor_pubkey": "Ed25519 public key (hex)",
      "prev_event_hash": "SHA-256 hash of previous event (or empty for first)",
      "event_hash": "SHA-256 hash of this event",
      "event_signature": "Ed25519 signature of event_hash",
      "metadata": "[optional] object with additional info"
    }
  ]
}
```

### Event Types

| Type | Description |
|------|-------------|
| `CAPTURE` | Content was captured by a device (camera, microphone, etc.) |
| `EDIT` | Human editing without AI involvement |
| `TRANSCODE` | Format conversion (encoding, compression) |
| `AI_EDIT` | AI-assisted or AI-generated modification |
| `PUBLISH` | Content was published or shared |
| `SIGN` | Additional signature was added |
| `OTHER` | Other provenance event |

### Event Hash Computation

The `event_hash` is computed over the canonical JSON of the event **without** the `event_hash` and `event_signature` fields:

```javascript
const eventBase = {
  event_id: event.event_id,
  event_type: event.event_type,
  event_time: event.event_time,
  actor_key_id: event.actor_key_id,
  actor_pubkey: event.actor_pubkey,
  prev_event_hash: event.prev_event_hash,
  // metadata only if present
};
const canonicalJson = canonicalize(eventBase);
const eventHash = sha256(canonicalJson);
```

### Human-Origin Proof Rules

A container has **Human-Origin Proof = YES** if and only if:

1. The first event is a `CAPTURE` event
2. The `CAPTURE` event is signed by a trusted capture key
3. No `AI_EDIT` events exist in the chain
4. The entire event hash chain verifies correctly

## Signatures (`signatures.json`)

Contains one or more detached signatures over the manifest and events.

### Schema

```json
{
  "signatures": [
    {
      "signature_id": "UUID",
      "signer_key_id": "16-char hex",
      "signer_pubkey": "Ed25519 public key (hex)",
      "signed_content": "manifest_and_events",
      "content_hash": "SHA-256 hash being signed",
      "signature": "Ed25519 signature (hex)",
      "signed_at": "RFC3339 timestamp",
      "algorithm": "ed25519"
    }
  ]
}
```

### Content Hash Computation

The `content_hash` signed by signatures is:

```javascript
const canonicalManifest = canonicalize(manifest);
const canonicalEvents = canonicalize(events);
const combined = canonicalManifest + canonicalEvents;
const contentHash = sha256(combined);
```

## Log Proof (`log_proof.json`)

Optional transparency log inclusion proof for external auditability.

### Schema

```json
{
  "obtained_at": "RFC3339 timestamp",
  "log_url": "[optional] URL of log server",
  "checkpoint": {
    "tree_size": 1234,
    "root_hash": "Merkle root (hex)",
    "issued_at": "RFC3339 timestamp",
    "signature": "Ed25519 signature of checkpoint",
    "log_pubkey": "Log's Ed25519 public key (hex)",
    "log_key_id": "16-char hex"
  },
  "inclusion_proof": {
    "leaf_index": 42,
    "leaf_hash": "Leaf hash (hex)",
    "proof_hashes": ["hash1", "hash2", "..."],
    "tree_size": 1234
  }
}
```

### Verification

1. Verify checkpoint signature: `verify(signature, "tree_size|root_hash|issued_at", log_pubkey)`
2. Compute expected leaf hash: `sha256(0x00 || content_hash)`
3. Verify Merkle inclusion proof against `root_hash`

## Trust Report (`trust_report.json`)

Optional generated report from the Verity Verify engine.

### Schema

```json
{
  "report_id": "UUID",
  "schema_version": "1.0",
  "generated_at": "RFC3339 timestamp",
  "container_hash": "SHA-256 of container file",
  "human_origin_proof": {
    "value": "YES|NO|UNAVAILABLE",
    "reason": "explanation",
    "evidence": { ... }
  },
  "reality_confidence": {
    "score": 0-100,
    "reasons": [ ... signals ... ],
    "limitations": "disclaimer text"
  },
  "context_decision": {
    "workflow": "workflow name",
    "decision": "ALLOW|WARN|REQUIRE_EXTRA_VERIFICATION|BLOCK",
    "policy_version": "1.0",
    "rationale": "explanation",
    "matched_rules": ["rule_id", ...]
  },
  "integrity": {
    "payload_hash_ok": true,
    "manifest_signature_ok": true,
    "event_chain_ok": true,
    "transparency_log_ok": true,
    "errors": []
  },
  "engine_version": "0.1.0"
}
```

## Cryptographic Algorithms

| Purpose | Algorithm | Key Size |
|---------|-----------|----------|
| Hashing | SHA-256 | 256 bits |
| Signing | Ed25519 | 256 bits |

### Key ID Generation

```javascript
keyId = sha256(publicKey).substring(0, 16);
```

## Merkle Tree (Transparency Log)

The transparency log uses RFC 6962-style Merkle trees:

- **Leaf hash:** `SHA256(0x00 || data)`
- **Node hash:** `SHA256(0x01 || left || right)`

This domain separation prevents second-preimage attacks.

## MIME Type

Verity containers SHOULD be served with:
- **MIME Type:** `application/vnd.verity+zip`
- **File Extension:** `.verity`

## Security Considerations

See [security.md](./security.md) for:
- Threat model
- Trust assumptions
- Key management guidance
- Limitations and non-goals
