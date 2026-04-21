# Phase 2: 1099-NEC Excel Upload Feature - Code Scout Report

Date: 2026-04-01
Status: Complete - All key files located and analyzed

## File Locations

1. **Contractor Routes Backend**
   - Path: C:\Users\Admin\Desktop\ella\apps\api\src\routes\contractors\index.ts
   - Size: 249 lines
   - Contains: GET, POST, PATCH, DELETE contractor endpoints
   - Features: SSN encryption, auth validation, org-scoped access

2. **Contractor Validators**
   - Path: C:\Users\Admin\Desktop\ella\apps\api\src\routes\contractors\validators.ts
   - Size: 33 lines
   - Zod schemas for createContractorSchema and updateContractorSchema

3. **1099-NEC Tab Component**
   - Path: C:\Users\Admin\Desktop\ella\apps\workspace\src\components\cases\tabs\form-1099-nec-tab\index.tsx
   - Size: 164 lines
   - Parent component with table, form modal, mutations

4. **Contractor Form Modal**
   - Path: C:\Users\Admin\Desktop\ella\apps\workspace\src\components\cases\tabs\form-1099-nec-tab\contractor-form-modal.tsx
   - Size: 193 lines
   - Add/edit form with validation

5. **Contractor Table Component**
   - Path: C:\Users\Admin\Desktop\ella\apps\workspace\src\components\cases\tabs\form-1099-nec-tab\contractor-table.tsx
   - Size: 118 lines
   - Responsive table display with masked SSN

6. **Crypto Service**
   - Path: C:\Users\Admin\Desktop\ella\apps\api\src\services\crypto\index.ts
   - Size: 265 lines
   - AES-256-GCM encryption for SSN, validation, masking

7. **Storage Service**
   - Path: C:\Users\Admin\Desktop\ella\apps\api\src\services\storage.ts
   - Size: 452 lines
   - Cloudflare R2 upload/download, signed URLs, file key generation

8. **API Client**
   - Path: C:\Users\Admin\Desktop\ella\apps\workspace\src\lib\api-client.ts
   - Size: ~2000 lines (types + HTTP methods)
   - Contractor methods: list, create, update, delete
   - Type defs: Contractor, CreateContractorInput, UpdateContractorInput

9. **Main API App**
   - Path: C:\Users\Admin\Desktop\ella\apps\api\src\app.ts
   - Size: 136 lines
   - Route registration: contractorsRoute already imported and registered

10. **Prisma Schema**
    - Path: C:\Users\Admin\Desktop\ella\packages\db\prisma\schema.prisma
    - Contractor model with SSN encryption fields

## Key Architectural Patterns

### Authentication & Authorization
- All routes require Clerk JWT (parsed by clerkMiddleware)
- Protected routes use authMiddleware (staff + organization context)
- Org-scoped access via buildClientScopeFilter(user)

### SSN Handling
- Encrypted server-side: AES-256-GCM with key from SSN_ENCRYPTION_KEY env var
- Stored encrypted: ssnEncrypted field in database
- Masked display: ssnLast4 for UI
- Validation: isValidSSN() checks 9 digits, no invalid prefixes

### File Storage
- Cloudflare R2 with presigned URLs
- Key pattern: cases/{caseId}/{prefix}/{timestamp}-{random}.{ext}
- Configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

### Frontend State Management
- React Query for server state (useQuery, useMutation, useQueryClient)
- Query key: ['contractors', clientId]
- Mutation invalidation after create/update/delete

## Phase 2 Implementation Requirements

### Backend
- Add POST /clients/:clientId/contractors/import endpoint
- Parse Excel file (XLSX or CSV)
- Validate rows against existing contractors
- Detect duplicate SSNs (decrypt and compare)
- Batch insert with transaction rollback on error
- Return detailed error report with row numbers and reasons
- Upload Excel to R2 for audit trail

### Frontend
- Add upload zone to Form1099NECTab component
- Create file input/drag-drop UI
- Validate file before upload (headers, data format)
- Show upload progress
- Display import results modal (success/error counts, error details)
- Allow retry of failed rows
- Invalidate contractor list query after import

### Database (Optional)
- Add tracking fields to Contractor model:
  - importedAt: DateTime
  - importBatchId: String
  - importSource: String
- Add unique index on (clientId, ssnLast4) for duplicate detection
- Create migration via: prisma migrate dev --name add-contractor-import-tracking

## Integration Notes

- Contractor CRUD is Phase 1 complete
- Tax1099 API integration (tax1099RecipientId population) is Phase 2+
- Existing error handling pattern in apps/api/src/middleware/error-handler.ts
- Audit logging uses logProfileChanges() from audit-logger service
- Multi-org isolation enforced via buildClientScopeFilter on all queries

