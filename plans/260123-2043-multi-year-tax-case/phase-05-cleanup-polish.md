# Phase 05: Cleanup & Polish

## Context

- **Parent Plan**: [plan.md](./plan.md)
- **Dependencies**: [Phase 04](./phase-04-frontend-changes.md) completed
- **Related Docs**: [brainstorm-260123-1805-multi-year-tax-case-architecture.md](../reports/brainstorm-260123-1805-multi-year-tax-case-architecture.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-23 |
| Description | Remove fallback logic, clean up yearly fields from intakeAnswers, add pre-fill feature |
| Priority | Medium |
| Effort | 0.5d |
| Implementation Status | Not Started |
| Review Status | Pending |

## Key Insights

1. Cleanup only after 2-4 week validation period with fallback active
2. Pre-fill from previous year is key UX improvement for returning clients
3. Documentation updates needed for future developers
4. Consider removing legacy boolean fields from ClientProfile model (breaking change)

## Requirements

### Functional
- Remove fallback logic from API (TaxCase.yearlyAnswers is sole source)
- Pre-fill yearlyAnswers from previous year in new case flow
- Remove yearly fields from ClientProfile.intakeAnswers (optional)
- Update developer documentation

### Non-Functional
- No regression in existing functionality
- Clear migration path for future changes
- Clean codebase without dead code

## Architecture

### Pre-fill Logic
```
When creating case for 2026:
  1. Fetch most recent case (e.g., 2025)
  2. Copy yearlyAnswers to form defaults
  3. User reviews/updates values
  4. Save to new TaxCase.yearlyAnswers
```

### Cleanup Scope
```
Remove:
  - Fallback logic in getYearlyAnswers()
  - Fallback in checklist-generator.ts
  - Yearly fields from ClientProfile.intakeAnswers (data migration)

Keep:
  - ClientProfile.intakeAnswers for static data
  - Legacy boolean fields on ClientProfile (backward compat)
```

## Related Code Files

### Modify
- `apps/api/src/lib/yearly-answers.ts` - Remove fallback logic
- `apps/api/src/services/checklist-generator.ts` - Remove fallback
- `apps/api/src/routes/clients/index.ts` - Add pre-fill endpoint
- `apps/workspace/src/routes/clients/$clientId/cases/new.tsx` - Use pre-fill data

### Delete (Optional)
- Migration script from Phase 02 (move to archived folder)

### Update
- `docs/system-architecture.md` - Document new data model
- `docs/codebase-summary.md` - Update API endpoint list

## Implementation Steps

### Step 1: Add pre-fill endpoint

File: `apps/api/src/routes/clients/index.ts`

```typescript
// GET /clients/:id/cases/prefill - Get prefill data from latest case
clientsRoute.get('/:id/cases/prefill', zValidator('param', clientIdParamSchema), async (c) => {
  const { id: clientId } = c.req.valid('param')

  const latestCase = await prisma.taxCase.findFirst({
    where: { clientId },
    orderBy: { taxYear: 'desc' },
    select: { taxYear: true, taxTypes: true, yearlyAnswers: true }
  })

  if (!latestCase) {
    return c.json({ prefill: null, suggestedYear: new Date().getFullYear() })
  }

  // Suggest next year
  const suggestedYear = latestCase.taxYear + 1

  return c.json({
    prefill: {
      taxTypes: latestCase.taxTypes,
      yearlyAnswers: latestCase.yearlyAnswers,
    },
    suggestedYear,
    previousYear: latestCase.taxYear,
  })
})
```

### Step 2: Use pre-fill in frontend

File: `apps/workspace/src/routes/clients/$clientId/cases/new.tsx`

```tsx
function NewCasePage() {
  const { clientId } = Route.useParams()

  // Fetch prefill data
  const { data: prefillData } = useQuery({
    queryKey: ['case-prefill', clientId],
    queryFn: () => api.clients.getCasePrefill(clientId),
  })

  const defaultValues = useMemo(() => ({
    taxYear: prefillData?.suggestedYear || new Date().getFullYear(),
    taxTypes: prefillData?.prefill?.taxTypes || ['FORM_1040'],
    yearlyAnswers: prefillData?.prefill?.yearlyAnswers || {},
  }), [prefillData])

  return (
    <WizardContainer
      mode="returning-client"
      defaultValues={defaultValues}
      prefillNotice={prefillData?.previousYear
        ? `Dữ liệu được sao chép từ năm ${prefillData.previousYear}. Vui lòng cập nhật nếu cần.`
        : null
      }
      // ...
    />
  )
}
```

### Step 3: Remove fallback logic from API

File: `apps/api/src/lib/yearly-answers.ts`

```typescript
// AFTER validation period, simplify to:
export function getYearlyAnswers(
  taxCase: { yearlyAnswers?: unknown }
): Record<string, unknown> {
  return parseJson(taxCase.yearlyAnswers)
  // Remove fallback to profile.intakeAnswers
}
```

File: `apps/api/src/services/checklist-generator.ts`

```typescript
// Remove profile fallback in buildConditionContext
// yearlyAnswersOverride becomes required for new cases
```

### Step 4: Clean yearly fields from intakeAnswers (Optional Migration)

```sql
-- Run after 2-4 week validation period
-- Remove yearly keys from existing intakeAnswers

UPDATE "ClientProfile"
SET "intakeAnswers" = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each("intakeAnswers")
  WHERE key NOT IN (
    'hasW2', 'w2Count', 'has1099NEC', 'num1099NECReceived',
    'hasSelfEmployment', 'hasRentalProperty', 'rentalPropertyCount',
    'hasInvestments', 'hasCrypto', 'filingStatus',
    'numKidsUnder17', 'paysDaycare', 'hasKids17to24',
    'hasKids17to24InSchool', 'dependents', 'hasRetirement',
    'hasSocialSecurity', 'hasK1', 'k1Count', 'hasForeignAccounts',
    'hasMortgage', 'hasMedicalExpenses', 'hasCharitableContributions',
    'hasStudentLoanInterest', 'hasEducatorExpenses', 'hasPropertyTax'
  )
)
WHERE "intakeAnswers" != '{}';
```

### Step 5: Update documentation

File: `docs/system-architecture.md`

```markdown
## Data Model: Multi-Year Tax Cases

### Client Profile (Static Data)
- SSN, DOB, DL info, Address, Bank account
- Stored in `ClientProfile.intakeAnswers`
- Asked once, reused across years

### Tax Case (Yearly Data)
- Filing status, income sources, deductions, dependents
- Stored in `TaxCase.yearlyAnswers`
- Unique per client + year combination

### Creating New Year Case
1. Staff clicks "Add Tax Case" on client detail
2. System pre-fills from previous year's yearlyAnswers
3. Staff/client reviews and updates
4. New TaxCase created with updated yearlyAnswers
5. Checklist generated based on yearlyAnswers
```

## Todo List

- [ ] Add `GET /clients/:id/cases/prefill` endpoint
- [ ] Add `getCasePrefill` to api-client.ts
- [ ] Update new case page to use prefill
- [ ] Add prefill notice in wizard UI
- [ ] Wait 2 weeks after Phase 04 deployment
- [ ] Monitor logs for fallback usage
- [ ] Remove fallback from getYearlyAnswers()
- [ ] Remove fallback from checklist-generator.ts
- [ ] (Optional) Clean yearly fields from intakeAnswers
- [ ] Update system-architecture.md
- [ ] Update codebase-summary.md
- [ ] Archive Phase 02 migration script

## Success Criteria

1. Pre-fill shows previous year's data in new case form
2. User can modify pre-filled data before saving
3. No errors after removing fallback (2 week validation)
4. Documentation reflects new data model
5. Clean separation: profile = static, case = yearly

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fallback still needed | Low | Medium | Monitor logs, keep code commented |
| Pre-fill data incorrect | Low | Low | User reviews before saving |
| Breaking old clients | Low | High | Only remove fallback after validation |
| Missing documentation | Low | Low | Update docs before cleanup |

## Security Considerations

- Pre-fill endpoint returns yearlyAnswers (PII) - same auth required
- No new security concerns
- Cleanup reduces data surface area (good for privacy)

## Validation Checklist (Before Fallback Removal)

- [ ] All TaxCase records have non-empty yearlyAnswers
- [ ] No errors in API logs mentioning fallback
- [ ] Checklist generation works for all case types
- [ ] Staff tested new case creation successfully
- [ ] At least 10 new cases created via new flow

## Next Steps

Feature complete after this phase. Future enhancements:
1. Tax organizer self-serve (magic link for yearly questionnaire)
2. Bulk case creation (create 2026 cases for all 2025 clients)
3. Year-over-year comparison view

---

## Unresolved Questions

1. **Legacy boolean fields on ClientProfile**: Remove entirely or keep for backward compat?
   - Recommendation: Keep for now, mark as deprecated in code comments

2. **intakeAnswers cleanup timing**: Immediate or wait for next major version?
   - Recommendation: Optional, can skip if no storage concerns

3. **Pre-fill for dependents**: Copy exactly or prompt for review?
   - Recommendation: Copy with notice "Review dependents - children may have aged out"
