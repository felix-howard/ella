# Phase 09: Business Entity Separation - 1099-NEC Routes Re-Parent

**Status:** ✅ COMPLETE
**Phase:** 09 of 15
**Branch:** feature/ella-enhance-202
**Completion Date:** 2026-04-09

---

## Summary

1099-NEC form endpoints re-parented from `/businesses/:businessId/1099-nec/*` to `/clients/:clientId/1099-nec/*`. New routes enforce BUSINESS-type client validation via `verifyBusinessClient`. Shared TaxBandits helpers (createFormsInTaxBandits, fetchDraftPdfs) extracted for code reuse. Contractor intake auto-populates clientId on new records. Full backward compatibility maintained.

---

## What Changed

### New Routes (Client-Scoped, Preferred)

**Form Status & Lifecycle**
- `GET /clients/:clientId/1099-nec/status` - Form status counts (draft, validated, imported, pdf-ready, submitted, accepted, rejected)
- `POST /clients/:clientId/1099-nec/create` - Create forms in TaxBandits (DRAFT → IMPORTED state)
- `POST /clients/:clientId/1099-nec/fetch-pdfs` - Download draft PDFs to R2 (IMPORTED → PDF_READY)
- `POST /clients/:clientId/1099-nec/fetch-recipient-pdfs` - Fetch Copy B + Copy C PDFs after IRS transmission
- `POST /clients/:clientId/1099-nec/prepare` - One-click: create forms + fetch PDFs (single endpoint, combines old steps)
- `POST /clients/:clientId/1099-nec/transmit` - Transmit to IRS (PDF_READY → SUBMITTED). Auto-fetches recipient PDFs post-transmission.

**PDF Downloads**
- `GET /clients/:clientId/1099-nec/pdfs` - Signed URLs for all PDF-ready forms (5-min TTL)
- `GET /clients/:clientId/1099-nec/pdfs/recipient` - Signed URLs for Copy B PDFs (for contractors)
- `GET /clients/:clientId/1099-nec/:formId/pdf` - Download individual form PDF
- `GET /clients/:clientId/1099-nec/:formId/pdf/recipient` - Download Copy B PDF (contractor copy)

**Filing Batches**
- `GET /clients/:clientId/1099-nec/batches` - List filing batches
- `GET /clients/:clientId/1099-nec/batches/:batchId` - Batch details with form statuses
- `POST /clients/:clientId/1099-nec/batches/:batchId/refresh` - Refresh batch status from TaxBandits API

### New Files

1. **`apps/api/src/routes/form-1099-nec/client-form-1099-nec.ts`** (150+ LOC)
   - Status endpoint, create forms, fetch PDFs
   - Auth: verifyBusinessClient + requireOrgAdmin
   - Uses shared helpers for create/fetch

2. **`apps/api/src/routes/form-1099-nec/client-form-1099-nec-pdfs.ts`** (80+ LOC)
   - PDF download endpoints (signed URLs with 5-min TTL)
   - Auth: verifyBusinessClient (read-only, no requireOrgAdmin)

3. **`apps/api/src/routes/form-1099-nec/client-form-1099-nec-batches.ts`** (120+ LOC)
   - List batches, batch details, refresh status
   - Auth: verifyBusinessClient + requireOrgAdmin for mutations

4. **`apps/api/src/routes/form-1099-nec/client-form-1099-nec-prepare.ts`** (100+ LOC)
   - One-click prepare (create + fetch PDFs)
   - Combines old two-step process into single endpoint
   - Returns createdCount + pdfCount + optional errors

5. **`apps/api/src/routes/form-1099-nec/shared-helpers.ts`** (80+ LOC)
   - `createFormsInTaxBandits(business, clientId, contractorsWithForms, taxYear)`
     - Builds recipient list, validates tax years, calls TaxBandits API
     - Creates FilingBatch, updates form statuses, correlates by Sequence ID
     - Returns { batch, createdCount, errors }
   - `fetchDraftPdfs(businessId, importedForms, taxYear)`
     - Parallel PDF fetch (5 concurrent), S3 download, R2 upload
     - Updates form status to PDF_READY
     - Returns { pdfCount, errors }

