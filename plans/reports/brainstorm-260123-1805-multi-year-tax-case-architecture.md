# Brainstorm Report: Multi-Year Tax Case Architecture

**Date:** 2026-01-23 18:05
**Branch:** ella-improvement
**Status:** Planning Phase

---

## Problem Statement

**Current State:**
- Client + ClientProfile + TaxCase + Questionnaire are tightly coupled
- Creating a client = answering questionnaire = creating a tax case for 2025
- Unique constraint: `(clientId, taxYear)` - only 1 tax case per year per client
- Next year (2026), would need to create a "new client" to create a new tax case

**Root Cause:** Client creation is bundled with tax case creation in a single flow.

**Future Requirement:** Support self-serve tax organizer where clients receive a link and fill questionnaire themselves.

---

## Options Analyzed

### Option 1: Decouple Client Creation from Tax Case Creation

**Approach:**
1. Create Client - Just basic info (name, phone, email, language)
2. Add Tax Case - Separate action to add a tax case for any year
3. Fill Questionnaire - Per tax case, not per client

**Changes Needed:**
- New route: `/clients/new` → only basic info
- New route: `/clients/:id/cases/new` → create tax case + questionnaire
- Modify client list to show "Add Tax Case" button for existing clients
- ClientProfile becomes shared context, intakeAnswers moves to TaxCase

**Pros:**
- Clean separation of concerns
- Returning clients just need "Add 2026 Tax Case"
- Historical data preserved per year

**Cons:**
- Larger refactor
- Need to migrate existing data

---

### Option 2: "Clone Client for New Year" Feature

**Approach:**
- Keep current flow for new clients
- Add "Create 2026 Case" button on existing client profile
- Clone client basic info, pre-fill questionnaire from previous year
- User reviews/updates answers → new tax case created

**Changes Needed:**
- New API endpoint: `POST /clients/:id/clone-for-year`
- UI button on client detail page
- Pre-population logic from previous intakeAnswers

**Pros:**
- Minimal changes to existing flow
- UX convenience - pre-filled from last year
- Quick to implement

**Cons:**
- Still creates duplicate client records (phone uniqueness issue)
- Data duplication

---

### Option 3: Multi-Year Support on Same Client (SELECTED)

**Approach:**
- Keep Client as master record
- Move intakeAnswers INTO TaxCase (or TaxCaseProfile)
- Client creation = basic info only
- Each tax case has its own questionnaire answers

**Data Model Change:**
```
Client (id, name, phone, email, language)
  └── TaxCase (id, clientId, taxYear, taxTypes, intakeAnswers, status)
        └── ChecklistItems
```

**Changes Needed:**
- Move `intakeAnswers` from ClientProfile to TaxCase
- Update checklist generator to read from TaxCase
- New UI: Client detail → "Tax Cases" tab → Add/View cases
- Questionnaire becomes per-case, not per-client

**Pros:**
- Cleanest data model
- One client, multiple years
- No duplicate phone numbers
- Historical answers preserved per year
- Supports future tax organizer feature

**Cons:**
- Larger migration effort
- Need to handle shared data (SSN stays same, income changes)

---

### Option 4: Hybrid - Keep Shared Profile + Per-Case Answers

**Approach:**
- ClientProfile keeps **static info** (SSN, DOB, address - rarely changes)
- TaxCase gets **year-specific answers** (income sources, deductions)

**Data Model:**
```
Client
  └── ClientProfile (ssn, dob, dlNumber - static)
  └── TaxCase[]
        └── TaxCaseAnswers (year-specific: hasW2, incomeTypes, etc.)
```

**Pros:**
- Don't re-enter SSN every year
- Year-specific data isolated
- Logical separation

**Cons:**
- Need to split questionnaire into "static" vs "yearly" sections
- Migration complexity

---

## Selected Solution: Option 3 + Option 4 Hybrid

Combine the best of both: **Client-Centric Multi-Year Model with Static/Yearly Split**

---

## Proposed Architecture

### Data Model

```
Client (master record - contact info)
├── phone (unique identifier)
├── email
├── name
└── language

ClientProfile (static info - rarely changes)
├── ssn, spouseSsn
├── dob, spouseDob
├── dlNumber, dlState, dlExpiry
├── address, city, state, zip
├── bankAccount, routingNumber
└── occupation

TaxCase (per-year case)
├── taxYear (2025, 2026, etc.)
├── taxTypes [FORM_1040, etc.]
├── filingStatus
├── status (workflow state)
└── yearlyAnswers (JSON) ← NEW: year-specific questionnaire
    ├── hasW2, w2Count
    ├── has1099NEC, num1099NEC
    ├── hasSelfEmployment
    ├── hasRentalProperty, rentalPropertyCount
    ├── hasInvestments, hasCrypto
    ├── deductions (mortgage, medical, etc.)
    └── dependents[]
```

### Field Classification

| Category | Fields | Storage |
|----------|--------|---------|
| **Static (ClientProfile)** | SSN, Spouse SSN, DOB, Spouse DOB, DL Number, DL State, DL Expiry, Address, City, State, ZIP, Bank Account, Routing Number, Occupation | Asked once, reused |
| **Yearly (TaxCase.yearlyAnswers)** | Filing Status, W2 info, 1099 info, Self-employment, Rental property, Investments, Crypto, Retirement, Social Security, Dependents, Deductions (mortgage, medical, charitable, etc.) | Asked per tax year |

