# Verity Dashboard — Development Setup

## Prerequisites

- **Node.js** 20+ (`node --version`)
- **npm** 10+ (`npm --version`)

## Quick Start

```bash
cd dashboard
npm install
npm run db:push       # Create/sync database
npm run db:seed       # Seed 20 sample files + users + agent report
npm run dev           # Start dev server at http://localhost:3000
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run all unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:push` | Push Prisma schema to SQLite |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:reset` | Reset + re-seed database |
| `npm run db:generate` | Regenerate Prisma client |

## Database

SQLite database stored at `prisma/dev.db`. Reset anytime with:

```bash
npm run db:reset
```

## Running the Oversight Agent

The agent can be triggered from the dashboard or via API:

**From the dashboard:**
1. Navigate to `/reports` (Agent Reports page)
2. Click "Run Agent Now"

**From the API:**
```bash
curl -X POST http://localhost:3000/api/agent/run
```

**What the agent does:**
1. Reads from existing tables (read-only): AuditLog, FileRecord, PolicyDecision, etc.
2. Runs heuristic rules to detect issues (block spikes, low confidence, chain breaks)
3. Generates a digest report with metrics, alerts, and recommendations
4. Writes results to AgentReport and AgentAlert tables

## User Accounts (POC)

Seeded users for testing RBAC:

| Email | Role | Capabilities |
|-------|------|-------------|
| `admin@verity.local` | ADMIN | Full access, agent control, alert acknowledgment |
| `analyst@verity.local` | ANALYST | View reports/alerts, intake files, run verifications |
| `viewer@verity.local` | VIEWER | Read-only access to dashboard, files, audit log |

**Switch users** via the session API:
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@verity.local"}'

# Login as viewer (restricted)
curl -X POST http://localhost:3000/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@verity.local"}'
```

Note: When no session cookie is set, the system defaults to admin access for demo purposes.

## Environment Variables

File: `dashboard/.env`

```bash
# Required
DATABASE_URL="file:./dev.db"

# Optional — external services
VERITY_VERIFY_URL=""
VERITY_LOG_URL=""
VERITY_LOG_PUBLIC_KEY=""

# Optional — LLM-enhanced agent reports
OVERSIGHT_LLM_API_KEY=""        # OpenAI-compatible API key
OVERSIGHT_LLM_MODEL="gpt-4o-mini"

# App metadata
NEXT_PUBLIC_APP_NAME="Verity Dashboard"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

## Running Tests

```bash
# All tests (41 tests across 3 suites)
npm run test

# Watch mode
npm run test:watch
```

Test suites:
- `scoring.test.ts` — Scoring engine (15 tests)
- `agent.test.ts` — Oversight agent heuristics (15 tests)
- `rbac.test.ts` — Role-based access control (11 tests)

## Project Structure

```
dashboard/
├── prisma/
│   ├── schema.prisma      # Database schema (14 models)
│   ├── seed.ts            # Seed script
│   └── dev.db             # SQLite database
├── src/
│   ├── app/               # Next.js pages + API routes
│   │   ├── page.tsx       # Overview dashboard
│   │   ├── alerts/        # Alerts page
│   │   ├── reports/       # Agent Reports page
│   │   ├── intake/        # File upload
│   │   ├── files/         # File list + detail
│   │   ├── policies/      # Policy management
│   │   ├── audit/         # Audit log
│   │   ├── settings/      # System settings
│   │   ├── verify/        # Public verification
│   │   └── api/           # API route handlers
│   ├── components/        # UI + layout components
│   ├── lib/
│   │   ├── scoring.ts     # 10-signal scoring engine
│   │   ├── agent.ts       # Oversight AI agent
│   │   ├── rbac.ts        # RBAC middleware
│   │   ├── prisma.ts      # Database client
│   │   ├── types.ts       # TypeScript definitions
│   │   └── utils.ts       # Utilities
│   └── __tests__/         # Test suites
└── docs/                  # Design documents
```