### Modified Files

1. **`apps/api/src/routes/form-1099-nec/index.ts`**
   - Added `@deprecated` JSDoc marker to deprecated routes
   - Exports shared clientForm1099NecRoute for main app

2. **`apps/api/src/routes/contractor-intake/index.ts`**
   - Auto-populates `clientId` from `token.clientId` on new contractor creation
   - Maintains `businessId` for legacy lookup via findBusinessIdForClient

3. **`apps/api/src/app.ts`**
   - Registers new client routes:
     - `app.route('/clients', clientForm1099NecRoute)` - Status, create, fetch-pdfs
     - `app.route('/clients', clientForm1099NecPdfsRoute)` - PDF endpoints
     - `app.route('/clients', clientForm1099NecBatchesRoute)` - Batch endpoints
     - `app.route('/clients', clientForm1099NecPrepareRoute)` - One-click prepare
   - Maintains deprecated routes:
     - `app.route('/businesses', form1099NecRoute)` - Backward compatibility

---

## Auth & Access Control

### Pattern: verifyBusinessClient

All new `/clients/:clientId/1099-nec/*` routes use:
```typescript
const client = await verifyBusinessClient(clientId, user)
if (!client) return c.json({ error: 'Business client not found' }, 404)
```

Validates:
- Client exists with `clientType = BUSINESS`
- Client belongs to user's organization (org-scoped via `buildClientScopeFilter`)
- User has org membership

### Mutations Require: requireOrgAdmin

All POST/PATCH endpoints (create, transmit, fetch-pdfs, refresh) add `requireOrgAdmin` middleware to restrict to organization admins.

---

## Transition Helper

### findBusinessIdForClient(clientId)

**Location:** `apps/api/src/routes/contractors/find-business-id.ts`

**Purpose:** Maps Client(BUSINESS) → legacy Business ID for TaxBandits submission details.

**Logic:**
1. Query ClientGroup where clientId = provided ID
2. Find INDIVIDUAL client linked to same ClientGroup
3. Fetch Business by exact name match, then case-insensitive fallback
4. Return businessId or null if not found

**Why needed:** During transition, Forms table still references Business records for payer details (EIN, address). Once all BUSINESS clients have migrated, this helper becomes unnecessary.

---

## Contractor Intake Enhancement

**File:** `apps/api/src/routes/contractor-intake/index.ts`

**Change:** New contractor creation auto-populates `clientId` from intake token:
```typescript
const contractor = await prisma.contractor.create({
  data: {
    businessId: business.id,       // Legacy FK (required during transition)
    clientId: intakeToken.clientId, // NEW: Direct client link
    // ... other fields
  }
})
```

**Benefit:** New contractors created via intake form are immediately discoverable via `/clients/:clientId/contractors` routes without requiring separate business lookup.

---

## Shared Helpers (DRY Compliance)

**File:** `apps/api/src/routes/form-1099-nec/shared-helpers.ts`

### createFormsInTaxBandits

Reduces duplication between `/clients/:clientId/1099-nec/create` and `/clients/:clientId/1099-nec/prepare`.

```typescript
interface CreateResult {
  batch: FilingBatch
  createdCount: number
  errors: Array<{ sequence: string; errors: string[] }>
}

async function createFormsInTaxBandits(
  business: Business,
  clientId: string,
  contractorsWithForms: Array<Contractor & { forms: Form1099NEC[] }>,
  taxYear: number
): Promise<CreateResult>
```

**Steps:**
1. Build recipient list (firstName, lastName, tin, address, amounts)
2. Validate tax years (must be single year)
3. Call `taxbanditsClient.createForm1099NEC()`
4. Create FilingBatch with SubmissionId
5. Correlate success records by Sequence ID → form ID
6. Update form statuses to IMPORTED
7. Return batch + counts + errors

