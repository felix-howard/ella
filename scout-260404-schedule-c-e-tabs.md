# Schedule C & Schedule E Tabs - Complete File Inventory

**Date:** 2026-04-04
**Status:** All files identified and mapped

## Executive Summary

Schedule C and Schedule E tabs are conditionally visible components in the client detail page. Schedule C appears only when 1099-NECs are verified OR Schedule C already exists. Schedule E is always visible.

## 1. Client Detail Page (Main Container)

File: `/apps/workspace/src/routes/clients/$clientId.tsx`
- Lines 312-315: Schedule C visibility control via useScheduleC hook
- Line 471: Conditional Schedule C tab display
- Line 475: Schedule E always visible
- Lines 758-774: Tab content rendering

## 2. Schedule C Tab Visibility Hook

File: `/apps/workspace/src/hooks/use-schedule-c.ts`
- Critical logic: showScheduleCTab = has1099NEC || !!scheduleCData?.expense
- Checks for verified FORM_1099_NEC documents
- Fetches Schedule C expense data

## 3. Schedule E Tab Hook

File: `/apps/workspace/src/hooks/use-schedule-e.ts`
- No conditional visibility
- Always renders tab

## Frontend Components

### Schedule C Tab (13 files total)
1. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/index.tsx`
2. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-empty-state.tsx`
3. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-waiting.tsx`
4. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-summary.tsx`
5. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-actions.tsx`
6. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/income-table.tsx`
7. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/expense-table.tsx`
8. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/net-profit-card.tsx`
9. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/status-badge.tsx`
10. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/nec-breakdown-list.tsx`
11. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/version-history.tsx`
12. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/format-utils.ts`
13. `/apps/workspace/src/components/cases/tabs/schedule-c-tab/copyable-value.tsx`

### Schedule E Tab (10 files total)
1. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/index.tsx`
2. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-empty-state.tsx`
3. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-waiting.tsx`
4. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-summary.tsx`
5. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-actions.tsx`
6. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/property-card.tsx`
7. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/totals-card.tsx`
8. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/status-badge.tsx`
9. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/format-utils.ts`
10. `/apps/workspace/src/components/cases/tabs/schedule-e-tab/copyable-value.tsx`

## Backend API Routes

File: `/apps/api/src/routes/schedule-c/index.ts`
- POST /schedule-c/:caseId/send
- GET /schedule-c/:caseId

File: `/apps/api/src/routes/schedule-e/index.ts`
- POST /schedule-e/:caseId/send
- GET /schedule-e/:caseId

## Backend Services

- `/apps/api/src/services/schedule-c/expense-calculator.ts`
- `/apps/api/src/services/schedule-c/version-history.ts`
- `/apps/api/src/services/schedule-e/expense-calculator.ts`
- `/apps/api/src/services/schedule-e/version-history.ts`

## Database Schema

File: `/packages/db/prisma/schema.prisma`

**ScheduleCExpense (Lines 1202-1274):**
- id, taxCaseId (unique)
- status (DRAFT, SUBMITTED, LOCKED)
- businessName, businessDesc
- income: grossReceipts, returns, costOfGoods, otherIncome
- 20+ IRS expense categories
- vehicleMiles, vehicleCommuteMiles, vehicleOtherMiles
- version, versionHistory
- submittedAt, lockedAt, lockedById, createdAt, updatedAt

**ScheduleEExpense (Lines 1283-1312):**
- id, taxCaseId (unique)
- status (DRAFT, SUBMITTED, LOCKED)
- properties (JSON array)
- version, versionHistory
- submittedAt, lockedAt, lockedById, createdAt, updatedAt

## Tab Visibility Conditions

| Tab | Visible | Condition |
|-----|---------|-----------|
| Schedule C | Conditional | has1099NEC OR scheduleCExpense exists |
| Schedule E | Always | Always visible |

## States Per Tab

Both follow same state machine:
- DRAFT: Client editing form (waiting state UI shown)
- SUBMITTED: Client submitted, CPA reviewing (summary shown)
- LOCKED: CPA locked, no edits (summary shown, read-only)
- Empty: No record yet (empty state shown with send button)

## Key Implementation Details

Schedule C visibility checks:
- Verified FORM_1099_NEC documents (from docs query)
- OR existing ScheduleCExpense record

Schedule E visibility:
- Always shown, no conditions

Magic links:
- Created when form sent
- Atomic deactivation of prior links
- 30-second staleTime for data caching

Version tracking:
- JSON array storing version history
- Audit trail of changes per form submission
