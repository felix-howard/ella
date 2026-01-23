# Phase 04: Frontend Changes

## Context

- **Parent Plan**: [plan.md](./plan.md)
- **Dependencies**: [Phase 03](./phase-03-api-updates.md) completed
- **Related Docs**: [researcher-frontend-flow.md](./research/researcher-frontend-flow.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-23 |
| Description | Add multi-year UI: case selector, add case flow, update overview sections |
| Priority | High |
| Effort | 1.5d |
| Implementation Status | Not Started |
| Review Status | Pending |

## Key Insights

1. Current client detail page hardcodes `client.taxCases[0]` - needs dynamic selection
2. New route `/clients/:id/cases/new` for returning clients
3. Wizard can be reused but skip static identity section
4. Case selector in header - dropdown with year + status

## Requirements

### Functional
- Tax case selector in client detail header (dropdown or tabs)
- "Add Tax Case" button navigates to `/clients/:id/cases/new`
- New case creation flow skips static fields (SSN, DOB, bank)
- ClientOverviewSections displays data for selected case
- Client list shows case count indicator

### Non-Functional
- Responsive design (mobile-friendly selector)
- Smooth transitions between cases
- Loading states during case switch
- Preserve tab state when switching cases

## Architecture

### Route Structure
```
/clients/:id              -> Client detail with case selector
/clients/:id/cases/new    -> Create new case for existing client
```

### Component Hierarchy
```
ClientDetailPage
  -> TaxCaseSelectorHeader (NEW)
  -> ClientOverviewSections (MODIFY - use selected case)
  -> TieredChecklist (MODIFY - use selected case)
  -> FloatingChatbox (MODIFY - use selected case)
```

## Related Code Files

### Create
- `apps/workspace/src/routes/clients/$clientId/cases/new.tsx` - New case creation
- `apps/workspace/src/components/clients/tax-case-selector.tsx` - Case dropdown

### Modify
- `apps/workspace/src/routes/clients/$clientId.tsx` - Add selector, state management
- `apps/workspace/src/components/clients/client-overview-sections.tsx` - Use case data
- `apps/workspace/src/components/clients/intake-wizard/wizard-container.tsx` - Skip static mode
- `apps/workspace/src/components/clients/client-list-table.tsx` - Case count badge
- `apps/workspace/src/lib/api-client.ts` - Add createCaseForClient method

## Implementation Steps

### Step 1: Add API client method

File: `apps/workspace/src/lib/api-client.ts`

```typescript
// In clients namespace
createCaseForClient: async (
  clientId: string,
  data: { taxYear: number; taxTypes: string[]; yearlyAnswers: Record<string, unknown> }
) => {
  const res = await fetch(`${API_BASE}/clients/${clientId}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to create case')
  return res.json()
}
```

### Step 2: Create TaxCaseSelectorHeader component

File: `apps/workspace/src/components/clients/tax-case-selector.tsx`

```tsx
interface TaxCaseSelectorProps {
  cases: TaxCaseSummary[]
  selectedCaseId: string
  onSelectCase: (caseId: string) => void
  clientId: string
}

export function TaxCaseSelectorHeader({
  cases, selectedCaseId, onSelectCase, clientId
}: TaxCaseSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Dropdown for case selection */}
      <select
        value={selectedCaseId}
        onChange={(e) => onSelectCase(e.target.value)}
        className="border rounded-md px-3 py-1.5 text-sm"
      >
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.taxYear} - {getStatusLabel(c.status)}
          </option>
        ))}
      </select>

      {/* Add Case Button */}
      <Link
        to="/clients/$clientId/cases/new"
        params={{ clientId }}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-md"
      >
        <Plus className="w-4 h-4" />
        Thêm năm thuế
      </Link>
    </div>
  )
}
```

### Step 3: Update ClientDetailPage with case selection state

File: `apps/workspace/src/routes/clients/$clientId.tsx`

```tsx
function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.clients.get(clientId),
  })

  // Default to latest case on load
  useEffect(() => {
    if (client?.taxCases?.length > 0 && !selectedCaseId) {
      setSelectedCaseId(client.taxCases[0].id)
    }
  }, [client, selectedCaseId])

  const selectedCase = client?.taxCases?.find(c => c.id === selectedCaseId)

  return (
    <PageContainer>
      {/* Header with case selector */}
      <div className="flex items-start justify-between gap-4">
        <div>{/* Client info */}</div>

        <TaxCaseSelectorHeader
          cases={client?.taxCases || []}
          selectedCaseId={selectedCaseId || ''}
          onSelectCase={setSelectedCaseId}
          clientId={clientId}
        />
      </div>

      {/* Pass selectedCase to tabs */}
      {activeTab === 'overview' && selectedCase && (
        <ClientOverviewSections client={client} selectedCase={selectedCase} />
      )}
    </PageContainer>
  )
}
```

### Step 4: Create new case route

File: `apps/workspace/src/routes/clients/$clientId/cases/new.tsx`

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { WizardContainer } from '../../../components/clients/intake-wizard/wizard-container'

export const Route = createFileRoute('/clients/$clientId/cases/new')({
  component: NewCasePage,
})

function NewCasePage() {
  const { clientId } = Route.useParams()
  const navigate = useNavigate()

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => api.clients.get(clientId),
  })

  const createCaseMutation = useMutation({
    mutationFn: (data: CreateCaseData) =>
      api.clients.createCaseForClient(clientId, data),
    onSuccess: () => {
      toast.success('Đã tạo hồ sơ thuế mới')
      navigate({ to: '/clients/$clientId', params: { clientId } })
    },
  })

  return (
    <PageContainer>
      <h1>Thêm năm thuế mới cho {client?.name}</h1>

      <WizardContainer
        mode="returning-client"  // Skip static identity section
        clientId={clientId}
        existingProfile={client?.profile}
        onSubmit={(data) => createCaseMutation.mutate(data)}
        isSubmitting={createCaseMutation.isPending}
      />
    </PageContainer>
  )
}
```

