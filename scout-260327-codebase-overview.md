# Scout Report: Codebase Architecture Overview

**Date:** 2026-03-27  
**Focus:** Auth, profiles, schema, modals, PDF, file storage, terms/disclaimers

## 1. Authentication (Clerk)

### Key Files
- apps/workspace/src/components/auth/clerk-auth-provider.tsx - Token gate
- apps/workspace/src/routes/login.tsx - Login + 2FA + org selection
- apps/api/src/lib/clerk-client.ts - Backend integration

### Pattern
- Clerk sign-in with 2FA (email code)
- Token getter at module level (api-client.ts)
- Auto-select first org
- Verify token before rendering children
- Handle pending sessions post-2FA

## 2. Staff Profile Pages

### Key Files
- apps/workspace/src/components/profile/profile-form.tsx (134 lines)
  - Edit: first/last name, role, phone, notifications
  - Phone: react-phone-number-input (E.164)
  - Validation: isPossiblePhoneNumber()
  - Notification: notifyOnUpload toggle
- apps/workspace/src/routes/team/profile/$staffId.tsx

### Database (Staff)
- id, clerkId, email, name, role (ADMIN/STAFF/CPA)
- avatarUrl, phoneNumber (E.164), notifyOnUpload
- deactivatedAt, lastLoginAt

## 3. Client Profiles & Intake

### Key Files
- apps/workspace/src/components/clients/dynamic-intake-form.tsx
- apps/workspace/src/components/clients/multi-section-intake-form.tsx
- apps/workspace/src/components/clients/section-edit-modal.tsx

### Database (Client)
- firstName, lastName, name, phone @unique, email, language (VI/EN)
- source (MANUAL/FORM), avatarUrl, notes, notesUpdatedAt
- ClientProfile: filingStatus, income flags, dependents, business info, intakeAnswers (Json)

## 4. Database (Prisma)

### Location
packages/db/prisma/schema.prisma

### Key Enums
- StaffRole: ADMIN, STAFF, CPA
- Language: VI, EN
- TaxCaseStatus: INTAKE, WAITING_DOCS, IN_PROGRESS, READY_FOR_ENTRY, ENTRY_COMPLETE, REVIEW, FILED
- DocType: 100+ types (SSN_CARD, W2, FORM_1099_*, SCHEDULE_*, etc.)
- FieldType: BOOLEAN, SELECT, NUMBER, NUMBER_INPUT, CURRENCY, TEXT
- MessageTemplateCategory: PORTAL_LINK, SCHEDULE_C, SCHEDULE_E
- ChecklistItemStatus: MISSING, HAS_RAW, HAS_DIGITAL, VERIFIED, NOT_REQUIRED
- ClientSource: MANUAL, FORM

### Core Models
Staff, Client, ClientProfile, TaxCase, TaxEngagement, RawImage, ChecklistItem, DigitalDoc, Message, Action, MagicLink

## 5. Modal Components

### UI Library
packages/ui/src/components/modal.tsx

Exports: Modal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter

Sizes: sm, default, lg, xl, full

Props: open, onClose, closeOnOverlayClick, closeOnEscape, showCloseButton, aria-labelledby, aria-describedby

### Workspace Modals

1. InviteMemberDialog (team/invite-member-dialog.tsx)
   - Uses UI library Modal
   - Email + role input
   - Mutation: api.team.invite()

2. SectionEditModal (clients/section-edit-modal.tsx)
   - Custom modal (fixed inset-0 z-50)
   - Inline backdrop, keyboard handling
   - Scrollable body with field validation

3. SendUploadLinkModal (shared/send-upload-link-modal.tsx)
   - Custom modal
   - Language toggle (VI/EN)
   - Message templates with placeholders: {{client_name}}, {{tax_year}}, {{portal_link}}

## 6. PDF Handling

### Status
NO PDF generation library found (pdfkit, jsPDF, puppeteer not present)
PDF viewing only: ui/pdf-viewer.tsx, ui/pdf-viewer-desktop.tsx (pdfjs)

### Implication
Need to select PDF generation library

## 7. File Storage (Cloudflare R2)

### Service
apps/api/src/services/storage.ts (450 lines)

### Backend
@aws-sdk/client-s3 + @aws-sdk/s3-request-presigner
Config: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

### Functions
uploadFile, getSignedUploadUrl, getSignedDownloadUrl, generateFileKey
generateAvatarKey, generateClientAvatarKey, resolveAvatarUrl
deleteFile, renameFile (copy+delete pattern), fetchImageBuffer (with retry)

### Paths
- Raw uploads: cases/{caseId}/raw/{timestamp-random}.ext
- Classified docs: cases/{caseId}/docs/{displayName}.ext
- Thumbnails: cases/{caseId}/raw/thumbnails/{filename}
- Avatars: avatars/{staffId}/{timestamp-random}.jpg
- Client avatars: client-avatars/{clientId}/{timestamp-random}.{ext}

## 8. Terms/Conditions

### Findings
NO existing terms/conditions or disclaimer modals found in code
Git commit (Mar 27): Add portal upload disclaimer notice
Disclaimer not yet searchable in codebase

### Related
- send-upload-link-modal.tsx (message templates, not terms)
- apps/api/src/routes/portal/ (public magic link API)
- apps/portal/src/ (client-facing public app)

## 9. Portal/Client Public

### API Routes (apps/api/src/routes/portal/index.ts)
GET /portal/:token - Portal data (checklist, stats)
POST /portal/:token/upload - Document upload

Magic link validation via validateMagicLink(token)

### Portal App
apps/portal/src/routes/, apps/portal/src/components/
Client checklist, upload UI, blurry image feedback

## 10. Localization

### Languages
VI (Vietnamese), EN (English)

### Locations
- Workspace: apps/workspace/src/locales/
- Portal: apps/portal/src/locales/
- API: apps/api/src/locales/

### Tools
- Frontend: react-i18next
- API: Hono middleware

### Message Templates
Upload link (VI/EN) in send-upload-link-modal.tsx
Placeholders: {{client_name}}, {{tax_year}}, {{portal_link}}

## Key Files Reference

**Auth:**
- apps/workspace/src/components/auth/clerk-auth-provider.tsx
- apps/workspace/src/routes/login.tsx
- apps/workspace/src/lib/api-client.ts

**Profiles:**
- apps/workspace/src/components/profile/profile-form.tsx
- apps/workspace/src/routes/team/profile/$staffId.tsx

**Forms/Modals:**
- apps/workspace/src/components/clients/dynamic-intake-form.tsx
- apps/workspace/src/components/clients/section-edit-modal.tsx
- apps/workspace/src/components/team/invite-member-dialog.tsx
- apps/workspace/src/components/shared/send-upload-link-modal.tsx
- packages/ui/src/components/modal.tsx

**Storage:**
- apps/api/src/services/storage.ts
- apps/workspace/src/components/ui/pdf-viewer.tsx

**Database:**
- packages/db/prisma/schema.prisma

**Portal:**
- apps/api/src/routes/portal/index.ts
- apps/portal/src/routes/

## Unresolved Questions

1. PDF generation library choice?
2. When display terms modal (portal landing, before upload, modal)?
3. Terms storage (DB versioning vs static)?
4. Liability language structure (JSON, markdown, i18n)?
5. Disclaimer display location?

