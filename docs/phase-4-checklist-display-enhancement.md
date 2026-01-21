# Phase 4 - Checklist Display Enhancement

**Status:** Completed
**Date:** 2026-01-19
**Branch:** feature/more-enhancement

## Overview

Phase 4 - Checklist Display Enhancement introduces a sophisticated 3-tier checklist system with staff override capabilities, visual progress tracking, and modal-based item management. This phase transforms the checklist from a simple list into an interactive, categorized interface that improves staff workflow and user experience.

## Key Features

### 1. Tiered Checklist System
- **3-Tier Organization**: Required, Applicable (Based on Answers), Optional
- **Visual Hierarchy**: Color-coded tiers with distinct styling
- **Smart Grouping**: Automatic categorization based on template properties
  - Required: `isRequired=true` AND no condition
  - Applicable: Has conditional logic (matched against intake answers)
  - Optional: `isRequired=false` AND no condition

### 2. Staff Override Capabilities
- **Add Manual Items**: Staff can add items beyond generated checklist
- **Skip Items**: Mark items as NOT_REQUIRED with reason tracking
- **Restore Items**: Restore skipped items with smart status inference
- **Update Notes**: Add/edit notes on individual checklist items

### 3. Visual Progress Tracking
- **Progress Bar**: Real-time visualization of checklist completion
- **Status Distribution**: Summary of item counts by status
- **Completion Percentage**: Quick overview of checklist health

### 4. Staff Modal Interface
- **AddChecklistItemModal**: User-friendly form to add manual items
- Document type selection with validation
- Optional reason for addition (max 500 chars)
- Expected count configuration (1-99 items)

## Database Schema Updates

### ChecklistItem Model Extensions

```prisma
model ChecklistItem {
  // ... existing fields ...

  // Staff override fields (NEW)
  isManuallyAdded  Boolean   @default(false)
  addedById        String?
  addedBy          Staff?    @relation("AddedChecklistItems", fields: [addedById], references: [id])
  addedReason      String?
  skippedAt        DateTime?
  skippedById      String?
  skippedBy        Staff?    @relation("SkippedChecklistItems", fields: [skippedById], references: [id])
  skippedReason    String?
}

model Staff {
  // ... existing fields ...

  // Relations to track overrides
  addedChecklistItems   ChecklistItem[] @relation("AddedChecklistItems")
  skippedChecklistItems ChecklistItem[] @relation("SkippedChecklistItems")
}
```

**Composite Index**: `[caseId, status]` for efficient queklist queries by status

## New API Endpoints

### POST /cases/:id/checklist/items
Add a manually created checklist item for a case.

**Request Schema:**
```typescript
{
  docType: string;           // Document type (validated against templates)
  reason?: string;           // Reason for adding (max 500 chars)
  expectedCount?: number;    // Expected count (1-99, default 1)
}
```

**Response (201):**
```typescript
{
  data: {
    id: string;
    caseId: string;
    templateId: string;
    status: "MISSING";
    isManuallyAdded: true;
    addedById: string | null;
    addedReason: string | null;
    expectedCount: number;
    template: ChecklistTemplate;
    addedBy: { id: string; name: string } | null;
  }
}
```

**Error Handling:**
- 404: Case not found
- 400: No template found for docType
- 409: Checklist item already exists (duplicate prevention)

### PATCH /cases/:id/checklist/items/:itemId/skip
Skip a checklist item (mark as NOT_REQUIRED).

**Request Schema:**
```typescript
{
  reason: string;  // Required reason (max 500 chars)
}
```

**Response (200):**
```typescript
{
  data: {
    id: string;
    status: "NOT_REQUIRED";
    skippedAt: ISO8601DateTime;
    skippedById: string | null;
    skippedReason: string;
    skippedBy: { id: string; name: string } | null;
    // ... other fields ...
  }
}
```

**Error Handling:**
- 404: Item or case not found
- 400: Item doesn't belong to case

### PATCH /cases/:id/checklist/items/:itemId/unskip
Restore a skipped checklist item.

**Response (200):**
```typescript
{
  data: {
    id: string;
    status: "HAS_RAW" | "MISSING";  // Smart inference based on files
    skippedAt: null;
    skippedById: null;
    skippedReason: null;
    // ... other fields ...
  }
}
```

**Status Inference:**
- If raw images exist: Status becomes `HAS_RAW`
- Otherwise: Status becomes `MISSING`

**Error Handling:**
- 404: Item or case not found
- 400: Item is not currently skipped

### PATCH /cases/:id/checklist/items/:itemId/notes
Update notes for a checklist item.

**Request Schema:**
```typescript
{
  notes: string;  // Max 1000 chars
}
```

**Response (200):**
```typescript
{
  data: {
    id: string;
    notes: string;
    template: ChecklistTemplate;
    // ... other fields ...
  }
}
```

**Error Handling:**
- 404: Item or case not found

## Frontend Components

### ChecklistProgress

**Path**: `apps/workspace/src/components/cases/checklist-progress.tsx`

Simple progress visualization component showing completion percentage and item counts.

