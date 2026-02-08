# Verity Security Model

**Version:** 1.0
**Status:** Draft

## Overview

Verity is trust infrastructure for digital content. This document describes the threat model, trust assumptions, key management guidance, and explicit non-goals.

## Trust Assumptions

Verity's security relies on the following assumptions:

### 1. Cryptographic Primitives

- **SHA-256** remains collision-resistant and preimage-resistant
- **Ed25519** signatures remain unforgeable under chosen-message attacks
- The implementations used (noble/ed25519, noble/hashes) are correct

### 2. Capture Device Trust

- Trusted capture devices have secure key storage
- Private keys cannot be extracted from trusted devices
- Devices sign content at the moment of capture, not retroactively
- The trusted key list is properly maintained and distributed

### 3. Transparency Log Trust

- The log operator does not collude with attackers to present split views
- The log operator signs checkpoints honestly
- Users verify checkpoint signatures and monitor for consistency
- The append-only property is enforced (entries cannot be removed)

### 4. Time Assumptions

- System clocks are approximately synchronized
- Timestamps are not cryptographically bound (can be falsified by signers)
- Timestamps provide ordering hints, not cryptographic proof of time

## Threat Model

### What Verity DOES Protect Against

| Threat | Protection |
|--------|------------|
| **Post-hoc modification** | Any modification to payload, manifest, or events after signing will invalidate signatures |
| **Payload substitution** | Hash binding ensures payload cannot be swapped |
| **Provenance forgery** | Event chain signatures prevent unauthorized actors from injecting events |
| **Log entry removal** | Merkle tree structure makes deletions detectable via inconsistent roots |
| **Backdating** | Log timestamps provide evidence of when content was submitted (not created) |
| **Silent AI modification** | AI_EDIT events must be added to maintain chain integrity |
| **Signature stripping** | Unsigned containers are not valid Verity containers |

### What Verity DOES NOT Protect Against

| Threat | Limitation |
|--------|------------|
| **Pre-capture manipulation** | If content is manipulated before a trusted device captures it, Verity cannot detect this |
| **Compromised capture keys** | If a trusted device's private key is stolen, attackers can create fraudulent CAPTURE events |
| **Sophisticated deepfakes** | Verity verifies provenance, not content authenticity. A deepfake captured by a trusted device would be marked as human-origin |
| **Colluding log operator** | A malicious log operator can present different views to different users |
| **Timestamp falsification** | Signers can claim any timestamp; only log submission time is independently verifiable |
| **Coerced signing** | If a legitimate signer is coerced, they can create valid signatures for fraudulent content |
| **Side-channel attacks** | Implementation-specific vulnerabilities in key handling |

## Key Management

### Key Types

1. **Root Key** - Organization-level identity key
   - Highest security: HSM or secure enclave recommended
   - Used to sign device keys (certificate chain)
   - Rarely used, heavily protected

2. **Capture Device Key** - Per-device signing key
   - Moderate security: secure key storage on device
   - Used for CAPTURE events
   - Should be rotated periodically or on device compromise

3. **Log Key** - Transparency log signing key
   - High security: HSM recommended
   - Used to sign checkpoints
   - Compromise allows log operator to forge history

### Key Storage Recommendations

| Environment | Recommendation |
|-------------|----------------|
| Development | File-based keys (as in this POC) |
| Production (Cloud) | Cloud KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault) |
| Production (On-prem) | Hardware Security Module (HSM) |
| Mobile Devices | Secure Enclave / TrustZone / StrongBox |

### Key Rotation

- Capture device keys: Rotate annually or on suspected compromise
- Log keys: Rotation requires careful coordination to maintain trust chain
- Root keys: Minimize rotation; revocation is preferable to rotation

### Revocation

This POC does not implement key revocation. Production systems should:

1. Maintain a Certificate Revocation List (CRL) or OCSP responder
2. Check revocation status during verification
3. Consider revocation time when evaluating historical signatures

## Attack Scenarios

### Scenario 1: Fraudulent Vendor Bank Change

**Attack:** Attacker sends a convincing but fraudulent bank change request.

**Verity Mitigation:**
- If no Verity container: Policy can require Verity-wrapped documents
- If container lacks CAPTURE event: Human-origin = UNAVAILABLE, triggering extra verification
- If AI-generated: Human-origin = NO, BLOCK decision
- If from untrusted device: Human-origin = UNAVAILABLE, requires callback

