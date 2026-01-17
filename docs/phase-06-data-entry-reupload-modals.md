# Phase 06: Data Entry & Re-upload Modals (Complete - 2026-01-15)

**Focus:** OltPro data entry workflow and intelligent re-upload request system with Vietnamese SMS integration.

## Overview

Phase 06 implements two specialized modals enabling efficient post-verification workflows:

1. **DataEntryModal** - Split-screen copy-paste workflow for OltPro data entry with progress tracking
2. **ReUploadRequestModal** - Intelligent re-upload request generation with auto-translated Vietnamese messages

**Components Added:**
- DataEntryModal (Split-screen image + copyable fields)
- ReUploadRequestModal (Reason selection + SMS/note dispatch)
- DOC_TYPE_FIELDS mapping (20+ document types × fields)

**Status:** Production-ready with Vietnamese localization, clipboard integration, and real-time SMS sending.

---

## Core Components

### 1. DataEntryModal

**File:** `apps/workspace/src/components/documents/data-entry-modal.tsx`

**Purpose:** Split-screen modal for manual OltPro data entry workflow. Left panel displays zoomable document image; right panel shows extracted fields as copyable elements with progress tracking.

#### Props Interface

```typescript
interface DataEntryModalProps {
  /** Document for data entry */
  doc: DigitalDoc
  /** Whether modal is open */
  isOpen: boolean
  /** Callback when modal closes */
  onClose: () => void
  /** Case ID for query invalidation */
  caseId: string
}
```

#### Layout & Behavior

**Header Section:**
- Document type label (Vietnamese: "Chế độ nhập liệu - [Doc Type]")
- "Đã hoàn tất" (Completed) badge when `entryCompleted === true`
- Close button (X icon)

**Split-Screen Content:**

| Left Panel (50% width) | Right Panel (50% width) |
|---|---|
| **Image Viewer** | **Field Copy List** |
| Zoomable document reference | Extracted field values |
| Responsive: 50% height on mobile | Copyable with state tracking |
| Loading spinner during signed URL fetch | Progress indicator at bottom |
| Fallback on invalid/blocked URLs | Action buttons (Reset, Complete) |

**Right Panel Sections:**

1. **Status Header** (small text)
   - "Sao chép dữ liệu sang OltPro - nhấn nút Copy để sao chép từng trường"

2. **Fields List (scrollable)**
   - Uses CopyableField component (imported from `../ui/copyable-field`)
   - Field label from `getFieldLabel(fieldKey)` (Vietnamese translations)
   - Value: `String(extractedData[fieldKey])`
   - Copied state: `copiedFields[fieldKey]` (boolean)
   - Disabled during mutation pending

3. **Progress Section (footer)**
   - ProgressIndicator: "{copiedCount}/{totalFields}"
   - Calculates from non-metadata fields in extractedData

4. **Action Buttons (footer)**
   - "Reset tiến độ" (Reset Progress)
     - Disabled if `copiedCount === 0`
     - Clears all copied field flags
     - Invalidates case query
   - "Đánh dấu hoàn tất" (Mark Complete)
     - Disabled if not all fields copied
     - Calls `api.docs.completeEntry(docId)`
     - Shows "Đã hoàn tất" when already completed

#### Field Extraction Logic

```typescript
// Filters applied to extractedData
const fieldEntries = Object.entries(extractedData).filter(
  ([key, value]) => {
    // Exclude metadata fields
    if (isExcludedField(key)) return false
    // Exclude nested objects (arrays, objects)
    if (typeof value === 'object') return false
    return true
  }
)
```

**Excluded Fields:** (via `isExcludedField()`)
- `_metadata`, `_confidence`, `_timestamp`, etc.
- Nested objects and arrays (kept in DigitalDoc but not displayed)

#### Copy State Tracking

**State Structure:**
```typescript
doc.copiedFields: Record<string, boolean> = {
  employerName: true,
  wages: true,
  employeeSsn: false,
  // ...
}
```

**Mutation Flow:**
1. User clicks Copy button on field
2. Call `api.docs.markCopied(docId, fieldKey)`
3. Optimistic update: set `copiedFields[fieldKey] = true`
4. On success: invalidate case query (full refresh)
5. On error: rollback UI state, show error toast

#### Progress Calculation

```typescript
const totalFields = fields.length                        // Non-metadata only
const copiedCount = fields.filter(([key]) => copiedFields[key]).length
const allCopied = totalFields > 0 && copiedCount === totalFields

// Percentage
const percentage = (copiedCount / totalFields) * 100
```

