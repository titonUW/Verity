# Verity

**Trust infrastructure for digital content.**

> Verifies reality before decisions are made.

Verity is a proof-of-concept system that provides cryptographically verified provenance for digital files (video, audio, text, documents). It outputs:

1. **Human-Origin Proof**: Was this captured/created through a verified human-only pipeline? `YES` / `NO` / `UNAVAILABLE`
2. **Reality Confidence Score**: `0-100` with explanations
3. **Context Policy Decision**: `ALLOW` / `WARN` / `REQUIRE_EXTRA_VERIFICATION` / `BLOCK`

## Architecture

Verity implements a 3-layer verification loop:

```
Reality → Confidence → Context → Action
   ↓          ↓           ↓         ↓
Binary    Probabilistic  Policy   Decision
Truth       Score        Rules    Output
```

### Packages

| Package | Description |
|---------|-------------|
| `@verity/file` | Container format library - wrap and verify tamper-evident files |
| `@verity/log` | Transparency log service - Certificate Transparency-style Merkle tree |
| `@verity/verify` | Verification engine - produces Trust Reports |
| `@verity/cli` | Command-line interface for all operations |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/verity.git
cd verity

# Install dependencies
npm install

# Build all packages
npm run build
```

### Run the Demo

```bash
npm run demo
```

This will:
1. Generate development keys
2. Wrap a sample document into a Verity container
3. Verify container integrity
4. Publish to transparency log
5. Generate a Trust Report
6. Demonstrate tamper detection

### Run Tests

```bash
npm test
```

## Usage

### CLI Commands

```bash
# Generate keys (first time setup)
npx verity keygen

# Wrap a file
npx verity wrap document.pdf
# Creates: document.pdf.verity

# Verify a container
npx verity verify document.pdf.verity

# Publish to transparency log
npx verity publish document.pdf.verity --log-url http://localhost:3001

# Verify log proof offline
npx verity prove document.pdf.verity

# Generate Trust Report
npx verity report document.pdf.verity

# Evaluate against a workflow policy
npx verity policy-eval document.pdf.verity vendor-bank-change

# View container info
npx verity info document.pdf.verity
```

### External Verification

Third parties can verify containers without trusting Verity servers:

```bash
node packages/verity-cli/dist/verify-external.js \
  document.pdf.verity \
  <log_public_key_hex>
```

This performs offline verification using only:
- The container file
- The log's public key

No network calls are made.

## Verity Container Format

A `.verity` file is a ZIP archive containing:

```
container.verity
├── payload.bin          # Original file
├── manifest.json        # Metadata + hash
├── events.json          # Provenance chain
├── signatures.json      # Ed25519 signatures
├── log_proof.json       # [Optional] Transparency log proof
└── trust_report.json    # [Optional] Trust Report
```

See [docs/spec.md](docs/spec.md) for the complete specification.

## Workflow Policies

Verity includes 4 example policies:

| Policy | Use Case | Requirements |
|--------|----------|--------------|
| `vendor-bank-change` | Vendor banking changes | Human origin + Log + High confidence |
| `wire-transfer` | Wire transfer authorization | Maximum security |
| `hr-offer-letter` | Employment offers | Moderate confidence |
| `insurance-evidence` | Claim evidence intake | Fraud detection |

Policies are YAML files in `/policies`. See examples there.

## Trust Report

The Trust Report JSON includes:

```json
{
  "human_origin_proof": {
    "value": "YES",
    "reason": "Verified human capture with no AI modifications",
    "evidence": { ... }
  },
  "reality_confidence": {
    "score": 85,
    "reasons": [ ... signals ... ],
    "limitations": "..."
  },
  "context_decision": {
    "workflow": "vendor-bank-change",
    "decision": "ALLOW",
    "rationale": "All verification requirements satisfied"
  },
  "integrity": {
    "payload_hash_ok": true,
    "manifest_signature_ok": true,
    "event_chain_ok": true,
    "transparency_log_ok": true
  }
}
```

See [docs/trust-report.schema.json](docs/trust-report.schema.json) for the schema.

## API Reference

### Log Service (port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/entries` | POST | Add entry to log |
| `/checkpoint` | GET | Get current signed checkpoint |
| `/proof/:index` | GET | Get inclusion proof |
| `/entry/:index` | GET | Get entry data |

### Verify Service (port 3002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | POST | Verify container, return Trust Report |

See [docs/openapi.yaml](docs/openapi.yaml) for the complete API specification.

## Security Model

### What Verity Protects Against

- Post-hoc modification (tampering)
- Payload substitution
- Provenance forgery
- Log entry removal
- Silent AI modification

### What Verity Does NOT Protect Against

- Pre-capture manipulation
- Compromised capture keys
- Sophisticated deepfakes (captured by trusted device)
- Colluding log operator

See [docs/security.md](docs/security.md) for the complete threat model.

## Non-Goals

This POC explicitly does NOT aim to provide:

- Perfect deepfake detection
- Absolute truth verification
- Real hardware TEE integration
- Production-ready key management
- Decentralized consensus

Verity is trust infrastructure, not truth infrastructure.

## Development

### Project Structure

```
verity/
├── packages/
│   ├── verity-file/      # Container library
│   ├── verity-log/       # Transparency log
│   ├── verity-verify/    # Verification engine
│   └── verity-cli/       # CLI tool
├── policies/             # Workflow policies
├── samples/              # Sample files
├── scripts/              # Demo and utilities
├── docs/                 # Documentation
└── devkeys/              # Development keys (gitignored)
```

### Building

```bash
npm run build        # Build all packages
npm run clean        # Remove build artifacts
```

### Testing

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode
```

### Key Management

Development keys are stored in `/devkeys` (gitignored):

- `root.key.json` - Root/organization key
- `capture.key.json` - Capture device key
- `log.key.json` - Transparency log key

**Never commit private keys to the repository.**

## Design Decisions

### Why Not Blockchain?

Verity uses a Certificate Transparency-style Merkle log instead of blockchain because:

1. **Simplicity**: No consensus mechanism needed
2. **Performance**: Immediate inclusion without mining
3. **Proven**: CT has secured billions of certificates since 2013
4. **Auditability**: Same Merkle proof guarantees

The append-only property comes from cryptographic commitments (signed checkpoints), not economic incentives.

### Why Embedded Signatures?

Signatures are embedded in the container (not detached) because:

1. Self-contained verification
2. Easier distribution
3. No external dependencies for verification

### Why Ed25519?

- Fast signing and verification
- Small keys (32 bytes) and signatures (64 bytes)
- Battle-tested in production systems
- No need for complex curve selection

## License

MIT

## Contributing

Contributions welcome! Please read the security considerations in [docs/security.md](docs/security.md) before contributing.

---

**Verity** - *Trust infrastructure for digital content*

Website: verity.ai | Email: contact@verity.ai
