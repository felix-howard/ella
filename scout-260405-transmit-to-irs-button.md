# Scout Report: Transmit to IRS Button Implementation

**Date:** 2026-04-05  
**Task:** Find code for "Transmit to IRS" button in 1099-NEC section

## Summary

Found complete implementation of the "Transmit to IRS" button with confirmation UI and API integration. Button uses inline confirmation pattern (toggle state) rather than modal dialog.

---

## Files Found

### 1. Main Button Component
**Path:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/cases/tabs/form-1099-nec-tab/form-actions-panel.tsx`

- **Component:** `FormActionsPanel`
- **Lines:** 258-267 (button render), 152-166 (mutation handler)
- **Status:** Production code

### 2. Supporting Files
**Path:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/cases/tabs/form-1099-nec-tab/index.tsx`

- Orchestrates FormActionsPanel component
- Manages contractor state and mutations

**Path:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts`

- API integration: `api.form1099nec.transmit(businessId)`
- Response type: `TransmitResponse`

---

## Key Code Snippets

### Button Component (Lines 231-268)

```tsx
{showConfirm ? (
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-muted-foreground">Transmit {status.pdfReady} forms?</span>
    <Button
      variant="destructive"
      size="sm"
      onClick={() => transmitMutation.mutate()}
      disabled={transmitMutation.isPending}
      className="gap-1.5"
    >
      {transmitMutation.isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Send className="w-3.5 h-3.5" />
      )}
      Confirm
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowConfirm(false)}
      disabled={transmitMutation.isPending}
    >
      Cancel
    </Button>
  </div>
) : (
  <Button
    variant="default"
    size="sm"
    onClick={() => setShowConfirm(true)}
    disabled={status.pdfReady === 0}
    className="gap-1.5"
  >
    <Send className="w-3.5 h-3.5" />
    3. Transmit to IRS
  </Button>
)}
```

### Mutation Handler (Lines 152-166)

```tsx
const transmitMutation = useMutation({
  mutationFn: () => api.form1099nec.transmit(businessId),
  onSuccess: (data) => {
    toast.success(`Transmitted ${data.transmittedCount} forms to IRS`)
    refreshStatus()
    queryClient.invalidateQueries({ queryKey: ['filing-batches', businessId] })
    setShowConfirm(false)
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : 'Transmission failed')
    setShowConfirm(false)
  },
})
```

### State Management (Line 152)

```tsx
const [showConfirm, setShowConfirm] = useState(false)
```

---

## Implementation Details

### Confirmation Pattern
- **Type:** Inline confirmation (not modal)
- **Trigger:** Click "Transmit to IRS" button
- **UI Change:** Reveals confirmation message + Confirm/Cancel buttons
- **Message:** "Transmit {count} forms?" where count = `status.pdfReady`

### Button States
1. **Default:** "Transmit to IRS" button (default variant)
   - Disabled if `status.pdfReady === 0`
   
2. **Confirmation:** Shows:
   - Text: "Transmit {count} forms?"
   - Confirm button (destructive variant, red)
   - Cancel button (ghost variant)

### Loading State
- Spinner icon during API call
- Button text changes to loading indicator

### API Integration
- **Endpoint:** `POST /businesses/{businessId}/1099-nec/transmit`
- **Response:** `{ success: boolean; batchId: string; transmittedCount: number }`
- **Success:** Toast notification + query cache invalidation
- **Error:** Toast error message

---

## Reference Modal Examples

For style consistency, existing confirmation modals in codebase:

### 1. Delete Contractor Modal
**Path:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/cases/tabs/form-1099-nec-tab/contractor-table.tsx` (Lines 160-183)

```tsx
<Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
  <ModalHeader>
    <ModalTitle>Delete Contractor</ModalTitle>
    <ModalDescription>
      Are you sure you want to delete <span className="font-semibold">{confirmDelete?.firstName} {confirmDelete?.lastName}</span>? This action cannot be undone.
    </ModalDescription>
  </ModalHeader>
  <ModalFooter>
    <Button variant="outline" onClick={() => setConfirmDelete(null)}>
      Cancel
    </Button>
    <Button variant="destructive" onClick={handleDelete}>
      Delete
    </Button>
  </ModalFooter>
</Modal>
```

### 2. Revoke Link Modal (More Complex)
**Path:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/draft-return/revoke-link-modal.tsx`

- Uses `ModalBody` for descriptive content
- Includes warning box with `AlertTriangle` icon
- Shows current state info
- Uses `destructive` variant for action button
- Loading state with spinner + text change

### 3. Delete All Contractors Modal
**Path:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/cases/tabs/form-1099-nec-tab/index.tsx` (Lines 295-325)

```tsx
<Modal open={showDeleteAll} onClose={() => setShowDeleteAll(false)}>
  <ModalHeader>
    <ModalTitle>Delete All Contractors</ModalTitle>
  </ModalHeader>
  <div className="p-4">
    <p className="text-sm text-muted-foreground">
      Are you sure you want to delete all <span className="font-semibold text-foreground">{contractors.length}</span> contractors
      and their associated 1099-NEC forms? This action cannot be undone.
    </p>
  </div>
  <ModalFooter>
    <Button variant="outline" size="sm" onClick={() => setShowDeleteAll(false)}>
      Cancel
    </Button>
    <Button variant="destructive" size="sm" onClick={() => deleteAllMutation.mutate()}>
      {deleteAllMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      Delete All
    </Button>
  </ModalFooter>
</Modal>
```

---

## UI Component Library

All buttons and modals use `@ella/ui` components:
- `Button` - with variants: `default`, `destructive`, `outline`, `ghost`
- `Modal`, `ModalHeader`, `ModalTitle`, `ModalDescription`, `ModalBody`, `ModalFooter`
- Icons from `lucide-react`: `Send`, `Loader2`, `AlertTriangle`

---

## Style Pattern Observations

### Modal/Confirmation Styling
1. **Title:** Bold, clear action verb
2. **Description:** Explanatory text with bold counts/names
3. **Buttons:**
   - Outline variant for Cancel
   - Destructive variant for destructive actions
4. **Loading:** Spinner icon + disabled state on buttons
5. **Icons:** Used in headers and button labels

### Current "Transmit to IRS" Pattern (Inline)
- Simpler than modal (no new layer)
- Shows confirmation inline within workflow steps
- Count of forms included in confirmation text
- Both buttons (Confirm/Cancel) appear together

---

## Next Steps for Modal Implementation

If converting to modal dialog:

1. Replace `showConfirm` state with modal opener
2. Extract confirmation UI to new modal component (e.g., `TransmitIrsModal`)
3. Follow `RevokeLinkModal` pattern for styling consistency
4. Include warning content similar to delete modals
5. Show form count and summary in modal body

---

## Unresolved Questions

1. Should "Transmit to IRS" use modal dialog instead of inline confirmation?
2. Should warning content be added (e.g., "This action cannot be undone")?
3. Should filing batch status be shown in confirmation?
