# Scout Report: Client Creation Files - Workspace App

**Date:** 2026-04-09  
**Scope:** apps/workspace/src/ - Client creation form/modal/dialog components and API client sections

---

## Summary

Found all files related to client creation in the workspace app. The implementation uses a simplified 2-step form (basic info -> confirm & send SMS) with support for returning client detection and engagement copying. No explicit BusinessFormModal for client creation, but BusinessFormModal exists for business entity management (separate concern).

---

## Key Files by Category

### 1. Client Creation Route & Form

**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/routes/clients/new.tsx` (552 lines)

**Purpose:** Main client creation page with 2-step form workflow

**Key Line Numbers:**
- Line 19-21: Route definition (createFileRoute('/clients/new'))
- Line 44-226: CreateClientPage() component - main wrapper
- Line 26-33: BasicInfoData interface - form state structure
- Line 114-147: validateBasicInfo() - validation logic
- Line 163-226: handleSubmit() - submission handler with returning client logic
- Line 196-209: api.clients.create() call - new client creation
- Line 188-192: api.engagements.create() call - returning client engagement
- Line 395-551: BasicInfoForm component - fields: firstName, lastName, phone, email, language, taxYear

**Form Fields:**
- firstName (required)
- lastName (required)
- phone (required, 10 digits)
- email (optional, validated)
- language (VI | EN, default VI)
- taxYear (from TAX_YEARS array: currentYear-1, currentYear-2, currentYear-3)

---

### 2. Client List Page (Triggers "Add Client")

**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/routes/clients/index.tsx` (235 lines)

**Purpose:** Client list view with search, filters, and "Add Client" button

**Key Line Numbers:**
- Line 20-22: Route definition (createFileRoute('/clients/'))
- Line 111-117: "Add Client" button (navigates to /clients/new)
- Line 52-75: Client list query with filters
- Line 160-181: Client type filter buttons (All Types / Individuals / Businesses)

---

### 3. API Client - Clients Methods

**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts` (2000+ lines)

**Key Line Numbers:**

#### clients object (line 229-267):
- Line 229: Object definition start
- Line 230-231: list() - fetch clients with pagination and filters
- Line 233-234: tags() - fetch available client tags
- Line 237-245: searchByPhone() - find existing client by phone
- Line 247: get() - fetch single client by ID
- Line 249-253: create() - create new client
- Line 255-259: createWithBusiness() - create client with associated business
  - Endpoint: POST /clients/create-with-business
  - Input: CreateWithBusinessInput
  - Output: CreateWithBusinessResponse

#### Type Definitions (line 1959-2001):

**CreateWithBusinessInput** (line 1959-1983):
- individual: firstName, lastName, phone, email, language, profile
- business: firstName (name), phone, email, language, businessType, ein, address fields
- groupName: optional

**CreateWithBusinessResponse** (line 1985-1992):
- success: boolean
- data: individual/business/group with id, name, clientType

---

### 4. Client Creation Support Components

#### A. ReturningClientSection
**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/returning-client-section.tsx` (252 lines)

**Purpose:** Display when existing client is found; shows engagement history and copy-from-previous option

**Key Features:**
- Line 30-170: Main component
- Line 40-46: Query engagements list
- Line 49: Check for existing engagement in selected tax year
- Line 78-87: Handle copy-from-previous checkbox
- Line 179-251: CopyPreviewModal component

---

#### B. ConfirmStep
**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/confirm-step.tsx` (192 lines)

**Purpose:** Final confirmation step; shows summary and editable SMS template

**Key Features:**
- Line 25: DEFAULT_SMS_TEMPLATE_VI with placeholders
- Line 27: DEFAULT_SMS_TEMPLATE_EN
- Line 30-35: renderMessage() - replace placeholders
- Line 37-191: Main component - summary, language toggle, message editor
- Line 96-123: Language toggle buttons (VI/EN)
- Line 126-157: Editable message textarea + placeholder guide

---

#### C. ClientListTable
**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-list-table.tsx` (150+ lines)

**Purpose:** Renders client list in table format with grouping

**Key Features:**
- Line 33-56: groupClients() - groups clients by clientGroupId
- Shows: name, avatar, status badges, action badges, created date

---

### 5. Business Form Modal (Related but Separate)

**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/businesses/business-form-modal.tsx` (260 lines)

**Purpose:** Create/edit business entity (separate from client creation workflow)

**Key Features:**
- Line 27-133: Main form component
- Line 31-39: Initial form state
- Line 63-74: Validation with EIN format
- Line 77-81: Auto-format EIN as XX-XXXXXXX
- Line 83-93: Create mutation
- Line 95-106: Update mutation

**EIN Validation:** XX-XXXXXXX format

---

## Component Export Barrel
**File:** `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/index.ts`

Exports: ClientCard, ClientListTable, IntakeQuestionsForm, ReturningClientSection, ConfirmStep, CreateEngagementModal, ClientOverviewTab, YearSwitcher, ActionBadge

---

## Client Creation Flow

1. /clients/index.tsx - Click "Add Client" button
2. Navigate to /clients/new
3. CreateClientPage Step 1: BasicInfoForm
   - Enter: firstName, lastName, phone, email, language, taxYear
   - On phone blur: searchByPhone() check for returning client
4. If returning client found: ReturningClientSection appears
   - Shows engagement history
   - Offers copy-from-previous checkbox
5. Step 2: ConfirmStep
   - Summary display
   - Language toggle (VI/EN)
   - Editable SMS template
   - Submit button
6. On Submit:
   - If returning: api.engagements.create()
   - If new: api.clients.create()

---

## Key Implementation Details

### Phone-Based Returning Client Detection
- Triggered on phone field blur in BasicInfoForm
- Uses api.clients.searchByPhone() (line 237-245, api-client.ts)
- Normalizes phone: removes non-digits, requires 10-digit number
- Auto-fills firstName/lastName if match found
- Shows ReturningClientSection if found

### SMS Template Customization
- Default templates in confirm-step.tsx (lines 25-27)
- Placeholders: {{client_name}}, {{tax_year}}, {{portal_link}}
- User can edit template in textarea (line 126-142)
- Renders preview with actual values via renderMessage()

### Data Submission
**New Client:**
- api.clients.create() with firstName, lastName, phone, email, language, profile, customMessage

**Returning Client:**
- api.engagements.create() with clientId, taxYear, copyFromEngagementId

---

## Unresolved Questions

1. Who uses createWithBusiness API? - Exists but not called in workspace app
2. Where is actual SMS sent? - customMessage stored; likely sent server-side
3. What are default taxTypes? - Hardcoded to ['FORM_1040']
4. Copy engagement workflow details - Backend implementation unclear

