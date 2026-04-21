# Scout Report: Terms & Conditions Files

**Date:** 2026-03-28
**Search Scope:** Full codebase (apps/workspace, apps/api, packages/shared)
**Status:** Complete

## Summary

Found 12 files directly related to Terms & Conditions implementation across frontend, backend, and shared packages. Includes API endpoints, UI components, hooks, PDF generation, and version management.

## File Inventory

### Backend API (apps/api/src)

#### 1. API Routes & Endpoints
**Path:** /c/Users/Admin/Desktop/ella/apps/api/src/routes/terms/index.ts

Purpose: Main T&C API route handler with 4 endpoints:
- GET /terms/status - Check if staff accepted current version
- POST /terms/accept - Submit T&C acceptance with signed PDF (15MB max)
- GET /terms/download/:acceptanceId - Download signed PDF with auth
- GET /terms/acceptance/:staffId - Get staff's latest acceptance record

Key Features: Version tracking, PDF storage in R2, IP/user-agent capture, duplicate prevention

#### 2. API Schemas
**Path:** /c/Users/Admin/Desktop/ella/apps/api/src/routes/terms/schemas.ts

Purpose: Zod validation schemas for T&C endpoints
- acceptTermsSchema: version, pdfBase64, language
- downloadParamsSchema: acceptanceId validation
- acceptanceParamsSchema: staffId validation

Validation: 10MB PDF size limit enforcement

### Frontend Components (apps/workspace/src)

#### 3. T&C Gate (App-Level Enforcement)
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/terms/terms-gate.tsx

Purpose: Route-level wrapper that blocks app access until T&C accepted

Features:
- Checks signed-in status
- Loads and displays T&C status
- Shows loading/error states with retry
- Displays modal if not accepted
- Passes children through if accepted

#### 4. T&C Modal
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/terms/terms-modal.tsx

Purpose: Full-screen modal for T&C review and acceptance

Features:
- Bilingual support (EN/VI) with toggle button
- Scrollable content sections
- Checkbox agreement
- Signature pad integration
- PDF generation on submit
- Size validation (10MB max)
- Submit button with loading state

#### 5. PDF Document Generation
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/terms/terms-pdf-document.tsx

Purpose: @react-pdf/renderer component for signed T&C PDF

Features:
- Language-aware formatting (EN/VI)
- Staff signature image embedding
- Staff name and signed date
- Deterministic date formatting
- A4 page sizing with proper styling

#### 6. Signature Pad Component
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/terms/signature-pad.tsx

Purpose: Canvas-based signature capture using react-signature-canvas

Features:
- Responsive canvas sizing (max 500px width)
- Touch/mouse input support
- Clear button with eraser icon
- Debounced resize handling
- DataURL export (PNG)
- Disabled state during submission

#### 7. Profile Page T&C Download Button
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/profile/terms-download-button.tsx

Purpose: Shows T&C acceptance status on profile with download capability

Features:
- Displays version and signed date
- Download button with loading state
- Error fallback display
- Staff can download own; admins can download any team member's
- Used in ProfileForm component

### Hooks & Utilities (apps/workspace/src)

#### 8. T&C Hooks
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/terms/use-terms.ts

Hooks:
- useTermsStatus(): Query current acceptance status (5min cache)
- useAcceptTerms(): Mutation to submit acceptance with PDF
- useTermsDownload(): Query for signed PDF download URL

Integrations: TanStack React Query, cache invalidation on success

#### 9. T&C Content (Bilingual)
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/terms/terms-content.ts

Purpose: Content definitions in English and Vietnamese

Sections:
1. Acceptance of Terms
2. Confidentiality
3. Data Protection
4. Professional Conduct
5. System Security
6. Termination

Format: Structured objects with title, version, effective date, sections, acknowledgment

### Shared Packages

#### 10. T&C Version Constant
**Path:** /c/Users/Admin/Desktop/ella/packages/shared/src/constants/terms.ts

Purpose: Single source of truth for current T&C version
Value: 2026.03.27 (YYYY.MM.DD format)
Usage: Imported by both frontend and backend to enforce version matching

### API Client Integration (apps/workspace/src)

#### 11. API Client Terms Module
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts (lines 990-1011)

Methods:
- api.terms.getStatus(): GET /terms/status
- api.terms.accept(data): POST /terms/accept
- api.terms.getDownloadUrl(acceptanceId): GET /terms/download/{id}
- api.terms.getAcceptance(staffId): GET /terms/acceptance/{id}

Features: Type-safe requests, retry logic, timeout handling

### Profile Integration

#### 12. Profile Form Component
**Path:** /c/Users/Admin/Desktop/ella/apps/workspace/src/components/profile/profile-form.tsx (lines 1-100+)

Purpose: Staff profile editing with T&C integration
T&C Integration: Imports and displays <TermsDownloadButton staffId={staffId} />

## Key Technical Details

### Database Schema
- Table: TermsAcceptance
- Fields: id, staffId, version, signedAt, pdfR2Key, ipAddress, userAgent
- Unique constraint: staffId_version (prevents duplicate acceptance)

### PDF Storage
- Location: Cloudflare R2 object storage
- Key pattern: terms/{organizationId}/{staffId}/{version}.pdf
- Max size: 10MB (enforced pre-upload), 15MB (server limit)

### Authorization
- GET status: Any authenticated user (own status only)
- POST accept: Any authenticated user
- GET download: Owner OR org:admin in same org
- GET acceptance: Owner OR org:admin in same org

### Versioning
- Version format: YYYY.MM.DD
- Current: 2026.03.27
- Changes require re-acceptance (version mismatch detection)

### Bilingual Support
- Languages: English (EN), Vietnamese (VI)
- Effective in: PDF generation, modal display, signatures block
- Language selection: User toggle in modal (not persisted)

### Error Handling
- Version mismatch: 400 BAD_REQUEST
- Duplicate acceptance: 409 CONFLICT
- Auth failures: 403 FORBIDDEN
- Storage upload failure: 500 with DB rollback

## Unresolved Questions

1. **Language Persistence:** Does language selection persist across sessions or reset to default (VI)?
2. **PDF Signing:** Is the signature pad sufficient legally or does it require additional digital signing?
3. **Acceptance History:** Can staff view previous acceptance records or only latest?
4. **Expiry:** Do T&C acceptances expire or remain valid indefinitely?
5. **Admin Override:** Can org:admin force re-acceptance for staff members?
