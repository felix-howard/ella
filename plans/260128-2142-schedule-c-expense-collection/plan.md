---
title: "Schedule C Expense Collection"
description: "Self-employed expense collection via magic link forms"
status: complete
priority: P2
effort: 60-80 hours
branch: feature/engagement-only
tags: [schedule-c, expense-form, magic-link, sms]
created: 2026-01-28
updated: 2026-01-29
---

# Schedule C Expense Collection - Implementation Plan

## Overview

Enable CPAs to collect self-employed client expenses via SMS-delivered magic link forms. Auto-detects 1099-NEC forms, prefills income, collects 20+ IRS Schedule C expense categories, tracks version history.

## Business Value

- **Time Savings:** ~15 min/case (no manual form creation)
- **Data Centralization:** All client data in one system
- **Workflow Automation:** Auto-detect 1099-NEC → send form → generate Schedule C draft
- **Client UX:** Vietnamese-first, no-login form access

## Architecture Context

- **Monorepo:** pnpm workspaces + Turbo
- **Stack:** Hono API (3002), Prisma/PostgreSQL, React (portal/workspace)
- **Integrations:** Twilio SMS, existing magic link service
- **Language:** Vietnamese UI

## Implementation Phases

### [Phase 1: Database Schema](phase-01-database-schema.md) ✅ DONE
- ScheduleCExpense model (income + 20+ expense fields)
- MagicLink type extension (add SCHEDULE_C enum)
- Version history tracking
- Migration strategy
- **Effort:** 8-10 hours
- **Status:** Completed 2026-01-28 | Tests: 578/578 passing | Code Review: 10/10

### [Phase 2: API Endpoints](phase-02-api-endpoints.md) ✅ DONE
- Schedule C management endpoints (send, view, lock)
- Public expense form endpoints (GET/POST/PATCH)
- Magic link service integration
- SMS template + sending logic
- **Effort:** 16-20 hours
- **Status:** Completed 2026-01-28 | Tests: 578/578 passing | Code Review: 9.2/10

### [Phase 3: Portal Expense Form](phase-03-portal-expense-form.md) ✅ DONE
- New route `/expense/:token`
- ExpenseForm component (one-page, 20+ categories)
- Auto-save, validation, submission
- Vietnamese tooltips per category
- **Effort:** 20-24 hours
- **Status:** Completed 2026-01-28 | Tests: 578/578 passing | Code Review: 9.5/10

### [Phase 4: Workspace Schedule C Tab](phase-04-workspace-schedule-c-tab.md) ✅ DONE
- Schedule C tab in case details
- Summary view (income - expenses = profit)
- Version history timeline
- Send/Lock/Resend actions
- **Effort:** 12-16 hours
- **Status:** Completed 2026-01-28 | Tests: 578/578 passing | Code Review: 9.5/10
- **Changes:** Added Schedule C API client methods (get, send, lock, unlock, resend); created hooks: useScheduleC, useScheduleCActions; created 11 UI components in schedule-c-tab folder (ScheduleCTab/index, ScheduleCEmptyState, ScheduleCWaiting, ScheduleCSummary, IncomeTable, ExpenseTable, NetProfitCard, VersionHistory, ScheduleCActions + utilities); integrated Schedule C tab into CaseDetails; conditional visibility when 1099-NEC detected or Schedule C exists

### [Phase 5: Testing & Polish](phase-05-testing-polish.md) ✅ DONE
- Integration testing
- Edge case validation
- Error handling
- Performance optimization
- **Effort:** 8-10 hours
- **Status:** Completed 2026-01-29 | Tests: 663/663 passing | Code Review: 10/10
- **Changes:** Added 85 tests (expense-calculator: 28, version-history: 21, schedule-c routes: 20, expense routes: 16); fixed 5 UI issues (tooltip z-index, auto-save indicator timing, expense table column widths, version history mobile alignment, redundant input type); added lazy loading for ScheduleCTab and ExpenseForm components; added error boundaries around lazy-loaded components; implemented auto-save retry logic with exponential backoff (3 retries: 2s, 4s, 8s); documented z-index scale; extracted shared test factory helper; added mock pattern documentation; added auto-save timing comments

## Success Criteria

| Metric | Target |
|--------|--------|
| Form completion rate | >70% of sent forms |
| Avg completion time | <10 minutes |
| Version edits per submission | <3 |
| Staff time saved | ~15 min/case |

## Dependencies

- ✅ Twilio SMS configured
- ✅ Portal app deployed
- ✅ 1099-NEC AI classifier
- ✅ Decimal field support (Prisma)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Client confusion on expense categories | Vietnamese tooltips with examples |
| Incorrect amounts entered | Version history allows correction |
| Link shared with wrong person | Same risk as portal link, accepted |
| Yearly mileage rate changes | Store in env var, update annually |

## Related Documents

- Brainstorm: `../reports/brainstorm-260128-2054-schedule-c-expense-collection.md`
- Magic Link Research: `research/researcher-magic-link-report.md`
- SMS Service Research: `research/researcher-sms-service-report.md`