**Props:**
```typescript
interface ChecklistProgressProps {
  items: ChecklistItem[];
  isLoading?: boolean;
}
```

**Features:**
- Calculates completion percentage
- Shows status breakdown (Missing, Has Raw, Has Digital, Verified, Not Required)
- Responsive layout
- Loading skeleton state

### TieredChecklist

**Path**: `apps/workspace/src/components/cases/tiered-checklist.tsx`

Main checklist display component with 3-tier organization and staff interactions.

**Props:**
```typescript
interface TieredChecklistProps {
  items: ChecklistItem[];
  isLoading?: boolean;
  isStaffView?: boolean;           // Enable staff actions
  onAddItem?: () => void;          // Trigger add item modal
  onSkip?: (itemId: string, reason: string) => void;
  onUnskip?: (itemId: string) => void;
  onVerify?: (item: ChecklistItem) => void;
  onViewNotes?: (item: ChecklistItem) => void;
}
```

**Features:**
- Automatic category grouping by document type (personal, income, deductions, business, other)
- Expandable category sections with received/total count
- Status indicators with icons and colors
- Staff action buttons (skip, unskip, add notes)
- Document thumbnail preview with colored borders (verification status visual)
- Verification progress badge for multi-document items (>1 doc)
- File preview integration
- Loading skeleton state

**Internal Helpers:**
```typescript
function groupItemsByCategory(items: ChecklistItem[]): CategoryGroup[]
function getSimplifiedStatus(status: ChecklistItemStatus): StatusDisplay
function getDocStatusBorderStyle(status: string | undefined): string
function getVerificationProgressStyle(verified: number, total: number): ProgressStyle
```

- `groupItemsByCategory()`: Groups items by document category in DOC_TYPE_CATEGORIES order
- `getDocStatusBorderStyle()`: Maps DigitalDoc status to border Tailwind classes
- `getVerificationProgressStyle()`: Determines badge style based on verification count

**Document Verification Visualization:**
- Each document thumbnail shows colored border based on status (PENDING, EXTRACTED, VERIFIED, PARTIAL, FAILED)
- Multi-document checklist items display verification progress badge: "{verified}/{total} đã xác minh"
- Badge only shows when item has >1 doc to reduce visual clutter
- Colors match system palette: Emerald (verified), Amber (extracted/in-progress), Red (failed), Gray (pending)

### AddChecklistItemModal

**Path**: `apps/workspace/src/components/cases/add-checklist-item-modal.tsx`

Modal form for staff to add manual checklist items.

**Props:**
```typescript
interface AddChecklistItemModalProps {
  isOpen: boolean;
  caseId: string;
  onClose: () => void;
  onSuccess?: (item: ChecklistItem) => void;
  isLoading?: boolean;
}
```

**Features:**
- Document type dropdown (populated from templates)
- Optional reason field (textarea, 500 char limit)
- Expected count input (1-99)
- Form validation
- Error handling with toast feedback
- Loading state management

## Constants Library

### Path: `apps/workspace/src/lib/checklist-tier-constants.ts`

Centralized constants for tier styling and status display.

**CHECKLIST_TIERS:**
```typescript
{
  REQUIRED: {
    key: 'required',
    labelVi: 'BẮT BUỘC',
    labelEn: 'Required',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '🔴',
  },
  APPLICABLE: {
    key: 'applicable',
    labelVi: 'THEO TÌNH HUỐNG',
    labelEn: 'Based on your answers',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '🟡',
  },
  OPTIONAL: {
    key: 'optional',
    labelVi: 'CÓ THỂ CẦN',
    labelEn: 'Optional',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: '🟢',
  },
}
```

**CHECKLIST_STATUS_DISPLAY:**
Maps ChecklistItemStatus to visual representation (icons, colors, labels).

**DOC_STATUS_BORDER_STYLES:** (NEW - Document-Level Verification Status)
Border styling for document thumbnails based on DigitalDoc.status:
```typescript
{
  PENDING: 'border-2 border-dashed border-gray-400 dark:border-gray-500',
  EXTRACTED: 'border-2 border-amber-500 dark:border-amber-400',
  VERIFIED: 'border-2 border-emerald-500 dark:border-emerald-400',
  PARTIAL: 'border-2 border-red-500 dark:border-red-400',  // Extraction partial success
  FAILED: 'border-2 border-red-500 dark:border-red-400',
}
```
- Visual differentiation at a glance without affecting interactivity
- Uses 2px borders for clear distinction
- Dark mode support for all status colors

**VERIFICATION_PROGRESS_STYLES:** (NEW - Multi-Document Progress Badge)
Badge styling for verification progress on checklist items with >1 document:
```typescript
{
  ALL: { bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
  PARTIAL: { bgColor: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
  NONE: { bgColor: 'bg-gray-500/10', textColor: 'text-gray-600 dark:text-gray-400' },
}
```
- ALL: All docs verified (complete)
- PARTIAL: Some docs verified (in progress)
- NONE: No docs verified (not started)

## API Client Updates

### Path: `apps/workspace/src/lib/api-client.ts`

