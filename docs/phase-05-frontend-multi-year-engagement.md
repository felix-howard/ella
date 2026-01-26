# Phase 05: Frontend Multi-Year Engagement Support

**Date:** 2026-01-26
**Status:** Complete
**Branch:** feature/multi-tax-year
**Component:** Frontend client management UI + shared types + engagement helpers

## Overview

Phase 05 Frontend Updates implements client-facing UI for multi-year engagement support. Users can now view engagement history, switch between tax years, and system automatically detects returning clients with prior-year suggestions.

## New Files

### Shared Package (`packages/shared/`)

#### 1. tax-engagement.ts - Types

**Purpose:** TypeScript definitions for multi-year engagement domain.

**Exports:**
- `EngagementStatus` - Union: `'DRAFT' | 'ACTIVE' | 'COMPLETE' | 'ARCHIVED'`
- `TaxEngagement` - Full engagement object
  - `id, clientId, taxYear, status`
  - Profile fields: `filingStatus, hasW2, hasBankAccount, hasInvestments, hasKidsUnder17, numKidsUnder17, paysDaycare, hasKids17to24, hasSelfEmployment, hasRentalProperty, businessName, ein, hasEmployees, hasContractors, has1099K`
  - `intakeAnswers: Record<string, unknown>` - Year-specific responses
  - Timestamps: `createdAt, updatedAt`
  - Optional relations: `client, _count.taxCases`
- `TaxEngagementSummary` - Lightweight list view (no profile fields)

#### 2. engagement-helpers.ts - Utilities

**Purpose:** Backward compatibility layer during phase 3 transition (engagementId becoming required).

**Exports:**
- `ProfileData` interface - Unified profile structure (15 fields)
- `LegacyClientProfile` - Old single-year profile type
- `TaxCaseWithOptionalEngagement` - Transition type with nullable engagementId
- `getProfileData(taxCase, legacyProfile?)`
  - Returns profile from engagement (preferred) or legacy profile
  - Safely handles null cases
- `normalizeTaxCase(taxCase)`
  - Guarantees engagementId presence
  - Uses case.id as fallback (temporary)
- `hasEngagementProfile(taxCase)`
  - Boolean check for engagement-based profile

### Workspace Components (`apps/workspace/src/components/clients/`)

#### 1. engagement-history-section.tsx

**Purpose:** Display client's multi-year engagement history.

**Features:**
- Lists all engagements for client sorted by tax year (newest first)
- Status badge per engagement (color-coded: DRAFT=gray, ACTIVE=green, COMPLETE=blue, ARCHIVED=neutral)
- Filing status display ("Single", "Married Filing Jointly", etc.)
- Last activity timestamp
- Click to switch to engagement

**Props:**
- `clientId: string` - Client identifier
- `currentEngagementId?: string` - Highlight active engagement

**Example:**
```
[2025] ACTIVE - Single - Last: Jan 25, 2026
[2024] COMPLETE - Single - Last: Apr 15, 2025
[2023] ARCHIVED - Single - Last: Aug 20, 2024
```

#### 2. returning-client-section.tsx

**Purpose:** Detect returning clients & offer quick-access to prior engagements.

**Features:**
- Queries prior engagements (all except current year)
- Shows "Previous engagements available" banner
- Lists prior years with status & filing status
- "Open [YEAR]" quick-link button
- Integrated in new case creation workflow

**Props:**
- `clientId: string` - Client identifier
- `currentTaxYear?: number` - Exclude from list
- `onSelectEngagement: (engagementId) => void` - Callback on selection

**Example Usage:**
New client form shows: "Found prior engagement for 2024 (COMPLETE). Open it?" with button.

## API Client Integration

### apps/workspace/src/lib/api-client.ts

**New engagement methods:**
```typescript
engagements: {
  list(params?: {
    clientId?: string
    taxYear?: number
    status?: EngagementStatus
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<TaxEngagement>>

  detail(id: string): Promise<{ data: TaxEngagementDetail }>

  create(data: CreateEngagementInput): Promise<{ data: TaxEngagement }>

  update(id: string, data: UpdateEngagementInput): Promise<{ data: TaxEngagement }>

  copyPreview(id: string): Promise<{ data: EngagementCopyPreview }>

  delete(id: string): Promise<{ success: boolean; message: string }>
}
```

