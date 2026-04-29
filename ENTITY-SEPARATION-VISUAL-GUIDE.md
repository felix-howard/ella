# Entity Separation: Visual Architecture Guide

## 1. THE UNIVERSAL 3-TIER MODEL

```
┌──────────────────────────────────────────────────────────┐
│  CLIENT GROUP (Canopy/Karbon) or LINKED ACCOUNTS (TaxDome) │
│  "Salon Owner Complete"                                   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ CLIENT/ACCOUNT 1: Salon Owner (Individual)         │  │
│  │ ┌──────────────────────────────────────────────┐   │  │
│  │ │ CONTACT: owner@salon.com                     │   │  │
│  │ │ - Login: YES                                 │   │  │
│  │ │ - Email: owner@salon.com                     │   │  │
│  │ │ - Phone: [optional]                          │   │  │
│  │ └──────────────────────────────────────────────┘   │  │
│  │ Engagement: 2025 Personal Tax Return               │  │
│  │ Documents:                                          │  │
│  │ ├─ /Personal/Income                                │  │
│  │ ├─ /Personal/Deductions                            │  │
│  │ └─ /2025 Return Package                            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ CLIENT/ACCOUNT 2: Nail Salon LLC (Business)        │  │
│  │ ┌──────────────────────────────────────────────┐   │  │
│  │ │ CONTACT 1: owner@salon.com                   │   │  │
│  │ │ - Login: YES                                 │   │  │
│  │ │ - Role: Owner                                │   │  │
│  │ └──────────────────────────────────────────────┘   │  │
│  │ ┌──────────────────────────────────────────────┐   │  │
│  │ │ CONTACT 2: manager@salon.com (optional)      │   │  │
│  │ │ - Login: YES                                 │   │  │
│  │ │ - Role: Manager                              │   │  │
│  │ └──────────────────────────────────────────────┘   │  │
│  │ Engagement: 2025 Business Tax Return               │  │
│  │ Documents:                                          │  │
│  │ ├─ /Business/Expenses                              │  │
│  │ ├─ /Business/Payroll                               │  │
│  │ └─ /2025 Return Package                            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  RELATIONSHIP MAPPING:                                    │
│  ├─ Billing: GROUP → Consolidated invoice $4,000        │
│  ├─ Files: Shared across clients in group              │
│  └─ Contacts: owner@salon.com links both entities      │
└──────────────────────────────────────────────────────────┘
```

## 2. CONTACT ACCESS MODEL: CANOPY vs TAXDOME

### Canopy: Contact Per Client (Discrete)

```
CANOPY ARCHITECTURE
═════════════════════════════════════════════════════════

CLIENT: Salon Owner Personal
├─ Contact: owner@salon.com
│  ├─ Login: YES
│  ├─ Files Visible: YES
│  └─ Files Tab in Portal: SHOWN
│
CLIENT: Nail Salon LLC
├─ Contact: owner@salon.com (added separately)
│  ├─ Login: YES
│  ├─ Files Visible: YES
│  └─ Files Tab in Portal: SHOWN
│
├─ Contact: manager@salon.com
│  ├─ Login: YES
│  ├─ Files Visible: YES
│  └─ Files Tab in Portal: SHOWN

RESULT: owner@salon.com must be added to BOTH clients explicitly
        (appears as separate contact records)
```

### TaxDome: Contact Shared (Linked)

```
TAXDOME ARCHITECTURE
═════════════════════════════════════════════════════════

CONTACT: owner@salon.com
├─ Email: owner@salon.com
├─ Login Credentials: [single password]
├─ Linked Accounts:
│  ├─ Salon Owner (Individual)
│  └─ Nail Salon LLC (Company)
└─ Can Switch Between Accounts in Portal

RESULT: owner@salon.com created ONCE, automatically linked to both accounts
        (appears as single shared contact)

PORTAL EXPERIENCE:
┌─────────────────────────┐
│ My Accounts             │
├─────────────────────────┤
│ > Salon Owner           │ (click to switch)
│ > Nail Salon LLC        │ (click to switch)
└─────────────────────────┘
```