### Scenario 2: Deepfake Evidence

**Attack:** Attacker creates a deepfake video and wraps it in a Verity container.

**Verity Mitigation:**
- Without trusted CAPTURE event: Human-origin = UNAVAILABLE
- Low confidence score (no provenance)
- Policy escalates to human review or SIU

**Limitation:** If attacker has access to a compromised trusted device key, Verity cannot detect this.

### Scenario 3: Backdated Document

**Attack:** Attacker creates a document today but claims it was created last month.

**Verity Mitigation:**
- Timestamps in events are signer-claimed (not verified)
- BUT: Log submission timestamp is independently verifiable
- Discrepancy between claimed time and log time is detectable
- Policies can require recent log submission

### Scenario 4: Man-in-the-Middle Modification

**Attack:** Attacker intercepts container and modifies content.

**Verity Mitigation:**
- Any modification invalidates signatures
- Payload hash mismatch detected
- Verification fails with BLOCK decision

## Limitations and Non-Goals

### Explicit Non-Goals

1. **Perfect deepfake detection** - Verity is not an AI content detector. It verifies provenance, not content authenticity.

2. **Absolute truth** - Verity cannot determine if content depicts reality, only whether its chain of custody is verifiable.

3. **Hardware TEE integration** - This POC simulates trusted capture; production requires actual secure hardware.

4. **WebAuthn/FIDO attestation** - Not implemented in this POC but compatible with the architecture.

5. **Decentralized consensus** - The transparency log is centralized (like Certificate Transparency). Decentralization is a non-goal for this POC.

6. **Real-time detection** - Verification happens at decision time, not during content creation.

### Design Trade-offs

| Trade-off | Decision | Rationale |
|-----------|----------|-----------|
| Centralized vs. Decentralized log | Centralized | Simpler, proven (CT model), lower latency |
| Binary vs. Probabilistic provenance | Both | Binary for human-origin, probabilistic for confidence |
| Embedded vs. Detached signatures | Embedded | Self-contained verification, easier distribution |
| Online vs. Offline verification | Both | Log proof enables offline; online provides latest state |

## Incident Response

### If a Capture Key is Compromised

1. Immediately revoke the key
2. Notify users/systems trusting that key
3. Review recent containers signed by that key
4. Issue new key to affected device
5. Update trusted key lists

### If the Log Key is Compromised

1. This is a critical incident
2. Rotate log key immediately
3. Publish key rotation announcement
4. All existing proofs remain valid with old key
5. New proofs use new key
6. Consider log restart in extreme cases

### If Container Integrity Fails

1. Do not trust the content
2. Request re-submission with valid container
3. Investigate the source
4. Consider fraud investigation

## Compliance Considerations

Verity can support compliance requirements for:

- **Audit trails** - Event chain provides complete provenance
- **Non-repudiation** - Signatures bind actors to actions
- **Tamper evidence** - Modifications are cryptographically detectable
- **Record integrity** - Hash binding ensures content matches metadata

However, Verity alone does not constitute compliance. Organizations must:

- Properly manage and protect keys
- Implement appropriate policies
- Train users on verification procedures
- Maintain appropriate logging and monitoring

## Future Security Enhancements

The following are not implemented in this POC but would enhance security:

1. **Timestamping Service** - RFC 3161 timestamps from trusted TSAs
2. **Key Revocation** - CRL/OCSP for revoked keys
3. **Hardware Attestation** - Integration with TPM/TEE attestation
4. **Gossip Protocol** - Detect log operator misbehavior
5. **Multi-party Signing** - Require N-of-M signatures for high-value content
6. **Content Analysis Plugins** - Integration with AI detection services

## Conclusion

Verity provides a strong foundation for content verification through cryptographic provenance tracking. However, it is not a silver bullet. Users must understand its limitations and combine it with appropriate operational security measures, training, and complementary controls.

The three-layer model (Reality → Confidence → Context → Action) provides defense in depth:

1. **Provenance** catches obvious forgeries
2. **Confidence** flags suspicious content for review
3. **Context** ensures appropriate verification for each workflow

This layered approach reduces risk while avoiding excessive false positives that would undermine usability.
