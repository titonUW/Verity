# REVIEW_NOTES.md — Verity Dashboard Audit

## Phase 1: Architecture & Purpose Summary

### Purpose
Verity Dashboard is a POC trust infrastructure system for verifying digital content authenticity. It provides:
- File intake with client-side SHA-256 hashing
- Verification pipeline with 10 deterministic signals
- Policy-based decision engine (ALLOW/WARN/REQUIRE/BLOCK)
- Trust reports with Human-Origin Proof and Reality Confidence scores
- Oversight AI agent for monitoring and alerting
- RBAC with ADMIN/ANALYST/VIEWER roles

### Architecture Map
```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│  Next.js 16 App Router · React 19 · TailwindCSS 4       │
├─────────────────────────────────────────────────────────┤
│                    API Layer (Server)                    │
│  /api/intake   — File intake                            │
│  /api/verify   — Verification pipeline                  │
│  /api/files    — File listing/details                   │
│  /api/alerts   — Agent alerts                           │
│  /api/agent    — Agent run/reports                      │
│  /api/auth     — Session management                     │
│  /api/audit    — Audit log                              │
│  /api/policies — Policy management                      │
│  /api/stats    — Dashboard statistics                   │
├─────────────────────────────────────────────────────────┤
│                    Domain Logic                          │
│  lib/scoring.ts — 10 signals, policy evaluation         │
│  lib/agent.ts   — Oversight agent (collector/analyzer)  │
│  lib/rbac.ts    — Role-based access control             │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                            │
│  Prisma 5 ORM · SQLite (dev.db)                         │
│  14 models including FileRecord, TrustReport,           │
│  AgentReport, AgentAlert, User                          │
└─────────────────────────────────────────────────────────┘
```

### Core Invariants
1. Files must have valid SHA-256 hash (64 hex characters)
2. Files must be assigned to a known workflow
3. Verification must produce a TrustReport with score 0-100
4. Policy decisions must be one of: ALLOW, WARN, REQUIRE_EXTRA_VERIFICATION, BLOCK
5. Audit log must be append-only
6. Agent is read-only with respect to business data

### Technology Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI:** TailwindCSS 4, Radix UI primitives
- **Database:** Prisma 5 + SQLite
- **Testing:** Vitest
- **Package Manager:** npm

---

## Phase 2: Baseline Test Results

### Initial Test Run
```
Test Files: 3 passed (3)
Tests: 41 passed (41)
- scoring.test.ts: 15 tests
- agent.test.ts: 15 tests
- rbac.test.ts: 11 tests
```

**Coverage:** Not measured (no coverage configuration)

### Pre-existing Bugs Found
None — all existing tests pass against unmodified code.

---

## Phase 3: Issue Catalog

### Critical Issues

| # | File | Line | Category | Description |
|---|------|------|----------|-------------|
| 1 | src/app/intake/page.tsx | 92-93 | Correctness | Generic error thrown without extracting actual error message from response |
| 2 | src/app/api/intake/route.ts | 63-68 | Reliability | Generic error response hides actual failure reason from users |
| 3 | src/app/api/intake/route.ts | 21-26 | Correctness | No validation of field types/formats (sha256, size, workflow) |

### Major Issues

| # | File | Line | Category | Description |
|---|------|------|----------|-------------|
| 4 | src/app/api/intake/route.ts | 14 | Security | workflow not validated against known values |
| 5 | src/app/api/intake/route.ts | 13 | Security | sha256 not validated as 64-char hex string |
| 6 | src/app/api/intake/route.ts | 12 | Correctness | size not validated as positive integer |

### Minor Issues

| # | File | Line | Category | Description |
|---|------|------|----------|-------------|
| 7 | src/app/api/intake/route.ts | 64 | Maintainability | Error logged without stack trace |

---

## Phase 4: Fix Log

### Issue #1 — Client error handling (FIXED)
**File:** `src/app/intake/page.tsx`
**Fix:** Extract actual error message from response body when `!intakeRes.ok` and `!verifyRes.ok`
**Test:** Manual verification — errors now display actual server message