**Types added:**
- `TaxEngagement` - From shared package
- `EngagementStatus` - From shared package
- `TaxEngagementDetail` - Extends TaxEngagement
- `EngagementCopyPreview` - Copy operation preview

### apps/portal/src/lib/api-client.ts

**Updated:**
- `PortalTaxCase` interface now includes `engagementId?: string`
- Enables portal to reference multi-year engagement context

## UI Integration Points

### Client Overview Tab
- New "Engagement History" section displays via engagement-history-section component
- Shows all prior years + current engagement
- Clicking engagement switches context

### New Client Page
- Detects if name/email exists in prior engagements
- Shows returning-client-section if matches found
- Offers quick-link: "Open prior engagement for 2024?"
- Prevents duplicate data entry

### Client Header
- Engagement selector dropdown
- Shows current year + status
- Quick-switch to other years

## Data Flow

```
Client Overview Page
  ├─ Fetch client.engagements (all years)
  ├─ Render EngagementHistorySection
  │  ├─ Group by year
  │  ├─ Sort descending
  │  └─ Show status badges
  └─ Pass selected engagement to case list

New Client Form
  ├─ Search by name/email
  ├─ Query prior engagements
  ├─ Show ReturningClientSection if matches
  └─ Offer quick-open button
```

## Backward Compatibility

**Phase 3 Transition:**
- TaxCase.engagementId still nullable during migration
- `getProfileData()` fallback to ClientProfile if engagement missing
- `normalizeTaxCase()` provides safe engagementId access
- No breaking changes to existing API contracts

**Migration Path:**
1. Phase 3 schema makes engagementId required
2. Phase 2 backfill script links all cases to engagements
3. Phase 3 routes assume engagementId present
4. Helpers removed after full migration

## Files Changed

| File | Type | Changes |
|------|------|---------|
| `packages/shared/src/types/tax-engagement.ts` | NEW | TaxEngagement, EngagementStatus, TaxEngagementSummary types |
| `packages/shared/src/utils/engagement-helpers.ts` | NEW | getProfileData, normalizeTaxCase, hasEngagementProfile helpers |
| `apps/workspace/src/components/clients/engagement-history-section.tsx` | NEW | Multi-year engagement history display |
| `apps/workspace/src/components/clients/returning-client-section.tsx` | NEW | Returning client detection & prior engagement quick-link |
| `apps/workspace/src/lib/api-client.ts` | MODIFIED | Added 6 engagement methods + EngagementStatus type |
| `apps/workspace/src/routes/clients/$clientId.tsx` | MODIFIED | Integrated engagement history section in overview tab |
| `apps/workspace/src/routes/clients/new.tsx` | MODIFIED | Added returning client detection |
| `apps/portal/src/lib/api-client.ts` | MODIFIED | Added engagementId to PortalTaxCase type |

## Testing

**Manual Test Cases:**
1. Open client detail → see engagement history
2. Click engagement in list → switches tab context
3. Create new client with prior record → see returning client banner
4. Click prior engagement link → opens case from previous year
5. Switch engagement year → verify all cases load for correct year

**Integration Points:**
- Engagement API endpoints (Phase 4) serve data
- TaxCase routes use engagement context for filtering
- Backward compatibility layer handles nullable engagementId

## Performance Considerations

- Lazy-load engagement history on client detail page open
- Cache engagement list per clientId (30s TTL)
- Pagination for large histories (10 per page)
- Memoize engagement-history-section to prevent re-renders

## Security

- All engagement queries require staff JWT auth
- ClientId parameter validated against staff access
- EngagementId FK constraint prevents orphaned records
- Cascade delete protects data integrity

## Next Steps

1. **Phase 5.1 - Engagement Lifecycle UI**
   - Status transition buttons (DRAFT→ACTIVE→COMPLETE)
   - Re-open ARCHIVED engagements
   - Archive current engagement

2. **Phase 5.2 - Bulk Multi-Year Operations**
   - Copy intake answers from prior year
   - Bulk case creation for new year
   - Template cloning

3. **Phase 5.3 - Dashboard Multi-Year View**
   - Client dashboard shows all year summaries
   - Comparative year-over-year reporting

---

**Last Updated:** 2026-01-26
**Status:** Phase 5 Frontend Complete
**Architecture Version:** 9.3
