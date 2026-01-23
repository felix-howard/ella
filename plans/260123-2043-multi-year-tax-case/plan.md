# Multi-Year Tax Case Implementation Plan

```yaml
title: Multi-Year Tax Case Feature
description: Enable clients to have multiple tax cases across years without duplicating client records
status: planned
priority: high
effort: 5d
branch: feature/multi-year-tax-case
tags: [database, api, frontend, migration]
created: 2026-01-23
```

## Overview

Implement Option 3+4 hybrid: Client-centric multi-year model with static/yearly answer split.
- ClientProfile: SSN, DOB, DL, bank info (static, asked once)
- TaxCase.yearlyAnswers: income sources, deductions, filing status (year-specific)

## Phases

| Phase | Title | Effort | Link |
|-------|-------|--------|------|
| 1 | Database Schema Changes | 0.5d | [phase-01-database-schema.md](./phase-01-database-schema.md) |
| 2 | Data Migration | 1d | [phase-02-data-migration.md](./phase-02-data-migration.md) |
| 3 | API Layer Updates | 1.5d | [phase-03-api-updates.md](./phase-03-api-updates.md) |
| 4 | Frontend Changes | 1.5d | [phase-04-frontend-changes.md](./phase-04-frontend-changes.md) |
| 5 | Cleanup & Polish | 0.5d | [phase-05-cleanup-polish.md](./phase-05-cleanup-polish.md) |

## Dependencies

- PostgreSQL 15+ (JSONB support)
- Prisma ORM (current version)
- Zero production clients yet (simpler migration)

## Key Decisions

1. **yearlyAnswers location**: TaxCase model (not separate table) - KISS
2. **Migration strategy**: Additive column + data copy, no deletion during transition
3. **Fallback pattern**: Read TaxCase.yearlyAnswers first, fallback to ClientProfile.intakeAnswers
4. **Field classification**: Dependents = yearly (kids age out), Bank info = static (reused)

## Validation Summary

**Validated:** 2026-01-23
**Questions asked:** 6

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Dependents classification | **Yearly** - Store in TaxCase.yearlyAnswers (kids age out, custody changes) |
| SMS for returning clients | **Send SMS** - Send new magic link even for existing clients |
| Case selection UI | **Dropdown** - Compact select menu showing 'YYYY - Status' |
| Bank info in pre-fill | **Yes - copy to form** - Pre-fill from previous year, user can change |
| Fallback transition period | **2 weeks** - Standard validation period |
| Client list indicator | **Expandable row** - Click row to expand and show all tax case years |

### Action Items (Plan Updates Needed)

- [ ] Phase 02: Confirm dependents in YEARLY_KEYS list (already included)
- [ ] Phase 03: Add SMS sending to `POST /clients/:id/cases` endpoint
- [ ] Phase 04: Implement expandable rows in client list (additional work)
- [ ] Phase 05: Include bank info in pre-fill scope

## Architecture

```
Client (phone unique)
  -> ClientProfile (SSN, DOB, DL, address, bank - static)
  -> TaxCase[] (per year)
       -> yearlyAnswers (JSON): hasW2, filingStatus, dependents, deductions
       -> ChecklistItems, RawImages, DigitalDocs
```

## Risk Summary

| Risk | Mitigation |
|------|------------|
| Data loss | Backup before migration, keep intakeAnswers untouched initially |
| API breakage | Fallback logic, feature flag for gradual rollout |
| Performance | yearlyAnswers indexed via TaxCase existing indexes |

## Related Docs

- [researcher-database-migration.md](./research/researcher-database-migration.md)
- [researcher-frontend-flow.md](./research/researcher-frontend-flow.md)
- [brainstorm-260123-1805-multi-year-tax-case-architecture.md](../reports/brainstorm-260123-1805-multi-year-tax-case-architecture.md)