### Step 5: Update WizardContainer for returning client mode

File: `apps/workspace/src/components/clients/intake-wizard/wizard-container.tsx`

```tsx
interface WizardContainerProps {
  mode?: 'new-client' | 'returning-client'
  clientId?: string
  existingProfile?: ClientProfile
  onSubmit: (data: unknown) => void
  isSubmitting: boolean
}

// Skip Step 1 (basic info) and Step 3.1 (identity) for returning clients
const STEPS_NEW_CLIENT = ['basic', 'tax-selection', 'identity', 'income', 'deductions', 'review']
const STEPS_RETURNING = ['tax-selection', 'income', 'deductions', 'review']

export function WizardContainer({ mode = 'new-client', ...props }: WizardContainerProps) {
  const steps = mode === 'returning-client' ? STEPS_RETURNING : STEPS_NEW_CLIENT
  // ... use steps array for navigation
}
```

### Step 6: Update ClientOverviewSections

File: `apps/workspace/src/components/clients/client-overview-sections.tsx`

```tsx
interface ClientOverviewSectionsProps {
  client: ClientDetail
  selectedCase?: TaxCaseSummary  // NEW
}

export function ClientOverviewSections({ client, selectedCase }: Props) {
  // Use yearlyAnswers from selected case if available
  const yearlyAnswers = selectedCase?.yearlyAnswers || {}
  const staticAnswers = client.profile?.intakeAnswers || {}

  // Merge for display (yearly from case, static from profile)
  const displayData = { ...staticAnswers, ...yearlyAnswers }

  return (
    <div className="space-y-4">
      {/* Tax Info Section - from selected case */}
      <Section title="Thông tin thuế">
        <Field label="Năm thuế" value={selectedCase?.taxYear} />
        <Field label="Loại thuế" value={selectedCase?.taxTypes?.join(', ')} />
        <Field label="Tình trạng hôn nhân" value={displayData.filingStatus} />
      </Section>

      {/* Identity Section - from profile (static) */}
      <Section title="Thông tin cá nhân">
        <Field label="SSN" value={staticAnswers.ssn} masked />
        {/* ... other static fields */}
      </Section>

      {/* Income Section - from selected case (yearly) */}
      <Section title="Thu nhập">
        <Field label="Có W-2" value={yearlyAnswers.hasW2 ? 'Có' : 'Không'} />
        {/* ... other income fields */}
      </Section>
    </div>
  )
}
```

### Step 7: Add case count to client list

File: `apps/workspace/src/components/clients/client-list-table.tsx`

```tsx
// In table row
<td className="text-sm text-muted-foreground">
  {client.taxCases?.length || 1}
  {client.taxCases?.length > 1 && (
    <span className="ml-1 text-xs text-muted-foreground">năm</span>
  )}
</td>
```

## Todo List

- [ ] Add `createCaseForClient` to api-client.ts
- [ ] Create `tax-case-selector.tsx` component
- [ ] Create route file `$clientId/cases/new.tsx`
- [ ] Update routeTree.gen.ts (auto-generated)
- [ ] Update ClientDetailPage with case selection state
- [ ] Update WizardContainer for returning-client mode
- [ ] Update ClientOverviewSections to accept selectedCase
- [ ] Update client-list-table.tsx with case count
- [ ] Add Vietnamese translations for new UI text
- [ ] Test case switching preserves tab state
- [ ] Test new case creation flow
- [ ] Mobile responsive testing

## Success Criteria

1. Case selector dropdown shows all years for client
2. Switching cases updates Overview, Documents, Data-Entry tabs
3. "Add Tax Case" navigates to new case flow
4. New case flow skips identity section
5. New case saves to TaxCase.yearlyAnswers
6. Checklist generates correctly for new case
7. Client list shows case count badge

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| State sync issues | Medium | Medium | Use React Query for data, local state for UI |
| Wizard reuse complexity | Medium | Medium | Clear mode prop, separate step arrays |
| Breaking existing flow | Low | High | Feature flag, extensive testing |
| Mobile layout issues | Medium | Low | Responsive design, test on devices |

## Security Considerations

- New route requires same auth as existing client routes
- No new sensitive data exposed
- yearlyAnswers handled same as intakeAnswers

## UI/UX Notes

1. Case selector: Dropdown with "YYYY - Status" format
2. Add button: Primary color, positioned after selector
3. Loading state: Skeleton while fetching case data
4. Empty state: If client has no cases (shouldn't happen normally)

## Next Steps

After completion, proceed to [Phase 05: Cleanup & Polish](./phase-05-cleanup-polish.md)

---

## Unresolved Questions

1. **Case selector design**: Dropdown vs tab-bar vs segmented control? (Recommend: dropdown for space efficiency)
2. **Bank info in new case flow**: Skip entirely or show read-only? (Recommend: skip - can edit in profile)
3. **Deep linking**: Should `/clients/:id?caseId=xxx` be supported? (Future enhancement)
