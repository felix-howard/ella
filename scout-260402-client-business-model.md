# Client & Business Data Model Scout Report
**Date:** 2026-04-02

## Summary
Client-centric model with dual INDIVIDUAL/BUSINESS support. All business info on Client model (no separate Business entity). 1099-NEC workflow: Client → Contractor → Form1099NEC → FilingBatch.

## 1. Prisma Models

### Client
**Location:** `packages/db/prisma/schema.prisma:538-593`

Core: id, firstName, lastName, phone(unique), email, language(VI|EN), clientType(INDIVIDUAL|BUSINESS), tags

Business Fields (if BUSINESS):
- businessName, businessType enum, einEncrypted (AES-256), businessAddress, businessCity, businessState, businessZip

Profile: avatarUrl, notes, notesUpdatedAt

Relations: engagements(TaxEngagement[]), taxCases, contractors, filingBatches, convertedLeads

Audit: organizationId, managedById, createdById, updatedById + timestamps

### Contractor
**Location:** `packages/db/prisma/schema.prisma:1429-1450`

clientId(FK), firstName, lastName, ssnEncrypted(AES-256), ssnLast4(unencrypted), address, city, state, zip, email?, phone?

### Form1099NEC
**Location:** `packages/db/prisma/schema.prisma:1466-1490`

contractorId(FK), batchId?(FK), taxYear, amountBox1, amountBox4(Decimal), pdfStorageKey?, status(DRAFT|IMPORTED|PDF_READY|SUBMITTED|ACCEPTED|REJECTED), taxbanditsRecordId?, validationErrors[]

Status progression: DRAFT → IMPORTED → PDF_READY → SUBMITTED → ACCEPTED

### FilingBatch
**Location:** `packages/db/prisma/schema.prisma:1501-1525`

clientId(FK), taxYear, status(PENDING|SUBMITTED|PROCESSING|ACCEPTED|PARTIALLY_ACCEPTED|REJECTED), taxbanditsSubmissionId?, submittedAt?, acceptedAt?, rejectedAt?, rejectionReason?, totalForms, acceptedForms, rejectedForms, tinCheckEnabled, uspsEnabled, eDeliveryEnabled

## 2. Client Creation UI

**Location:** `apps/workspace/src/routes/clients/new.tsx`

Step 1: Basic Info Form
- firstName, lastName, phone(10 digits), email, language(VI|EN), taxYear, clientType toggle
- If BUSINESS: businessName(required), ein(optional XX-XXXXXXX, auto-formats)
- Phone debounced check for existing client
- Existing client shows engagement history + "copy from previous" option

Step 2: Confirm & Send SMS
- Data summary, language picker, editable welcome message

Submission:
- Returning Client: Create TaxEngagement on existing Client
- New Client: Create Client + TaxEngagement + TaxCase + checklist + SMS

## 3. Client Detail Page

**Location:** `apps/workspace/src/routes/clients/$clientId.tsx`

Tabs: overview, files, checklist, schedule-c, schedule-e, data-entry, draft-return, form-1099-nec(BUSINESS ONLY)

Header: Year switcher, client card, actions (review, upload link, add engagement, delete)

Overview: ClientProfileCard, ClientMetaInfo, ClientQuickStats, ClientNotesEditor, ClientAssignedStaff, ClientActivityTimeline

## 4. 1099-NEC Tab

**Location:** `apps/workspace/src/components/cases/tabs/form-1099-nec-tab/`

ContractorTable: List all contractors with add/edit/delete, bulk import from Excel

ContractorFormModal: Manual entry - firstName, lastName, ssn, address, city, state, zip, email?, phone?

ContractorUpload: Excel columns - FirstName, LastName, SSN, Address, City, State, ZIP, Email, AmountPaid, TaxYear

FormActionsPanel: Status display (X draft, X created, X ready, X transmitted)
- CREATE: Validates business info complete, POST /1099-nec/create, creates FilingBatch(PENDING), updates Form1099NEC(IMPORTED)
- GET PDFS: Fetches from TaxBandits, stores R2, updates PDF_READY
- TRANSMIT: Requires confirmation, submits FilingBatch to IRS

FilingStatusPanel: Shows batch history with status badges, dates, form counts

## 5. Business Info Flow

Creation: User selects BUSINESS type, enters businessName + ein (optional) → Client created with encrypted ein

1099-NEC Setup: Client Detail → Form 1099-NEC tab → Add contractors → Form1099NEC(DRAFT)

TaxBandits Submission: FormActionsPanel.CREATE validates all 7 business fields exist, sends to TaxBandits API with payer + recipients

## 6. API Endpoints

POST /clients - Create client
PATCH /clients/:id - Update basic fields
PATCH /clients/:id/business - Update business fields
GET /clients/:clientId/1099-nec/status - Get status counts
POST /clients/:clientId/1099-nec/create - Create forms in TaxBandits
POST /clients/:clientId/1099-nec/pdf - Fetch PDFs
POST /clients/:clientId/1099-nec/transmit - Submit to IRS
GET /clients/:clientId/1099-nec/batches - Filing history
POST /clients/:clientId/contractors - Create contractor
POST /clients/:clientId/contractors/bulk - Bulk import
DELETE /clients/:clientId/contractors/:contractorId - Delete contractor

## 7. Key Files
- Schema: packages/db/prisma/schema.prisma
- Client Creation: apps/workspace/src/routes/clients/new.tsx
- Client Detail: apps/workspace/src/routes/clients/$clientId.tsx
- 1099-NEC Tab: apps/workspace/src/components/cases/tabs/form-1099-nec-tab/
- Client API: apps/api/src/routes/clients/index.ts
- 1099-NEC API: apps/api/src/routes/form-1099-nec/index.ts
- Contractors API: apps/api/src/routes/contractors/

## Key Takeaways
1. No separate Business entity - all on Client model (7 fields)
2. EIN & SSN always encrypted, decrypted only server-side
3. Business info validation - all 7 fields required for TaxBandits submission
4. Form status progression - DRAFT → IMPORTED → PDF_READY → SUBMITTED → ACCEPTED
5. FilingBatch groups forms - one per client per tax year
6. Returning clients create TaxEngagement, not new Client
7. Multi-year support via TaxEngagement
8. Contractor Excel upload with review before save
9. Unique constraint - one Form1099NEC per (contractorId, taxYear)
10. 1099-NEC tab only shows for BUSINESS clients