#### Security - Signed URL Validation

```typescript
function isValidSignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const trustedHosts = [
      '.r2.cloudflarestorage.com',
      '.amazonaws.com',
      '.storage.googleapis.com',
      '.blob.core.windows.net',
    ]
    return trustedHosts.some((host) => parsed.hostname.endsWith(host))
  } catch {
    return false
  }
}
```

**Protects against:** XSS via malformed URLs, man-in-the-middle (enforces HTTPS), unauthorized storage access.

#### Vietnamese Messages

```typescript
const MESSAGES = {
  COPY_SUCCESS: 'Đã sao chép',
  COPY_ERROR: 'Lỗi sao chép',
  COMPLETE_SUCCESS: 'Đã hoàn tất nhập liệu',
  COMPLETE_ERROR: 'Lỗi hoàn tất nhập liệu',
  RESET_SUCCESS: 'Đã reset tiến độ',
  RESET_ERROR: 'Lỗi reset tiến độ',
  ALL_FIELDS_REQUIRED: 'Vui lòng sao chép tất cả các trường trước khi hoàn tất',
}
```

---

### 2. ReUploadRequestModal

**File:** `apps/workspace/src/components/documents/reupload-request-modal.tsx`

**Purpose:** Modal for requesting client re-upload of documents with AI-generated Vietnamese SMS messages. Allows CPA to select reason, unreadable fields, customize message, and send via SMS or internal note.

#### Props Interface

```typescript
interface ReUploadRequestModalProps {
  /** Raw image that needs re-upload */
  image: RawImage
  /** Pre-selected unreadable fields from verification */
  unreadableFields?: string[]
  /** Whether modal is open */
  isOpen: boolean
  /** Callback when modal closes */
  onClose: () => void
  /** Case ID for query invalidation */
  caseId: string
}
```

#### Form Sections

**1. Reason Selection (Required)**

Pre-defined Vietnamese reasons:
```typescript
const REUPLOAD_REASONS = [
  { id: 'blurry', label: 'Ảnh bị mờ, không đọc được' },
  { id: 'partial', label: 'Thiếu một phần tài liệu' },
  { id: 'wrong_type', label: 'Sai loại tài liệu' },
  { id: 'other', label: 'Khác' },
]
```

- Radio button selection (single choice)
- If "other": shows text input for custom reason
- Styling: selected reason highlighted with primary color

**2. Unreadable Field Selection**

- Available fields from `DOC_TYPE_FIELDS[image.classifiedType]`
- Rendered as clickable badges
- Multiple selection (checkboxes)
- Selected badges highlighted with primary color
- Fallback for unknown doc types: `DOC_TYPE_FIELDS.OTHER` fields

**3. Message Generation & Editing**

**Auto-Generated Message Pattern:**
```
Xin chào, [docTypeLabel] của bạn [reasonText]. Vui lòng chụp lại rõ hơn phần [fieldList]. Cảm ơn!
```

**Example:**
```
Xin chào, W2 của bạn ảnh bị mờ, không đọc được. Vui lòng chụp lại rõ hơn phần wages, federalWithholding. Cảm ơn!
```

- **docTypeLabel:** from `DOC_TYPE_LABELS[image.classifiedType]`
- **reasonText:** lowercase reason label or custom text
- **fieldList:** Vietnamese field labels joined by ", " (from `getFieldLabel()`)

**Edit Toggle:**
- Shows "Sửa tin nhắn" (Edit message) when in preview mode
- Shows "Dùng tin tự động" (Use auto-generated) when in edit mode
- Editing via textarea (3 rows, full width)
- Reset to auto-generated when toggling back to preview

**4. Send Method Selection**

Two options:
- **SMS** (default)
  - Calls `api.images.requestReupload()` with `sendSms: true`
  - Triggers Twilio SMS to client phone
  - Success message: "Đã gửi yêu cầu tải lại và SMS cho khách"
- **Note Only**
  - Calls `api.images.requestReupload()` with `sendSms: false`
  - Saves to internal case notes only
  - No SMS sent to client
  - Helps note: "Không gửi SMS, chỉ lưu ghi chú trong hệ thống"

#### Form Validation

- **Submit disabled if:** No fields selected
- **Validation message:** "Vui lòng chọn ít nhất một trường"

#### State Management