New methods added for checklist management:

```typescript
// Add manual checklist item
async function addChecklistItem(
  caseId: string,
  data: AddChecklistItemInput
): Promise<{ data: ChecklistItem }>

// Skip checklist item
async function skipChecklistItem(
  caseId: string,
  itemId: string,
  reason: string
): Promise<{ data: ChecklistItem }>

// Restore skipped item
async function unskipChecklistItem(
  caseId: string,
  itemId: string
): Promise<{ data: ChecklistItem }>

// Update item notes
async function updateChecklistItemNotes(
  caseId: string,
  itemId: string,
  notes: string
): Promise<{ data: ChecklistItem }>
```

## Integration Points

### Client Detail Page

**Path**: `apps/workspace/src/routes/clients/$clientId.tsx`

Integration of new checklist components:

1. **ChecklistProgress** - Displayed at top of checklist section
2. **TieredChecklist** - Main checklist view with staff actions
3. **AddChecklistItemModal** - Triggered by "Add Item" button
4. **Error Handling** - Toast notifications for API failures

**Implementation Pattern:**
```typescript
// Fetch checklist data
const { data: checklistData } = useQuery({
  queryKey: ['checklist', caseId],
  queryFn: () => getChecklist(caseId),
})

// Handle staff actions
const addItemMutation = useMutation({
  mutationFn: (data: AddChecklistItemInput) =>
    addChecklistItem(caseId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
    toast.success('Item added successfully')
  },
})

// Render components
<ChecklistProgress items={checklistData.items} />
<TieredChecklist
  items={checklistData.items}
  isStaffView={true}
  onAddItem={() => setShowModal(true)}
  onSkip={(itemId, reason) => skipItemMutation.mutate({itemId, reason})}
/>
<AddChecklistItemModal isOpen={showModal} onClose={() => setShowModal(false)} />
```

## Zod Schemas

### Path: `apps/api/src/routes/cases/schemas.ts`

New validation schemas for checklist operations:

```typescript
// Add checklist item
export const addChecklistItemSchema = z.object({
  docType: z.string().min(1, 'Document type is required').max(100),
  reason: z.string().max(500, 'Reason too long (max 500 chars)').optional(),
  expectedCount: z.number().int().min(1).max(99).default(1),
})

// Skip checklist item
export const skipChecklistItemSchema = z.object({
  reason: z.string()
    .min(1, 'Reason is required')
    .max(500, 'Reason too long (max 500 chars)'),
})

// Update checklist item notes
export const updateChecklistItemNotesSchema = z.object({
  notes: z.string().max(1000, 'Notes too long (max 1000 chars)'),
})
```

## Security & Auth Considerations

### Current State
- User tracking fields (`addedById`, `skippedById`) currently set to `null`
- Marked with `TODO(auth)` for future Clerk integration

### Future Implementation
When Clerk auth middleware is complete:
1. Extract user ID from auth context
2. Set `userId` from authenticated request
3. Audit trail automatically recorded in database

## Testing Coverage

### Backend (API Endpoints)
- Test duplicate prevention (same docType/case)
- Test invalid docType handling
- Test status inference on unskip (with/without raw images)
- Test reason validation (required, length limits)
- Test case/item ownership validation

### Frontend (Components)
- Test tier grouping logic with various template combinations
- Test staff action callbacks (skip, unskip, add item)
- Test modal form validation
- Test error states and loading states
- Test accessibility (keyboard navigation, ARIA labels)

## Viet-First UI Considerations

All tier labels and status messages use Vietnamese first:
- Tier Labels: "BẮT BUỘC", "THEO TÌNH HUỐNG", "CÓ THỂ CẦN"
- Status Labels: "Đã xác minh", "Đã trích xuất", "Đã nhận ảnh", "Chưa có", "Không cần"
- Form Labels: Bilingual headers for international support

## File References

| File | Size | Purpose |
|------|------|---------|
| `packages/db/prisma/schema.prisma` | 450+ lines | Database schema with override fields |
| `apps/api/src/routes/cases/index.ts` | 600+ lines | 4 new endpoints for checklist management |
| `apps/api/src/routes/cases/schemas.ts` | 80+ lines | Zod validation schemas |
| `apps/workspace/src/lib/api-client.ts` | 300+ lines | HTTP client with new methods |
| `apps/workspace/src/lib/checklist-tier-constants.ts` | 45 lines | Tier and status constants |
| `apps/workspace/src/components/cases/checklist-progress.tsx` | 50 lines | Progress bar component |
| `apps/workspace/src/components/cases/tiered-checklist.tsx` | 350+ lines | Main checklist component |
| `apps/workspace/src/components/cases/add-checklist-item-modal.tsx` | 140 lines | Modal for adding items |

## Next Steps

1. **Auth Integration**: Update API endpoints to use Clerk user context when available
2. **Testing**: Add comprehensive test suites for new endpoints and components
3. **Analytics**: Track staff override usage for optimization insights
4. **Performance**: Consider pagination for large checklists (50+ items)
5. **UI Polish**: Gather feedback on tier color scheme and visual hierarchy
