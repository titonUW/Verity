# Oversight AI Agent — Design Document

## Overview

The Oversight Agent is a background service that monitors the Verity system and produces reports for administrators. It is **read-only** — it never modifies business records (files, verification runs, trust reports). It only writes to its own tables (`AgentReport`, `AgentAlert`).

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 Verity Database                    │
│  AuditLog, FileRecord, PolicyDecision, etc.       │
│  (read-only access for the agent)                 │
├──────────────────────────────────────────────────┤
│              Oversight Agent                      │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  Collector  │→│  Analyzer   │→│  Reporter  │ │
│  │ (query DB)  │ │ (heuristics)│ │ (write     │ │
│  │             │ │ (LLM opt.)  │ │  reports)  │ │
│  └────────────┘  └─────────────┘  └───────────┘ │
├──────────────────────────────────────────────────┤
│              Agent Tables (write)                 │
│  AgentReport — periodic digests                   │
│  AgentAlert  — high-severity real-time alerts     │
└──────────────────────────────────────────────────┘
```

## Database Models

### AgentReport
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| reportType | String | DAILY_DIGEST, WEEKLY_SUMMARY, AD_HOC |
| severity | String | INFO, WARNING, CRITICAL |
| title | String | Human-readable title |
| summary | String | Report summary text |
| detailsJson | String | Full structured report (JSON) |
| eventCount | Int | Number of source events analyzed |
| periodStart | DateTime | Analysis window start |
| periodEnd | DateTime | Analysis window end |
| generatedBy | String | "heuristic" or "llm:<model>" |
| promptTemplate | String? | Template used (if LLM mode) |
| tokenCount | Int? | Tokens used (if LLM mode) |
| createdAt | DateTime | Report creation timestamp |

### AgentAlert
| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| alertType | String | Category (BLOCK_SPIKE, LOW_CONFIDENCE, CHAIN_BREAK, etc.) |
| severity | String | WARNING, CRITICAL |
| title | String | Short description |
| message | String | Detail message |
| entityType | String? | Related entity type |
| entityId | String? | Related entity ID |
| acknowledged | Boolean | Whether admin has seen it |
| acknowledgedBy | String? | Who acknowledged |
| acknowledgedAt | DateTime? | When acknowledged |
| createdAt | DateTime | Alert creation timestamp |

## Agent Capabilities

### 1. Event Collection (Collector)

Reads from existing tables (read-only):
- `AuditLog` — system events since last analysis
- `FileRecord` — new files, status changes
- `PolicyDecision` — recent decisions (especially BLOCK/WARN)
- `SignalResult` — signal failures
- `ProvenanceEvent` — chain integrity issues

### 2. Heuristic Analysis (Analyzer)

Rules evaluated on every run:

| Rule ID | Condition | Severity | Alert Type |
|---------|-----------|----------|------------|
| BLOCK_SPIKE | >2 BLOCKs in analysis period | CRITICAL | BLOCK_SPIKE |
| LOW_AVG_CONFIDENCE | Average confidence <60 for period | WARNING | LOW_CONFIDENCE |
| CHAIN_INTEGRITY_FAIL | Any provenance event with valid=false | CRITICAL | CHAIN_BREAK |
| FAILED_VERIFICATION | Any file with status=FAILED | WARNING | VERIFICATION_FAILURE |
| HIGH_VOLUME | >50 files ingested in period | INFO | HIGH_VOLUME |
| NO_ACTIVITY | 0 files in 24h period | WARNING | NO_ACTIVITY |
| POLICY_CHANGE | Any POLICY_CHANGE audit event | INFO | POLICY_CHANGE |

### 3. Report Generation (Reporter)

**Heuristic mode (default, no API key needed):**
- Aggregates metrics: file counts by decision, average confidence, top signal failures
- Applies rules above to generate alerts
- Produces structured digest with sections: Summary, Metrics, Alerts, Recommendations

**LLM mode (optional, requires OVERSIGHT_LLM_API_KEY):**
- Uses heuristic output as context
- Generates a narrative summary via OpenAI-compatible API
- Prompt template stored for auditability
- PII redacted: filenames shortened, submitter field omitted from prompts
- Token count stored for cost tracking

## Safety & Privacy

### Read-only guarantee
The agent writes ONLY to `AgentReport` and `AgentAlert` tables. It has no access to modify `FileRecord`, `TrustReport`, `PolicyDecision`, or any other business data.

### RBAC
- Agent Reports page: accessible to ADMIN and ANALYST roles only
- Alert acknowledgment: ADMIN only
- Agent configuration: ADMIN only

### PII minimization
- Filenames are included in reports but submitter names are redacted
- No raw file content is ever accessed
- LLM prompts contain only aggregated metrics, never individual user data
- Audit trail records who viewed each report

### Transparency
- Every report stores: generation method, prompt template (if LLM), model name, token count
- Alerts link back to source entities for drill-down
- Configuration changes are logged to AuditLog

## Execution Model

### Trigger: API endpoint
`POST /api/agent/run` — triggers a digest generation for the specified period.
Protected by RBAC (ADMIN only).

### Configuration
Stored in `SystemSetting` table or environment variables:

| Setting | Default | Description |
|---------|---------|-------------|
| AGENT_ENABLED | true | Feature flag |
| AGENT_DIGEST_HOURS | 24 | Hours to look back for digest |
| AGENT_BLOCK_THRESHOLD | 2 | Blocks to trigger BLOCK_SPIKE |
| AGENT_LOW_CONFIDENCE_THRESHOLD | 60 | Score threshold for LOW_CONFIDENCE |
| OVERSIGHT_LLM_API_KEY | (none) | Optional LLM API key |
| OVERSIGHT_LLM_MODEL | gpt-4o-mini | Model to use for narrative |

## Admin Dashboard Integration

### Agent Reports Page (`/reports`)
- Table of reports: date, type, severity, title, event count
- Click to view full report with structured sections
- Filter by severity and date range

### Alerts Page (`/alerts`)
- Real-time alert list with severity badges
- Acknowledge button (ADMIN only)
- Link to source entity for investigation
- Filter by type, severity, acknowledged status

### Overview Integration
- "Agent Status" widget showing last report time and alert count
- Top 3 unacknowledged alerts displayed prominently

## Testing Strategy

- **Unit tests**: Heuristic analyzer rules (given events → expected alerts)
- **Unit tests**: Report generation (given metrics → expected digest structure)
- **Integration tests**: API endpoint RBAC (admin can run, viewer cannot)
- **Integration tests**: Full pipeline (seed data → run agent → verify report stored)
