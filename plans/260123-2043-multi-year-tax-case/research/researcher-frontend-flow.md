# Frontend Research: Multi-Year Tax Case Feature

**Date:** 2026-01-23 | **Branch:** feature/multi-year-tax-case

## Current Flow Summary

### 1. Client Creation (`/clients/new`)
**Steps:** 3 main steps + 4 internal wizard steps
- **Step 1 (Basic Info):** Name, phone, email, language selection → stored in client table
- **Step 2 (Tax Selection):** Tax year, tax types (checkboxes), filing status → used to load dynamic questions
- **Step 3 (Wizard - 4 internal steps)**
  - Step 3.1: Identity (SSN, DOB, spouse info if MFJ, dependents grid)
  - Step 3.2: Income (W2/1099 flags, self-employment, investments, rental property, crypto, retirement, social security, K1)
  - Step 3.3: Deductions (mortgage, medical, charitable, student loan, educator, property tax)
  - Step 3.4: Review & Bank Refund (routing number, account validation)

**Data Storage:** All answers consolidated into `intakeAnswers` JSON + legacy fields in profile table.

### 2. Client Detail View (`/clients/$clientId`)
**Tabs:** Overview, Documents, Data-Entry
- **Overview Tab:** Shows client data via `ClientOverviewSections` component → displays intakeAnswers grouped by category in collapsible sections
- **Current Structure:** Single tax case per client (accessed via `client.taxCases[0]`)
- **Case Info:** Tax year, tax types displayed in header and Overview tab
- **Status:** Computed status badge showing INTAKE → WAITING_DOCS → IN_PROGRESS → READY_FOR_ENTRY → ENTRY_COMPLETE → REVIEW → FILED

### 3. Client List View (`/clients/`)
**Display:** Table rows showing latest tax case year, status badges, action counts
- One row per client
- Columns: Name, Phone, Language, Tax Year, Tax Types, Status, Actions, Chevron

## Required UI Changes for Multi-Year Support

### 1. New Route & Feature
- **`/clients/:id/cases/new`** → Returning client add tax case flow
  - Reuse tax selection step (year, types, filing status)
  - Skip basic info (already exists)
  - Load wizard with same 4 steps
  - Create new TaxCase for existing client

### 2. Client Detail Page Modifications
- **Tax Case Selector:** Add dropdown/tabs in header to switch between years
  - "2025" | "2024" | "2023" — Show all years for client
  - Selection updates Overview/Documents/Data-Entry tabs for selected case
  - Display action counts per case in selector

- **Expandable Rows in Client List (Future):**
  - Click row to expand → show all tax cases by year with status
  - "Add Tax Case" button in expansion for each client
  - Alternative: Add secondary "Cases" tab in detail view (simpler)

### 3. Wizard Changes
- **Static Fields (First-Time Only):**
  - Basic info (name, phone, email, language) — skip on subsequent cases
  - Identity section (SSN, DOB, spouse, dependents) — pre-fill from previous case or skip if unchanged

- **Yearly Fields (Every Case):**
  - Tax year (reset for new case)
  - Tax types (reset)
  - Filing status (reset)
  - Income items (reset — different W2s, 1099s per year)
  - Deductions (reset — varies by year)
  - Bank info (optional — may be reused or changed)

### 4. Component Modifications

**Modified:**
- `ClientDetailPage` → Add case selector, update queries to use selected caseId
- `WizardContainer` → Add "skip static info" mode for returning clients
- `ClientOverviewSections` → Display tax case data (currently hard-coded to latest case)
- `ClientListTable` → Add expansion row or cases badge (shows count of cases)

**New Components:**
- `TaxCaseSelectorHeader` → Dropdown/tabs for year selection in detail view
- `AddTaxCaseButton` → Button to initiate new case flow for returning client
- `TaxCaseHistoryPanel` → (Optional) Show all cases in expandable card

### 5. Questionnaire Structure
- **Shared Config Logic:** Dynamic questions already load per tax type + filing status
- **Reuse:** Same `WIZARD_STEPS` config, same field validation
- **Year-Specific Data:** Each case has separate intakeAnswers JSON

## Component Inventory

### Existing Components to Modify
1. **ClientDetailPage** (`$clientId.tsx`) — Add case switching logic, update queries
2. **WizardContainer** — Add skip-static-info mode for returning clients
3. **ClientOverviewSections** — Update to reference case-specific intakeAnswers
4. **ClientListTable** — Add case count display or expand button
5. **CreateClientPage** (`new.tsx`) — No changes (new clients still use full flow)

### New Components to Create
1. **TaxCaseSelectorHeader** — Dropdown/tabs for case year selection (in detail page header)
2. **AddTaxCaseButton** — CTA button + modal/page transition to `/clients/:id/cases/new`
3. **TaxCaseCard** (optional) — Summary card for each case (year, status, action count)

### Reusable (No Changes)
- `WizardStep1Identity`, `WizardStep2Income`, `WizardStep3Deductions`, `WizardStep4Review` — Unchanged
- Intake form components (`IntakeQuestionsForm`, `IntakeQuestion`, etc.) — Unchanged
- Tab structure in detail view — Reuse existing tabs

## Data Model Impact (Backend/API)

**Key Assumption:** Backend already supports multiple TaxCase per Client
- Client has `taxCases: TaxCase[]` array
- Each TaxCase has own `intakeAnswers`, status, documents, checklist

**Frontend API Changes:**
- `api.clients.get(clientId)` returns all cases (current: returns latest)
- `api.cases.*` operations accept `caseId` parameter (current implementation assumed)
- New endpoint: `api.cases.create(clientId, caseData)` for new case creation

## Next Steps (Implementation)

1. **Backend Verify:** Confirm multi-case client structure in API responses
2. **Route:** Add `/clients/:id/cases/new` route → conditional wizard (skip static fields)
3. **Detail Page:** Implement case selector in header (determine design: dropdown vs tabs)
4. **Overview Tab:** Update to show data for selected case
5. **Client List:** Add visual indicator of multiple cases
6. **Testing:** Verify case switching doesn't cause data misalignment

## Unresolved Questions

1. **Case Selection UI Design:** Dropdown vs tab-bar vs segmented control? (Header space constraint?)
2. **Static Field Handling:** Auto-skip identity section on returning client, or show pre-filled form?
3. **Bank Info Reuse:** Should refund account auto-populate from previous case or always blank?
4. **Client List Expansion:** Table expansion row (complex) vs secondary "Cases" tab in detail (simpler)?
5. **Multiple Cases on List:** Show latest case year only, or add case count badge?
6. **Dependent Updates:** Can dependents differ year-to-year, or assume same across cases?