### fetchDraftPdfs

Reduces duplication between `/fetch-pdfs` and `/prepare` endpoints.

```typescript
interface FetchResult {
  pdfCount: number
  errors: string[]
}

async function fetchDraftPdfs(
  businessId: string,
  importedForms: Array<Form1099NEC & { contractor: Contractor; batch: FilingBatch }>,
  taxYear: number
): Promise<FetchResult>
```

**Steps:**
1. Process PDFs in parallel batches (5 concurrent)
2. Request draft PDF URL from TaxBandits
3. Download from S3
4. Upload to R2 storage
5. Update form status to PDF_READY
6. Collect + return error details

---

## Data Model Updates

### Form1099NEC
- Still references Contractor via contractorId FK
- Contractor now has dual FKs: businessId (legacy) + clientId (new)
- Status lifecycle: DRAFT → VALIDATED → IMPORTED → PDF_READY → SUBMITTED → ACCEPTED|REJECTED
- Storage: pdfStorageKey (draft), copyBStorageKey, copyCStorageKey (after transmission)

### FilingBatch
- businessId FK remains for legacy queries
- Will be backfilled with clientId in Phase 10 (when all Contractor queries migrate to client-scoped)
- Status: PENDING → SUBMITTED → ACCEPTED|REJECTED|PARTIALLY_ACCEPTED|PROCESSING

---

## Backward Compatibility

✅ **Full backward compatibility maintained**

- All `/businesses/:businessId/1099-nec/*` routes remain functional
- Routes marked with `@deprecated` JSDoc comment
- Existing integrations continue without changes
- Phase 15 cleanup will remove deprecated routes + drop businessId FK

### Deprecation Timeline

- **Phase 09 (now):** New `/clients/:clientId/1099-nec` routes launch
- **Phase 10-14:** Gradual migration of UI + existing integrations to new routes
- **Phase 15 (final):** Remove `/businesses/:businessId/1099-nec` routes, drop businessId FK

---

## Testing Considerations

### Unit Tests
- Verify verifyBusinessClient rejects non-BUSINESS clients
- Verify shared helpers extract correctly (createFormsInTaxBandits, fetchDraftPdfs)
- Verify contractor intake auto-populates clientId

### Integration Tests
- Create forms via `/clients/:clientId/1099-nec/create`
- Fetch PDFs via `/clients/:clientId/1099-nec/fetch-pdfs`
- Transmit via `/clients/:clientId/1099-nec/transmit`
- Verify batch status refresh works
- Verify one-click prepare endpoint combines steps correctly

### Backward Compat Tests
- Ensure `/businesses/:businessId/1099-nec/*` routes still work
- Verify org-scoping still enforced

---

## Files Summary

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| client-form-1099-nec.ts | New | 150+ | Status, create, fetch-pdfs |
| client-form-1099-nec-pdfs.ts | New | 80+ | PDF download endpoints |
| client-form-1099-nec-batches.ts | New | 120+ | Batch endpoints |
| client-form-1099-nec-prepare.ts | New | 100+ | One-click prepare |
| shared-helpers.ts | New | 80+ | DRY helpers |
| index.ts | Modified | - | Deprecated markers |
| contractor-intake/index.ts | Modified | - | Auto-populate clientId |
| app.ts | Modified | - | Route registration |

---

## Next Phase

**Phase 10:** Re-parent remaining entity routes (e.g., FilingBatch mutations, other forms). Backfill FilingBatch + other child tables with clientId FK.

---

## References

- **Contractor Routes (Phase 08):** phase-06-entity-separation-api-enhancements.md
- **Entity Separation Model:** system-architecture.md → Multi-Tenancy Architecture section
- **TaxBandits Integration:** system-architecture.md → 1099-NEC Tax Form Integration