## 3. DOCUMENT VISIBILITY CONTROL MATRIX

### Canopy: Per-Contact File Access Toggle

```
CLIENT: Salon Owner Personal
─────────────────────────────────────────────────────────

Contact: owner@salon.com
┌──────────────────────────────────┐
│ Files Tab Visible: ✓ ON          │
├──────────────────────────────────┤
│ Files shown in portal:           │
│ ├─ /Personal/Income              │
│ ├─ /Personal/Deductions          │
│ └─ /2025 Return Package          │
└──────────────────────────────────┘

CLIENT: Nail Salon LLC
─────────────────────────────────────────────────────────

Contact: owner@salon.com
┌──────────────────────────────────┐
│ Files Tab Visible: ✓ ON          │
├──────────────────────────────────┤
│ Files shown in portal:           │
│ ├─ /Business/Expenses            │
│ ├─ /Business/Payroll             │
│ └─ /2025 Return Package          │
└──────────────────────────────────┘

Contact: manager@salon.com
┌──────────────────────────────────┐
│ Files Tab Visible: ✓ ON          │
├──────────────────────────────────┤
│ Files shown in portal:           │
│ ├─ /Business/Expenses            │
│ ├─ /Business/Payroll             │
│ └─ /2025 Return Package          │
│                                  │
│ (NOT /Private/CPA Workpapers)    │
└──────────────────────────────────┘
```

### TaxDome: Per-Folder + Per-Document Permissions

```
ACCOUNT: Salon Owner (Individual)
─────────────────────────────────────────────────────────

Folder: /Personal
├─ Permission: "Client can view"
├─ Files: [all docs visible to owner@salon.com]

Folder: /Private
├─ Permission: "Private (CPA only)"
├─ Files: [owner@salon.com CANNOT see]

Document: /Personal/2025 K-1
├─ Default Permission: Inherit from folder ("Client can view")
├─ Individual Override: "Private (hide from client)"
└─ Result: Even though folder is visible, this specific doc is hidden


ACCOUNT: Nail Salon LLC (Company)
─────────────────────────────────────────────────────────

Folder: /Business
├─ Permission: "Client can view"
├─ Access by: owner@salon.com ✓, manager@salon.com ✓

Folder: /Private
├─ Permission: "Private (CPA only)"
├─ Access by: owner@salon.com ✗, manager@salon.com ✗

Document: /Business/Payroll Summary
├─ Default Permission: "Client can view"
├─ Individual Override for manager: "Client can view & edit"
└─ Result: Manager can edit, owner can view-only
```

## 4. BILLING ARCHITECTURE: SINGLE vs CONSOLIDATED

### Scenario A: Sole Proprietor (1 Client Record)

```
CLIENT RECORD: Salon Owner
├─ Entity Type: Individual
├─ Entities Managed: 1 (personal only)
├─ Tax Returns: 1040 + Schedule C
└─ Engagement: 2025 Personal Tax Return

BILLING:
┌─────────────────────────────────┐
│ Invoice to: owner@salon.com      │
├─────────────────────────────────┤
│ Item: Personal Tax Return Prep   │
│ Amount: $2,500                   │
├─────────────────────────────────┤
│ TOTAL: $2,500                   │
└─────────────────────────────────┘

Portal View:
─────────────────────────────────
Salon Owner
├─ Documents
├─ Messages
├─ Invoices
│  └─ $2,500 - Personal Return
└─ Return Packages
```

### Scenario B: S-Corporation (2 Client Records + 1 Group)

#### Canopy: Consolidated Billing