### Issue #2 — Generic server error response (FIXED)
**File:** `src/app/api/intake/route.ts`
**Fix:** Return specific error messages including the actual error reason. Added detection for Prisma unique constraint errors.
**Test:** `intake.test.ts` — 13 tests verify error responses

### Issue #3 — Missing input validation (FIXED)
**File:** `src/app/api/intake/route.ts`
**Fix:** Added comprehensive validation for all fields:
- `filename`: non-empty string
- `size`: positive integer, max 100MB
- `sha256`: exactly 64 hex characters (case-insensitive)
- `workflow`: must be one of 5 known workflows
- `mime`: non-empty string
- JSON body parsing with error handling
**Test:** `intake.test.ts` — 13 tests cover all validation cases

### Issue #4 — Workflow validation (FIXED)
**File:** `src/app/api/intake/route.ts`
**Fix:** Validate workflow against `WORKFLOWS` array from types.ts
**Test:** `intake.test.ts` — tests reject unknown workflow, accept all 5 valid workflows

### Issue #5 — SHA-256 validation (FIXED)
**File:** `src/app/api/intake/route.ts`
**Fix:** Added regex validation: `/^[a-f0-9]{64}$/i`
**Test:** `intake.test.ts` — tests reject invalid/short hashes, accept valid hashes

### Issue #6 — Size validation (FIXED)
**File:** `src/app/api/intake/route.ts`
**Fix:** Validate size is positive integer between 1 and 100MB
**Test:** `intake.test.ts` — tests reject negative, zero, and oversized values

### Issue #7 — Error logging (FIXED)
**File:** `src/app/api/intake/route.ts`
**Fix:** Log error stack trace when available
**Test:** Manual verification

---

## Phase 5: Final Verification

### Test Results
```
Test Files: 4 passed (4)
Tests: 54 passed (54)
- scoring.test.ts: 15 tests
- agent.test.ts: 15 tests
- rbac.test.ts: 11 tests
- intake.test.ts: 13 tests (NEW)
```

### Build Status
✅ Production build succeeded (Next.js 16.1.6)

### Code Review
- No debug code left behind
- No TODOs or commented-out blocks introduced
- Style consistent with existing codebase
- No new issues introduced

---

## Phase 6: Summary Report

### 1. Baseline Snapshot
- **Test count:** 41
- **Pass/fail:** 41/0
- **Coverage:** Not measured

### 2. Issues Found
| Category | Critical | Major | Minor | Total |
|----------|----------|-------|-------|-------|
| Correctness | 2 | 1 | 0 | 3 |
| Security | 0 | 2 | 0 | 2 |
| Reliability | 1 | 0 | 0 | 1 |
| Maintainability | 0 | 0 | 1 | 1 |
| **Total** | **3** | **3** | **1** | **7** |

### 3. Issues Fixed
1. ✅ Client error handling — extract actual error from response
2. ✅ Server error response — return specific error messages
3. ✅ Input validation — validate all required fields
4. ✅ Workflow validation — check against known workflows
5. ✅ SHA-256 validation — enforce 64-char hex format
6. ✅ Size validation — enforce positive integer within bounds
7. ✅ Error logging — include stack trace

### 4. Issues Deferred
None — all issues fixed.

### 5. Final Snapshot
- **Test count:** 54 (+13)
- **Pass/fail:** 54/0
- **Coverage:** Not measured

### 6. Net Improvement
- **Test delta:** +13 new tests
- **Pass rate:** 100% (maintained)
- **Issues resolved:** 7/7 (100%)

### 7. Remaining Risks
- **No authentication enforcement:** While RBAC logic exists, the POC defaults to admin access when no session cookie is set
- **No rate limiting:** API endpoints have no rate limiting
- **SQLite single-file database:** No replication or backup strategy

### 8. Recommendations
1. **Add authentication:** Integrate NextAuth or similar for production
2. **Add rate limiting:** Use middleware to prevent API abuse
3. **Add coverage measurement:** Configure Vitest coverage to track test coverage
4. **Database migrations:** Move from `prisma db push` to proper migrations
5. **E2E tests:** Add Playwright tests for critical user flows