```typescript
type ReuploadReasonId = 'blurry' | 'partial' | 'wrong_type' | 'other'

const [reason, setReason] = useState<ReuploadReasonId>('blurry')
const [otherReason, setOtherReason] = useState('')
const [selectedFields, setSelectedFields] = useState<string[]>(unreadableFields)
const [customMessage, setCustomMessage] = useState('')
const [sendMethod, setSendMethod] = useState<'sms' | 'note'>('sms')
const [isEditingMessage, setIsEditingMessage] = useState(false)
```

#### Reset Behavior

Form resets when modal opens (`isOpen` → true):
```typescript
useEffect(() => {
  if (isOpen) {
    setReason('blurry')
    setOtherReason('')
    setSelectedFields(unreadableFields)  // Pre-populated from prop
    setCustomMessage('')
    setSendMethod('sms')
    setIsEditingMessage(false)
  }
}, [isOpen, unreadableFields])
```

#### Mutation Handler

```typescript
const requestMutation = useMutation({
  mutationFn: () => {
    const reasonToSend = reason === 'other' ? otherReason : reason
    return api.images.requestReupload(image.id, {
      reason: reasonToSend,
      fields: selectedFields,
      sendSms: sendMethod === 'sms',
    })
  },
  onSuccess: (data) => {
    const message = data.smsSent
      ? 'Đã gửi yêu cầu tải lại và SMS cho khách'
      : 'Đã gửi yêu cầu tải lại'
    toast.success(message)
    queryClient.invalidateQueries({ queryKey: ['case', caseId] })
    onClose()
  },
  onError: () => {
    toast.error('Lỗi gửi yêu cầu')
  },
})
```

#### Vietnamese Messages

```typescript
const MESSAGES = {
  REQUEST_SUCCESS: 'Đã gửi yêu cầu tải lại',
  REQUEST_SUCCESS_WITH_SMS: 'Đã gửi yêu cầu tải lại và SMS cho khách',
  REQUEST_ERROR: 'Lỗi gửi yêu cầu',
  SELECT_FIELDS: 'Vui lòng chọn ít nhất một trường',
}
```

---

### 3. DOC_TYPE_FIELDS Mapping

**File:** `apps/workspace/src/lib/doc-type-fields.ts`

**Purpose:** Central mapping of document types to their expected data fields. Used by ReUploadRequestModal, DataEntryModal, and verification workflows.

#### Supported Document Types (20+)

**Income Documents:**
- `W2` (14 fields)
- `FORM_1099_INT` (5 fields)
- `FORM_1099_DIV` (7 fields)
- `FORM_1099_NEC` (5 fields)
- `FORM_1099_MISC` (5 fields)
- `FORM_1099_K` (7 fields)
- `FORM_1099_R` (7 fields)
- `FORM_1099_G` (6 fields)
- `FORM_1099_SSA` (6 fields)

**Deduction Documents:**
- `FORM_1098` (7 fields)
- `FORM_1098_T` (7 fields)

**Identity Documents:**
- `SSN_CARD` (2 fields)
- `DRIVER_LICENSE` (9 fields)
- `PASSPORT` (9 fields)
- `BIRTH_CERTIFICATE` (5 fields)

**Business Documents:**
- `BUSINESS_LICENSE` (5 fields)
- `EIN_LETTER` (3 fields)
- `PROFIT_LOSS_STATEMENT` (4 fields)
- `BANK_STATEMENT` (5 fields)

**Expense Documents:**
- `DAYCARE_RECEIPT` (4 fields)
- `RECEIPT` (5 fields)

**Fallback:**
- `OTHER` (4 fields)
- `UNKNOWN` (4 fields)

#### Field Examples

```typescript
W2: [
  'employerName',
  'employerEIN',
  'employerAddress',
  'employeeName',
  'employeeSsn',
  'employeeAddress',
  'wages',
  'federalWithholding',
  'socialSecurityWages',
  'socialSecurityTax',
  'medicareWages',
  'medicareTax',
  'stateTax',
  'localTax',
],

DRIVER_LICENSE: [
  'name',
  'firstName',
  'lastName',
  'address',
  'licenseNumber',
  'expirationDate',
  'dateOfBirth',
  'stateIssued',
  'sex',
],
```

#### Helper Functions

```typescript
/**
 * Get fields for a document type with fallback to OTHER
 */
export function getDocTypeFields(docType: string): string[] {
  return DOC_TYPE_FIELDS[docType] || DOC_TYPE_FIELDS.OTHER || []
}

/**
 * Check if a field is valid for a given document type
 */
export function isValidFieldForDocType(docType: string, fieldKey: string): boolean {
  const fields = getDocTypeFields(docType)
  return fields.includes(fieldKey)
}
```