### Key Design Decisions

| Aspect | Design | Rationale |
|--------|--------|-----------|
| **Static Info** | In ClientProfile | SSN, DOB, DL don't change yearly |
| **Yearly Answers** | In TaxCase | Income sources, deductions change each year |
| **Questionnaire** | Split into 2 parts | Part 1: Static (once), Part 2: Yearly (per case) |
| **Phone Uniqueness** | On Client | One client record, multiple tax years |
| **Pre-fill** | Yes | Copy previous year's yearly answers for review |

---

## User Flows

### Flow 1: New Client (First Time)
```
/clients/new
  Step 1: Basic Info (name, phone, email) → Creates Client
  Step 2: Static Profile (SSN, DOB, DL, bank) → Creates/Updates ClientProfile
  Step 3: Tax Case Setup (year, types, filing status) → Creates TaxCase
  Step 4: Yearly Questionnaire (income, deductions) → Saves to TaxCase.yearlyAnswers
  → Generate Checklist
```

### Flow 2: Returning Client (New Year)
```
/clients/:id/cases/new
  Step 1: Tax Case Setup (year=2026, types, filing status)
  Step 2: Yearly Questionnaire (pre-filled from 2025, user updates)
  → Generate Checklist for 2026
```

### Flow 3: Future Tax Organizer (Self-Serve)
```
Client receives magic link → /organizer/:token
  - System identifies client from token
  - Shows yearly questionnaire for new year
  - Pre-fills from previous year
  - Client submits → Creates TaxCase, generates checklist
  - Staff notified of new case
```

---

## UI Changes

### Client List View (Expandable Rows)
- Show client name + expandable row to see all tax cases
- "Add 2026 Case" button on each client row
- Click to expand shows: 2025 case (status), 2024 case (if exists), etc.

### Client Detail View
- **Overview Tab:** Contact info, static profile (editable)
- **Tax Cases Tab:** List of all years (2025, 2026, etc.)
  - Click into each case for checklist, documents
- **Add Tax Case** button → opens yearly questionnaire

### Create Client Flow (Revised)
- Step 1: Basic Info
- Step 2: Static Profile (identity, bank)
- Step 3: Tax Case Setup (year, types)
- Step 4: Yearly Questionnaire (income, deductions)

---

## Migration Strategy

### Phase 1: Database Changes
1. Add `yearlyAnswers` JSON column to TaxCase table
2. Keep `intakeAnswers` in ClientProfile for backward compatibility

### Phase 2: Data Migration
1. For each existing TaxCase:
   - Copy yearly fields from ClientProfile.intakeAnswers to TaxCase.yearlyAnswers
   - Keep static fields in ClientProfile.intakeAnswers

### Phase 3: Code Updates
1. Split questionnaire UI into static vs yearly sections
2. Update checklist generator to read from TaxCase.yearlyAnswers
3. Update all API endpoints reading intakeAnswers

### Phase 4: New Features
1. Add "Add Tax Case" flow for returning clients
2. Update Client List UI with expandable rows
3. Pre-fill logic from previous year's yearlyAnswers

### Phase 5: Cleanup
1. Remove yearly fields from ClientProfile.intakeAnswers (keep static only)
2. Update documentation

---

## Files to Modify

### Database
- `packages/db/prisma/schema.prisma` - Add yearlyAnswers to TaxCase

### API
- `apps/api/src/routes/clients/index.ts` - Split creation logic
- `apps/api/src/routes/cases/index.ts` - Add create case endpoint
- `apps/api/src/services/checklist-generator.ts` - Read from yearlyAnswers

### Frontend
- `apps/workspace/src/routes/clients/new.tsx` - Restructure wizard
- `apps/workspace/src/routes/clients/index.tsx` - Expandable rows
- `apps/workspace/src/routes/clients/$clientId/cases/new.tsx` - New route
- `apps/workspace/src/components/clients/intake-wizard/*` - Split static/yearly

---

## Future: Tax Organizer Support

This architecture naturally supports the future tax organizer feature:

1. **Send Organizer Link:** Staff sends magic link for 2026 to existing client
2. **Client Access:** Client clicks link, authenticated via token
3. **Pre-filled Form:** Shows yearly questionnaire pre-filled from 2025
4. **Self-Serve:** Client updates answers, submits
5. **Case Created:** New TaxCase for 2026 created automatically
6. **Staff Notification:** Staff sees new case in dashboard

---

## Unresolved Questions

1. **Dependent Data:** Are dependents static or yearly? (Kids grow up, may not qualify next year)
2. **Spouse Info:** If filing status changes from MFJ to Single, how to handle spouse data?
3. **Magic Link Scope:** Should existing magic links work for all years or be year-specific?
4. **Cascade Cleanup:** When yearly answers change, how to handle checklist refresh across years?

---

## Next Steps

1. Finalize field classification (static vs yearly)
2. Create detailed implementation plan
3. Begin Phase 1: Database schema changes
4. Implement incrementally with backward compatibility
