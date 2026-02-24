# Verity Dashboard — Architecture Audit

## 1. Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  Next.js App Router  ·  React 19  ·  TailwindCSS 4          │
│  Radix UI primitives · Lucide icons · Recharts               │
├─────────────────────────────────────────────────────────────┤
│                     API Layer (Server)                        │
│  Next.js Route Handlers  (src/app/api/*)                     │
│  ┌──────────┬──────────┬────────┬──────────┬──────────┐     │
│  │ /intake  │ /files   │ /stats │ /audit   │/policies │     │
│  │ /verify  │ /files/id│        │          │          │     │
│  └──────────┴──────────┴────────┴──────────┴──────────┘     │
├─────────────────────────────────────────────────────────────┤
│                     Domain Logic                             │
│  lib/scoring.ts — 10 signals, scoring, policy evaluation     │
│  lib/types.ts   — shared TypeScript definitions              │
│  lib/utils.ts   — helpers (cn, formatDate)                   │
│  lib/prisma.ts  — singleton Prisma client                    │
├─────────────────────────────────────────────────────────────┤
│                     Data Layer                               │
│  Prisma 5 ORM  ·  SQLite (dev.db)                            │
│  12 models: FileRecord, VerificationRun, TrustReport,        │
│  SignalResult, ProvenanceEvent, PolicyWorkflow,              │
│  PolicyVersion, PolicyDecision, TransparencyProof,           │
│  AuditLog, TrustedKey, SystemSetting, User                   │
└─────────────────────────────────────────────────────────────┘

Separate packages (not wired to dashboard yet):
  packages/verity-file    — container format (.verity ZIP)
  packages/verity-log     — transparency log service
  packages/verity-verify  — verification engine
  packages/verity-cli     — command-line tool
```

## 2. Key User Roles

| Role    | Description                                  | Current State       |
|---------|----------------------------------------------|---------------------|
| ADMIN   | Full access, settings, user management       | Defined in User model; no enforcement |
| ANALYST | Run verifications, view reports              | Defined in User model; no enforcement |
| VIEWER  | Read-only access                             | Defined in User model; no enforcement |

**Primary workflows:**
1. **Intake** — upload file → compute SHA-256 → store FileRecord
2. **Verify** — trigger verification → 10 signals → score → policy decision → trust report
3. **Review** — browse files → filter → view details + 5-tab breakdown
4. **Policy management** — view/create workflow policy versions
5. **Audit** — browse append-only event log with filtering + CSV export
6. **Public verify** — third-party verification (upload bundle + file)

## 3. Biggest Risks

### Security
- **No authentication or authorization**: Every API route is publicly accessible. The User model defines roles but nothing enforces them.
- **No CSRF protection**: POST routes accept JSON with no token validation.
- **No input sanitization**: API routes do basic checks but no schema validation (e.g., Zod).
- **SQLite file on disk**: Accessible to any process on the host.

### Privacy
- **Submitter field stored in plaintext**: No redaction or pseudonymization.
- **Audit log stores actor names**: In a production system this may constitute PII.
- **No data retention policy**: Files and logs accumulate indefinitely.

### Reliability
- **Single SQLite database**: No replication, no backup strategy.
- **No queue or background jobs**: Verification runs synchronously in API route handlers.
- **No health check endpoint**: The "System Online" indicator in the sidebar is static, not derived from actual health.

### Performance
- **Client-side fetching on every page mount**: No caching, SWR, or React Query. Every navigation re-fetches.
- **No pagination on overview page**: Stats endpoint aggregates all records on every call.
- **Full JSON trust reports stored as TEXT**: Large reports may slow queries.

## 4. Quick Wins vs. Longer-Term Refactors

### Quick wins (hours)
- Add cookie-based RBAC middleware to protect admin routes
- Add proper loading skeletons and error boundaries
- Fix the static "System Online" indicator to reflect actual DB connectivity
- Add keyboard navigation and ARIA labels to sidebar and tables
- Replace `useEffect` fetch patterns with a shared `useFetch` hook to reduce boilerplate

### Longer-term (days)
- Integrate Zod validation on all API routes
- Add a background job system for verification (queue + worker)
- Wire the dashboard to real `verity-verify` and `verity-log` packages
- Implement real authentication (e.g., NextAuth)
- Add database migrations (currently using `prisma db push` only)
- Add observability: structured logging, metrics, tracing