**Field Fallback Chain:**
1. Exact type match: `DOC_TYPE_FIELDS[docType]`
2. Unknown type: `DOC_TYPE_FIELDS.OTHER`
3. Empty fallback: `[]`

---

## Integration Pattern

### Client Detail Page Integration

**File:** `apps/workspace/src/routes/clients/$clientId.tsx`

**State Management:**
```typescript
// Data entry modal
const [dataEntryDoc, setDataEntryDoc] = useState<DigitalDoc | null>(null)
const [isDataEntryModalOpen, setIsDataEntryModalOpen] = useState(false)

// Re-upload request modal
const [reuploadImage, setReuploadImage] = useState<RawImage | null>(null)
const [reuploadFields, setReuploadFields] = useState<string[]>([])
const [isReuploadModalOpen, setIsReuploadModalOpen] = useState(false)
```

**Opening DataEntryModal:**
```typescript
const handleDataEntry = (doc: DigitalDoc) => {
  setDataEntryDoc(doc)
  setIsDataEntryModalOpen(true)
}

// Render in tab
<DataEntryModal
  doc={dataEntryDoc!}
  isOpen={isDataEntryModalOpen}
  onClose={() => setIsDataEntryModalOpen(false)}
  caseId={clientId}
/>
```

**Opening ReUploadRequestModal:**
```typescript
const handleRequestReupload = (image: RawImage, unreadableFields: string[] = []) => {
  setReuploadImage(image)
  setReuploadFields(unreadableFields)
  setIsReuploadModalOpen(true)
}

// Render in tab
<ReUploadRequestModal
  image={reuploadImage!}
  unreadableFields={reuploadFields}
  isOpen={isReuploadModalOpen}
  onClose={() => setIsReuploadModalOpen(false)}
  caseId={clientId}
/>
```

**Event Flow from VerificationModal:**
```typescript
// VerificationModal footer
<Button
  variant="secondary"
  onClick={() => {
    // Pass unreadable fields selected in verification
    const unreadable = Object.entries(fieldVerifications)
      .filter(([_, status]) => status?.status === 'unreadable')
      .map(([key]) => key)

    onRequestReupload?.(doc, unreadable)
  }}
>
  Yêu cầu tải lại
</Button>

// Parent handler
onRequestReupload={(doc, fields) => {
  handleRequestReupload(doc.rawImage!, fields)
}}
```

---

## API Integration

### DataEntryModal Mutations

**Mark Field Copied:**
```typescript
POST /api/docs/{docId}/mark-copied
Body: { field: string }
Response: { success: boolean }
```

**Complete Entry:**
```typescript
POST /api/docs/{docId}/complete-entry
Response: { success: boolean }
```

**Get Signed URL:**
```typescript
GET /api/images/{rawImageId}/signed-url
Response: { url: string }
```

### ReUploadRequestModal Mutations

**Request Reupload:**
```typescript
POST /api/images/{imageId}/request-reupload
Body: {
  reason: string          // 'blurry' | 'partial' | 'wrong_type' | custom text
  fields: string[]        // Selected unreadable fields
  sendSms: boolean        // true = SMS, false = note only
}
Response: {
  success: boolean
  smsSent: boolean        // Indicates if SMS was successfully sent
}
```

---

## UI Components Used

### From @ella/ui

- `Badge` - Field selection badges in ReUploadRequestModal
- `Button` - Action buttons (reset, complete, submit)
- `Modal`, `ModalHeader`, `ModalTitle`, `ModalDescription`, `ModalBody`, `ModalFooter` - Container for ReUploadRequestModal

### Custom Components

- `CopyableField` (from `../ui/copyable-field`) - Field with copy button in DataEntryModal
- `ImageViewer` (from `../ui/image-viewer`) - Zoomable document display
- `ProgressIndicator` (from `../ui/progress-indicator`) - Copy progress bar

---

## Design Highlights

### DataEntryModal

✅ **Split-screen layout** - Reference image + copyable fields side-by-side
✅ **Progress tracking** - Visual progress bar with count
✅ **Responsive** - Stacks vertically on mobile (50% height each section)
✅ **Keyboard friendly** - Tab navigation, Esc to close
✅ **Error handling** - Fallback UI for missing images, retry button
✅ **Security** - Signed URL validation (HTTPS only, trusted hosts)

### ReUploadRequestModal