```
CLIENT RECORD 1: Salon Owner (Individual)
├─ Entity Type: Individual
├─ Tax Return: 1040 + K-1 from business
├─ Engagement: 2025 Personal Tax Return

CLIENT RECORD 2: Nail Salon LLC (Business)
├─ Entity Type: Business
├─ Tax Return: 1120-S
├─ Engagement: 2025 Business Tax Return

CLIENT GROUP: Salon Owner Complete
├─ Contains: Both clients
└─ Billing Method: CONSOLIDATED

BILLING (CANOPY GROUP BILLING):
┌─────────────────────────────────────────────┐
│ Invoice to: owner@salon.com (ONE INVOICE)   │
├─────────────────────────────────────────────┤
│ Line 1: Personal Return Prep                │
│         (Salon Owner - Individual)          │
│         Amount: $2,000                      │
├─────────────────────────────────────────────┤
│ Line 2: Business Return Prep                │
│         (Nail Salon LLC)                    │
│         Amount: $1,500                      │
├─────────────────────────────────────────────┤
│ Line 3: S-Corp Entity Setup & Elections     │
│         (Nail Salon LLC)                    │
│         Amount: $500                        │
├─────────────────────────────────────────────┤
│ TOTAL: $4,000 (ONE CHECK OR ACH)            │
└─────────────────────────────────────────────┘

Portal View:
─────────────────────────────────
Salon Owner (Viewing as Owner)
├─ Salon Owner Personal
│  ├─ Documents
│  └─ Messages
├─ Nail Salon LLC
│  ├─ Documents
│  └─ Messages
└─ Invoices
   └─ $4,000 - Complete Tax Services
      (shows breakdown: $2,000 + $1,500 + $500)
```

#### TaxDome: Separate Billing (Manual Consolidation)

```
ACCOUNT 1: Salon Owner (Individual)
├─ Tax Return: 1040 + K-1
├─ Documents: Personal income/deductions

ACCOUNT 2: Nail Salon LLC (Company)
├─ Tax Return: 1120-S
├─ Documents: Business income/expenses

BILLING (TAXDOME SEPARATE INVOICES):
┌──────────────────────────────┐
│ Invoice 1: Salon Owner       │
├──────────────────────────────┤
│ Personal Return Prep         │
│ Amount: $2,000               │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Invoice 2: Nail Salon LLC    │
├──────────────────────────────┤
│ Business Return Prep: $1,500 │
│ Entity Setup: $500           │
│ Amount: $2,000               │
└──────────────────────────────┘

Portal View:
─────────────────────────────────
When viewing "Salon Owner":
├─ Documents (Personal only)
├─ Invoices
│  └─ $2,000 - Personal Return

When viewing "Nail Salon LLC" (switcher):
├─ Documents (Business only)
├─ Invoices
│  └─ $2,000 - Business Return + Setup
```

## 5. CONTACT ROLE MATRIX: WHO SEES WHAT

### Scenario: Salon with Owner + Manager

```
PARTICIPANTS:
═════════════════════════════════════════════════════════
1. owner@salon.com → Owner/decision maker
2. manager@salon.com → Operations manager
3. accountant@firm.com → CPA (internal)

CANOPY CONTACT STRUCTURE:
═════════════════════════════════════════════════════════

CLIENT: Salon Owner (Individual)
├─ Contact: owner@salon.com
│  ├─ Portal Login: YES
│  ├─ Sees /Personal folder: YES
│  └─ Sees /Business folder: NO (not a contact here)

CLIENT: Nail Salon LLC (Business)
├─ Contact: owner@salon.com
│  ├─ Portal Login: YES
│  ├─ Sees /Business folder: YES
│  └─ Sees /Personal folder: NO (not a contact here)
│
├─ Contact: manager@salon.com
│  ├─ Portal Login: YES
│  ├─ Sees /Business folder: YES
│  ├─ Sees /Business/Financials: YES
│  ├─ Sees /Business/Payroll: YES (can edit)
│  ├─ Sees /Business/Tax Planning: NO (visibility OFF)
│  └─ Sees /Private: NO (not visible)

ACCESS MATRIX:
             │ Personal │ Business │ Private
─────────────┼──────────┼──────────┼─────────
owner        │    RW    │    RW    │   NO
manager      │    NO    │    RW    │   NO
accountant   │    RW    │    RW    │    RW


TAXDOME CONTACT STRUCTURE:
═════════════════════════════════════════════════════════

CONTACT: owner@salon.com
├─ Linked to: Salon Owner (Individual)
├─ Linked to: Nail Salon LLC (Business)
├─ Portal Access: YES (both accounts)
│
When viewing "Salon Owner":
│  ├─ /Personal folder: "Client can view" ✓
│  ├─ /Private folder: "Private (CPA only)" ✗
│
When viewing "Nail Salon LLC":
│  ├─ /Business folder: "Client can view" ✓
│  ├─ /Private folder: "Private (CPA only)" ✗

CONTACT: manager@salon.com
├─ Linked to: Nail Salon LLC (Business) ONLY
├─ Linked to: Salon Owner? NO
├─ Portal Access: Business account only
│
When viewing "Nail Salon LLC":
│  ├─ /Business folder: "Client can view & edit" ✓
│  ├─ /Business/Payroll: Individual override "view & edit" ✓
│  ├─ /Business/Tax Planning: Hidden (per-doc override) ✗
│  ├─ /Private folder: "Private" ✗
│
Cannot switch to "Salon Owner" (not a contact)

ACCESS MATRIX:
             │ Personal │ Business │ Private │ Tax Plan
─────────────┼──────────┼──────────┼─────────┼──────────
owner        │    RO    │    RO    │   NO    │    RO
manager      │    NO    │    RW    │   NO    │    NO
accountant   │    RW    │    RW    │    RW   │    RW
```

