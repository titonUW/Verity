# Verity Dashboard

Trust infrastructure dashboard for managing digital content verification.

![Verity Dashboard](./docs/screenshot-placeholder.png)

## Overview

Verity Dashboard is a comprehensive web application for managing content verification, trust scoring, and policy-based decisions. It provides:

- **File Intake**: Drag-and-drop file upload with client-side SHA-256 hashing
- **Verification Engine**: Deterministic 10-signal scoring with explainable results
- **Trust Reports**: Human-Origin Proof, Reality Confidence Score, and Context Decisions
- **Policy Management**: Configurable workflow policies with decision rules
- **Transparency Proofs**: External verifiability via Merkle log proofs
- **Audit Trail**: Append-only log of all system events

## Quick Start

```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Seed sample data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview with KPIs and alerts |
| `/intake` | File upload with workflow selection |
| `/files` | File list with filters |
| `/files/[id]` | Detailed file view with tabs |
| `/policies` | Workflow policy management |
| `/audit` | Audit log viewer |
| `/settings` | System configuration |
| `/verify` | Public third-party verification |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI primitives
- **Database**: SQLite via Prisma
- **Testing**: Vitest, Playwright

## Project Structure

```
dashboard/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Sample data seeder
├── src/
│   ├── app/             # Next.js pages and API routes
│   ├── components/      # React components
│   │   ├── ui/          # Base UI components
│   │   └── layout/      # Layout components
│   ├── lib/             # Utilities and scoring engine
│   └── __tests__/       # Unit tests
├── docs/
│   ├── trust-report.schema.json
│   └── design-tokens.md
└── public/              # Static assets
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed sample data |
| `npm run db:reset` | Reset and reseed database |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |

## Trust Report Structure

Each verified file produces a Trust Report with:

```json
{
  "human_origin_proof": {
    "value": "YES | NO | UNAVAILABLE",
    "reason": "Explanation"
  },
  "reality_confidence": {
    "score": 0-100,
    "grade": "A | B | C | D | F",
    "reasons": [/* signal results */]
  },
  "context_decision": {
    "workflow": "wire-transfer",
    "decision": "ALLOW | WARN | REQUIRE_EXTRA_VERIFICATION | BLOCK",
    "rationale": "Explanation"
  },
  "integrity": {
    "payload_hash_ok": true,
    "manifest_signature_ok": true,
    "event_chain_ok": true,
    "transparency_log_ok": true
  }
}
```

## Scoring Signals

The verification engine evaluates 10 deterministic signals:

1. `payload_hash_match` - File integrity (CRITICAL)
2. `mime_type_recognized` - Valid file type (LOW)
3. `timestamp_sanity` - Timestamp validation (MEDIUM)
4. `capture_event_present` - Provenance origin (HIGH)
5. `event_chain_continuity` - Chain of custody (HIGH)
6. `signature_validity` - Cryptographic signatures (HIGH)
7. `transparency_log_proof` - Log registration (MEDIUM)
8. `ai_edit_detection` - AI modification check (CRITICAL)
9. `file_size_reasonable` - Size validation (LOW)
10. `trusted_capture_device` - Device verification (MEDIUM)

## Workflows

Preconfigured workflow policies:

- **Vendor Bank Change** - Medium security
- **Wire Transfer** - Maximum security
- **HR Offer Letter** - Standard security
- **Insurance Claim** - High security
- **Content Publishing** - Basic security

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# External Services (optional)
VERITY_VERIFY_URL=""
VERITY_LOG_URL=""
VERITY_LOG_PUBLIC_KEY=""
```

## Design System

The dashboard follows the Verity brand guidelines:

- **Primary Blue**: `#005CCE`
- **Secondary Blue**: `#0088CF`
- **Accent Teal**: `#05B8BC`
- **Dark Theme**: Near-black backgrounds with slate cards

See [design-tokens.md](./docs/design-tokens.md) for full details.

## External Verification

The `/verify` page allows third parties to verify files without trusting Verity servers:

1. Export a Verification Bundle from any file detail page
2. Upload the bundle to `/verify`
3. Upload the original file
4. Verify hash match and proof validity locally

## License

Proprietary - Verity Technologies