✅ **Smart defaults** - Pre-selects unreadable fields from verification
✅ **Vietnamese UX** - All labels, buttons, messages in Vietnamese
✅ **Flexible messaging** - Auto-generated + manual edit capability
✅ **Dual delivery** - SMS or internal note
✅ **Accessible** - Radio buttons, badge checkboxes, proper ARIA labels
✅ **Validation** - Cannot submit without selected fields

---

## Vietnamese Localization

### DataEntryModal

| Element | Vietnamese |
|---|---|
| Header | "Chế độ nhập liệu - [Doc Type]" |
| Completed badge | "Đã hoàn tất" |
| Status text | "Sao chép dữ liệu sang OltPro - nhấn nút Copy để sao chép từng trường" |
| Reset button | "Reset tiến độ" |
| Complete button | "Đánh dấu hoàn tất" or "Đã hoàn tất" |
| Success toast | "Đã hoàn tất nhập liệu" |
| Error toast | "Lỗi hoàn tất nhập liệu" or "Vui lòng sao chép tất cả các trường trước khi hoàn tất" |

### ReUploadRequestModal

| Element | Vietnamese |
|---|---|
| Title | "Yêu cầu tải lại ảnh" |
| Reason label | "Lý do yêu cầu tải lại:" |
| Reason options | "Ảnh bị mờ, không đọc được" / "Thiếu một phần tài liệu" / "Sai loại tài liệu" / "Khác" |
| Fields label | "Các trường không đọc được:" |
| No fields note | "Không có trường nào cho loại tài liệu này" |
| Message label | "Tin nhắn gửi khách hàng:" |
| Edit toggle | "Sửa tin nhắn" / "Dùng tin tự động" |
| Send method label | "Phương thức gửi:" |
| SMS option | "SMS" |
| Note option | "Chỉ ghi chú" |
| Note hint | "Không gửi SMS, chỉ lưu ghi chú trong hệ thống" |
| Cancel button | "Hủy" |
| Submit button | "Gửi yêu cầu" or "Đang gửi..." |
| Success toast | "Đã gửi yêu cầu tải lại và SMS cho khách" or "Đã gửi yêu cầu tải lại" |
| Error toast | "Lỗi gửi yêu cầu" or "Vui lòng chọn ít nhất một trường" |

---

## File Exports

**Component Barrel Export:**
`apps/workspace/src/components/documents/index.ts`

```typescript
// Data Entry and Re-upload Modals (Phase 06)
export { DataEntryModal, type DataEntryModalProps } from './data-entry-modal'
export { ReUploadRequestModal, type ReUploadRequestModalProps } from './reupload-request-modal'
```

---

## Testing Checklist

- [ ] **DataEntryModal:**
  - [ ] Modal opens/closes correctly
  - [ ] Image loads with signed URL validation
  - [ ] Copy button marks field as copied
  - [ ] Progress updates correctly
  - [ ] Reset clears copied state
  - [ ] Complete disabled until all fields copied
  - [ ] Keyboard navigation (Tab, Escape)
  - [ ] Responsive layout on mobile

- [ ] **ReUploadRequestModal:**
  - [ ] Reason selection works
  - [ ] "Other" reason shows text input
  - [ ] Field selection toggles correctly
  - [ ] Auto-generated message updates with selections
  - [ ] Edit mode allows custom message
  - [ ] Send method toggle (SMS/Note)
  - [ ] Submit disabled without selected fields
  - [ ] SMS sends successfully (or note-only)
  - [ ] Modal closes after submission

- [ ] **DOC_TYPE_FIELDS:**
  - [ ] All 20+ document types have field arrays
  - [ ] Fallback to OTHER for unknown types
  - [ ] Helper functions (getDocTypeFields, isValidFieldForDocType)

---

## Known Limitations & Future Enhancements

**Current:**
- Reset progress does client-side query invalidation only (no dedicated reset API)
- SMS sending via Twilio requires `TWILIO_*` env vars configured
- Field labels depend on `getFieldLabel()` returning Vietnamese translations

**Future:**
- Bulk reset API endpoint for DataEntryModal
- SMS template customization per organization
- OCR confidence filtering (hide low-confidence fields)
- Batch re-upload requests (multiple images)

---

## Related Documentation

- **Phase 05:** [Verification Modal](./phase-05-verification-modal.md)
- **API:** Document endpoints in backend service
- **Constants:** `DOC_TYPE_LABELS` in `lib/constants`
- **Utilities:** `getFieldLabel()` from `lib/field-labels`

