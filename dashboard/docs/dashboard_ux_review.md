# Verity Dashboard — UX Review & Improvement Plan

## Current State Assessment

### Information Architecture
**Problem:** The Overview page treats all 6 KPI cards equally, but "Blocked" files and "Warnings" are what operators act on. The decision distribution uses progress bars rather than a real chart, making proportions hard to read. The "Active Workflows" section is hardcoded and non-interactive.

**Problem:** There is no "Alerts" or "Reports" concept. The sidebar has 6 items but no grouping by task (monitoring vs. management vs. configuration). An admin/oversight user has no dedicated view.

### Clarity / Scanability
- Decision badges are well-colored (green/yellow/orange/red) — this is good.
- The Overview page shows counts but no trends or sparklines — hard to tell if things are getting better or worse.
- File detail page (5 tabs) is thorough but dense. No summary card at the top before tabs.
- Audit log shows raw JSON in `details` field — not human-readable.

### Interaction Design
- **Empty states** exist on some pages (audit, files) but are inconsistent. Overview shows "No Files Yet" alert but no call-to-action button.
- **Loading states** are plain text ("Loading files...") — no skeleton screens.
- **Error states** are missing entirely. Failed fetches are silently logged to console.
- **No breadcrumbs** on detail pages — navigating back requires sidebar click.

### Responsiveness
- Sidebar is fixed 64px (w-64) with no collapse. On mobile, it pushes content off screen.
- KPI grid goes to single column on mobile — acceptable.
- File table does not horizontally scroll on small screens.

### Accessibility
- Sidebar links lack `aria-current` for active route.
- No skip-to-content link.
- Table rows have no keyboard interaction.
- Color is used as the sole indicator for severity/decision in several places (progress bars, badges). Users with color vision deficiency get no textual or icon fallback for the progress bars.
- No `<main>` landmark on content area.

### Performance
- Every page remounts and re-fetches on navigation (no cache layer).
- Stats endpoint does full table scan on every call.
- No debounce on search inputs.

---

## Proposed Improvements (Implemented)

### Navigation Overhaul
**Before:** Flat list of 6 main + 1 external link.
**After:** Grouped sidebar with sections:
- **Monitor** — Overview, Alerts
- **Manage** — File Intake, Files, Policies
- **Oversight** — Agent Reports (admin only)
- **System** — Audit Log, Settings
- **External** — Public Verify

Added admin-only badge on Agent Reports link. Added collapsible sidebar for mobile.

### Overview Page
**Before:** 6 equal KPI cards + progress bars + static alerts.
**After:**
- System health indicator (real DB check) at top
- 4 primary KPI cards with clearer hierarchy
- Decision distribution with actual counts and percentages
- Real recent alerts from database (last blocked/warned files)
- "Quick Actions" section linking to common tasks

### Loading & Error States
**Before:** Text-only "Loading..." / silent console.error.
**After:**
- Skeleton pulse animations for cards and tables during load
- Error boundary with retry button
- Consistent empty state components with CTA buttons

### Accessibility
- Added `<main>` landmark with `role="main"` to content area
- Added `aria-current="page"` to active sidebar link
- Added skip-to-content link
- Decision badges include text labels alongside color
- Focus-visible outlines on all interactive elements

### Admin Oversight View (New)
- **Agent Reports page** — shows AI-generated digests and alerts
- **Alerts page** — real-time high-severity items with filtering
- Both pages protected by RBAC (admin/analyst only)

### Responsive Improvements
- Sidebar collapses to icon-only on tablet, hidden with hamburger on mobile
- Tables use horizontal scroll wrapper on small screens
- KPI cards reflow to 2-column on tablet, 1-column on mobile
