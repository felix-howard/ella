# Scout Report: Create Client & Send Message Flow

**Date**: 2026-04-09  
**Status**: Complete  
**Scope**: Workspace app (frontend) + API (backend)

## Summary

Traced complete flow for "Create Client & Send Message" feature across frontend and backend.

---

## 1. FRONTEND: Create Client Wizard

**Entry Point**: `apps/workspace/src/routes/clients/new.tsx`

Multi-path wizard supporting 3 client types:
1. INDIVIDUAL (form + confirm SMS)
2. BUSINESS (form only, no SMS)
3. INDIVIDUAL_WITH_BUSINESS (2 forms + confirm SMS)

### Key Functions:
- `handleTypeSelect()` - Route to form
- `handleNext()` / `handleBack()` - Navigate steps
- `handleSubmit()` - Calls API to create client + send SMS
- `checkExistingClient()` - Phone lookup for returning clients
- `validateBasicInfo()` / `validateBusinessInfo()` - Form validation

### State:
- Client creation type
- Current wizard step
- Form data (individual, business)
- Custom SMS messages (VI/EN)
- Submission state (loading, errors)

---

## 2. FRONTEND: Confirm Step & SMS Edit

**Component**: `apps/workspace/src/components/clients/confirm-step.tsx`

Shows SMS preview + edit before creation:
- Client summary (name, phone, tax year)
- Editable message template
- Language toggle (VI/EN)
- Placeholder guide

### Default Templates:
**VI**: "Xin chào {{client_name}}, để chuẩn bị hồ sơ thuế năm {{tax_year}}, vui lòng gửi..."  
**EN**: "Hello {{client_name}}, to prepare your {{tax_year}} tax documents, please send..."

---

## 3. FRONTEND: API Client

**File**: `apps/workspace/src/lib/api-client.ts` (lines 229-289)

### Create Endpoints:

```typescript
clients.create(data) -> POST /clients
clients.createWithBusiness(data) -> POST /clients/create-with-business
clients.sendUploadLink(id, customMessage) -> POST /clients/{id}/send-upload-link
```

### Payload Structure:
- firstName, lastName (or business name)
- phone (E.164: +1XXXXXXXXXX)
- email (sanitized)
- language (VI | EN)
- clientType (INDIVIDUAL | BUSINESS)
- businessType, ein, businessAddress, etc.
- profile: { taxYear, taxTypes, intakeAnswers }
- customMessage (optional SMS template)

---

## 4. BACKEND: Client Creation Routes

**File**: `apps/api/src/routes/clients/index.ts`

### Route 1: POST /clients (Single Client)
**Lines**: 383-545

Flow:
1. Validate request
2. Create Client + Profile + TaxCase in transaction
3. Create Engagement for tax year
4. Create Conversation (for Messages tab)
5. Generate checklist
6. Create magic link
7. Send welcome SMS (async, non-blocking)

Response: Client ID, tax case ID, magic link, SMS status

### Route 2: POST /clients/create-with-business (Linked Pair)
**Lines**: 1462-1613

Flow:
1. Create individual client + engagement + tax case
2. Create business client + engagement + tax case
3. Create ClientGroup linking both
4. All in single transaction (atomic)

Response: Individual + business IDs, group info

---

## 5. BACKEND: SMS Service

**File**: `apps/api/src/services/sms/message-sender.ts` (lines 59-106)

### Function: sendWelcomeMessage()

```typescript
sendWelcomeMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  taxYear: number,
  language: 'VI' | 'EN',
  customMessage?: string,
  staffId?: string
)
```

### Template Priority:
1. Custom message (from form) - highest
2. Database template (messageTemplate table)
3. Hardcoded template

### Processing:
- Replace {{client_name}} → actual name
- Replace {{tax_year}} → actual year
- Replace {{portal_link}} → magic link
- Record message in DB
- Publish real-time event
- Return status

---

## File Mapping

### Frontend (Workspace)

| File | Purpose |
|------|---------|
| `apps/workspace/src/routes/clients/new.tsx` | Main wizard page |
| `apps/workspace/src/components/clients/confirm-step.tsx` | SMS preview/edit |
| `apps/workspace/src/components/clients/basic-info-form.tsx` | Individual form |
| `apps/workspace/src/components/clients/business-info-form.tsx` | Business form |
| `apps/workspace/src/components/clients/client-type-selector.tsx` | Type selection |
| `apps/workspace/src/components/clients/returning-client-section.tsx` | Existing client UI |
| `apps/workspace/src/components/clients/create-engagement-modal.tsx` | Year copy modal |
| `apps/workspace/src/lib/api-client.ts` | HTTP client |

### Backend (API)

| File | Purpose |
|------|---------|
| `apps/api/src/routes/clients/index.ts` | Create endpoints |
| `apps/api/src/routes/clients/schemas.ts` | Validation |
| `apps/api/src/services/sms/message-sender.ts` | SMS sending |
| `apps/api/src/services/sms/templates/index.ts` | Templates |
| `apps/api/src/services/magic-link.ts` | Magic link gen |
| `apps/api/src/services/checklist-generator.ts` | Checklist |

---

## Data Flow

```
User fills form
  ↓
Edits SMS message
  ↓
Submits form
  ↓
POST /clients (or /clients/create-with-business)
  ↓
Backend: Create Client + Profile + TaxCase (transaction)
  ↓
Backend: Find/create Engagement
  ↓
Backend: Create Conversation
  ↓
Backend: Generate Checklist
  ↓
Backend: Create Magic Link
  ↓
Backend: Send SMS (async)
  - Select template (custom > DB > hardcoded)
  - Replace placeholders
  - Call Twilio
  - Record in DB
  ↓
Frontend: Navigate to /clients/{clientId}
```

---

## Key Features

1. **Message Customization**: Edit SMS before sending
2. **Returning Client Detection**: Phone-based lookup
3. **Engagement Copy**: Option to copy profile from previous year
4. **Atomic Transaction**: All DB changes succeed or fail together
5. **Async SMS**: Non-blocking SMS send (race condition safe)
6. **Magic Link**: Always generated, required for portal
7. **Language Support**: VI/EN with user override
8. **Entity Linking**: Individual + Business creates ClientGroup
9. **Placeholder System**: {{client_name}}, {{tax_year}}, {{portal_link}}