## 6. DATA FLOW: FROM CLIENT INTAKE TO RETURN DELIVERY

### Complete Workflow: S-Corp Scenario

```
MONTH 1: SETUP PHASE
═════════════════════════════════════════════════════════

[CPA Admin UI]
1. Create Client Record 1: "Owner Personal"
2. Create Client Record 2: "Salon LLC"
3. Add Contacts to each
4. Create Client Group: "Owner Complete"
5. Send engagement letter to owner@salon.com

[Client Portal - Owner receives email]
6. owner@salon.com logs in → sees both clients
7. Reviews engagement letter → signs
8. CPA receives notification


MONTH 2-3: DOCUMENT COLLECTION PHASE
═════════════════════════════════════════════════════════

[Client Portal - Owner]
├─ Logs in → switches to "Owner Personal"
├─ Uploads to /Personal/Income:
│  ├─ W2 from previous job
│  ├─ 1099-INT (bank interest)
│  └─ Dividend statements
│
├─ Switches to "Salon LLC"
├─ Uploads to /Business/Expenses:
│  ├─ Salon supply receipts
│  ├─ Rent invoices
│  └─ Payroll records
│
└─ Messages CPA: "All docs uploaded"

[CPA Admin UI]
├─ Client Record 1: Reviews uploaded Personal docs
├─ Client Record 2: Reviews uploaded Business docs
├─ Creates folders for organizer responses
├─ Sends: "Tax organizer questionnaire" via portal


MONTH 4: RETURN PREPARATION PHASE
═════════════════════════════════════════════════════════

[CPA Workspace]
├─ Open "Owner Personal" engagement
├─ Prepare Form 1040:
│  ├─ Income: W2 + interest + dividends
│  ├─ Deductions: [client data]
│  └─ K-1 from salon business (to be linked)
│
├─ Open "Salon LLC" engagement
├─ Prepare Form 1120-S:
│  ├─ Income/Expenses: [from uploads]
│  ├─ Calculate K-1 (owner's share)
│  └─ Link K-1 to owner's personal 1040

[Tax Software (Drake/CCH)]
├─ Create 1040 file
├─ Create 1120-S file
├─ Link forms via multi-form codes
├─ Calculate estimated tax payments
└─ Generate compliance checklist


MONTH 5: REVIEW & SIGNING PHASE
═════════════════════════════════════════════════════════

[CPA Admin UI]
├─ Create folder: /2025 Return Package (in Client Group)
├─ Upload to /Personal/Return Package:
│  ├─ Completed 1040
│  ├─ All schedules
│  └─ Cover letter
│
├─ Upload to /Business/Return Package:
│  ├─ Completed 1120-S
│  ├─ All schedules
│  ├─ K-1 (copy for owner)
│  └─ Cover letter

[Client Portal - Owner]
├─ Logs in → notification "Your returns are ready"
├─ Switches to "Owner Personal"
├─ Downloads 1040 package → reviews
├─ Message to CPA: "Any questions?"
│
├─ Switches to "Salon LLC"
├─ Downloads 1120-S package → reviews
├─ Electronically signs both returns

[CPA Admin UI]
├─ Receives signed documents
├─ Verifies: 1040 ✓ signed, 1120-S ✓ signed
├─ Prepares electronic filing through IRS
├─ Updates Client Record: Status → "Filed"


MONTH 6: COMPLETION & DELIVERY
═════════════════════════════════════════════════════════

[CPA Admin UI]
├─ E-file confirmation received
├─ Upload confirmation to /2025 Return Package
├─ Invoice Client Group: $4,000 total
│  ├─ Line 1: 1040 prep
│  ├─ Line 2: 1120-S prep
│  └─ Line 3: e-filing

[Client Portal - Owner]
├─ Downloads filed return copies
├─ Reviews invoice → pays via portal
├─ Message CPA: "Thank you!"

[Completion]
✓ Returns filed
✓ Client satisfied
✓ Archive documents in Client Group
```

## 7. COMPARISON TABLE: Canopy vs TaxDome vs Karbon

```
╔════════════════════╦═══════════════════╦═══════════════════╦═══════════════════╗
║ Feature            ║ Canopy            ║ TaxDome           ║ Karbon            ║
╠════════════════════╬═══════════════════╬═══════════════════╬═══════════════════╣
║ Client Structure   ║ Client per entity ║ Account per entity║ Org per entity    ║
║ Contact Model      ║ Discrete (add to  ║ Shared (link once║ Similar to Canopy ║
║                    ║ each client)      ║ to multiple)      ║                   ║
║ Billing            ║ Group billing     ║ Per-account only  ║ Per-engagement    ║
║                    ║ (consolidated)    ║ (manual consolidate║                  ║
║ File Access        ║ Per-contact toggle║ Per-folder +      ║ Similar to Canopy ║
║                    ║                   ║ per-doc override  ║                   ║
║ Portal UX          ║ Client picker     ║ Account switcher  ║ Client selector   ║
║ Engagement Support ║ Implicit          ║ Limited           ║ Explicit (core)   ║
║ Complexity         ║ Moderate          ║ High              ║ Moderate          ║
║ Best for           ║ Families/groups   ║ Complex multi-    ║ Work management   ║
║                    ║                   ║ entity structures ║                   ║
╚════════════════════╩═══════════════════╩═══════════════════╩═══════════════════╝
```

---

## Key Takeaway Diagram

```
FULL ENTITY SEPARATION = 5 COORDINATED LAYERS

┌─────────────────────────────────────────────────────────┐
│ 1. ORGANIZATIONAL (Clients + Contacts)                  │
│    ├─ Each entity = separate Client/Account             │
│    └─ Shared contacts link across entities              │
├─────────────────────────────────────────────────────────┤
│ 2. DOCUMENT (Folder Permissions)                        │
│    ├─ Per-entity folder structure                       │
│    ├─ Per-contact visibility toggles                    │
│    └─ Per-document override permissions                 │
├─────────────────────────────────────────────────────────┤
│ 3. BILLING (Invoicing)                                  │
│    ├─ Consolidated (Canopy group billing)              │
│    ├─ Separate (TaxDome, send separate invoices)       │
│    └─ Attribution (which entity = which line item)      │
├─────────────────────────────────────────────────────────┤
│ 4. PORTAL ACCESS (Client Experience)                    │
│    ├─ Login to specific entity (Canopy)                │
│    ├─ Login once, switch between entities (TaxDome)    │
│    └─ Portal shows only authorized documents            │
├─────────────────────────────────────────────────────────┤
│ 5. ENGAGEMENT TRACKING (Work Assignments)               │
│    ├─ Work items per entity                            │
│    ├─ Progress tracking per entity                     │
│    └─ Time/billing attribution per entity              │
└─────────────────────────────────────────────────────────┘

NO SEPARATION AT ANY LAYER = DOCUMENT MIXING RISK
(most common implementation mistake)
```
