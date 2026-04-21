# Entity Separation: Implementation Summary for Ella

## Core Finding: The 3-Tier Model

All major CPA practice management platforms use this architecture:

```
CLIENT GROUP (optional, for organizing related clients)
    └── CLIENT RECORD (required, the billable unit)
            └── CONTACT (required, portal login user)
```

## For Your Nail Salon Owner Scenario

### Setup: 2 Client Records + 1 Group

```
CLIENT 1: "Salon Owner - Personal"
├─ Type: Individual
├─ Contacts: owner@salon.com
└─ Documents: /Personal/Income, /Personal/Expenses

CLIENT 2: "Nail Salon LLC"
├─ Type: Business
├─ Contacts: owner@salon.com, manager@salon.com (optional)
└─ Documents: /Business/Expenses, /Business/Payroll

CLIENT GROUP: "Salon Owner Complete"
├─ Contains: Client 1 + Client 2
└─ Enables: Consolidated billing, cross-client file sharing
```

### Three Options for Tax Entity

| Entity Type | Why Choose | Returns Generated | CPA Platform Setup |
|---|---|---|---|
| **Sole Proprietor** | Simplest, lowest filing cost | 1040 + Schedule C | 1 Client (Individual) |
| **Single-Member LLC** (default = sole prop) | Liability protection, same tax | 1040 + Schedule C | 1 Client (Individual) |
| **S-Corporation** | Reduce SE tax (income > $50k) | 1040 + 1120-S + K-1 | 2 Clients (Individual + Business) |

## Canopy vs TaxDome: Key Differences

### Canopy
- **Contacts**: Discrete per-client (add separately to each client)
- **File Access**: Per-contact toggle (hide Files tab per contact)
- **Billing**: Group billing = one consolidated invoice with entity attribution
- **Portal**: Client logs into specific client record, sees that entity's files only
- **Best for**: CPAs who want one consolidated bill per family/group

### TaxDome
- **Contacts**: Shared across accounts (one contact can link to unlimited accounts)
- **File Access**: Per-folder + per-document permissions (granular override capability)
- **Billing**: Separate invoice per account (consolidation is manual/external)
- **Portal**: Client logs in once, explicit account switcher shows all linked accounts
- **Best for**: CPAs managing complex multi-entity structures (business owners with rentals, trusts, etc.)

## How Document Access Control Works

### Canopy: Contact-Level Control
```
In Client Record: Nail Salon LLC
├─ Contact: owner@salon.com
│  └─ Files Tab Visible: ON (can access /Business folder)
├─ Contact: manager@salon.com
│  └─ Files Tab Visible: ON (can access /Business folder)

In Client Record: Salon Owner Personal
├─ Contact: owner@salon.com
│  └─ Files Tab Visible: ON (can access /Personal folder)
└─ (manager is NOT a contact here, has zero access)
```

### TaxDome: Folder-Permission Control
```
Account: Jennifer (Individual)
├─ Folder: /Personal (Permission: Client can view)
│  └─ owner@salon.com sees these docs
├─ Folder: /Private (Permission: Private - CPA only)
│  └─ owner@salon.com CANNOT see these docs

Account: Nail Salon LLC (Company)
├─ Folder: /Business (Permission: Client can view)
│  └─ owner@salon.com sees these docs
│  └─ manager@salon.com sees these docs
├─ Folder: /Private (Permission: Private - CPA only)
│  └─ Neither sees these docs
```

## Billing Example: Consolidated vs Separate

### Canopy Group Billing
```
One Invoice to: owner@salon.com
Line 1: Personal Tax Return Preparation (Salon Owner Personal) — $2,000
Line 2: Business Tax Return Preparation (Nail Salon LLC) — $1,500
Line 3: Payroll Setup Consultation (Nail Salon LLC) — $500
TOTAL: $4,000
Payment: One check or ACH

(Owner can see which line relates to which entity)
```

### TaxDome Separate Invoices
```
Invoice 1: Salon Owner Personal - $2,000
  (personal tax return prep)

Invoice 2: Nail Salon LLC - $2,000
  (business return prep + payroll setup)

(If CPA wants consolidated, must be done externally
 or owner pays in separate transactions)
```

## Portal Experience: Client Perspective

### Canopy
```
Login: owner@salon.com
Password: [personal password]

Dashboard:
├─ Salon Owner Personal
│  └─ Documents / Messages / Tasks
├─ Nail Salon LLC
│  └─ Documents / Messages / Tasks

Click "Salon Owner Personal" → sees /Personal folder contents
Click "Nail Salon LLC" → sees /Business folder contents
(No mixing of documents)
```

### TaxDome
```
Login: owner@salon.com
Password: [personal password]

Dashboard: "2 Linked Accounts"
├─ Jennifer (Individual)
└─ Nail Salon LLC (Company)

Account Switcher: "Currently viewing: Jennifer"
[Switch to Nail Salon LLC]

When viewing "Jennifer" → sees Jennifer's documents
When viewing "Nail Salon LLC" → sees Salon's documents
(Same login, explicit switcher)
```

## For Your Implementation: Key Decision Points

### 1. Contact Linking Strategy
**Question:** Should the business manager see personal documents?
- **Canopy**: No (manager is not a contact on Personal client)
- **TaxDome**: No (manager linked to Business account only, personal docs in Personal account)
- **Recommendation**: Keep roles separate—business contact only sees business documents

### 2. Folder Structure
**Recommended across all platforms:**
```
/2025 (year-based root)
├─ /1040 or /Personal
│  ├─ Income Documents
│  ├─ Deduction Documents
│  └─ CPA Workpapers (visibility: CPA only)
├─ /Schedule C or /Business
│  ├─ Expense Documents
│  ├─ Payroll Records
│  ├─ Depreciation Schedules
│  └─ CPA Workpapers (visibility: CPA only)
└─ /Return Package
   └─ Final signed return (visibility: client can view)
```

### 3. Billing Preference
- **Consolidate if**: You want one check, owner doesn't mind paying for all entities at once
  - Use Canopy (group billing built-in)
  - Use TaxDome + manual consolidation
- **Separate if**: You want clarity by entity, owner may pay entities separately
  - Use either platform, send separate invoices

### 4. Portal Complexity
- **Simple**: One owner, no managers → either platform works
- **Complex**: Multiple decision-makers → TaxDome (granular per-doc permissions easier to manage)

## Critical Implementation Rules

### DO:
✅ Create separate Client/Account records for each tax-filing entity (1040 vs 1120-S)
✅ Use folder templates to enforce consistent structure
✅ Test contact permissions before inviting clients
✅ Document which contacts can see which folders (audit trail)
✅ For S-Corp: Create two clients linked in a group

### DON'T:
❌ Create one client for "Everything" (causes document mixing)
❌ Assume folder visibility is automatic (must be toggled per contact)
❌ Mix personal and business documents in same folder
❌ Invite contacts without testing permissions first
❌ Use default "Client can view & edit" for sensitive tax docs (use "Client can view" only)

## Tax Preparation Workflow: From Client Intake to Return Delivery

### Sole Proprietor (1 Client Record)
```
1. Create: "Salon Owner"
2. Engagements: "2025 Personal Tax Return"
3. Client uploads docs to /Personal folder
4. CPA prepares 1040 + Schedule C
5. Client reviews + signs
6. Return delivered to /2025/Return Package folder

Portal shows:
├─ Documents (uploaded by client)
├─ Messages (communications)
├─ Tasks (doc requests)
└─ Return Package (final signed return)
```

### S-Corporation (2 Client Records + 1 Group)
```
1. Create: "Salon Owner" + "Nail Salon LLC"
2. Create Group: "Salon Owner Complete"
3. Engagements:
   - "2025 Personal Tax Return" (1040)
   - "2025 Business Tax Return" (1120-S)
4. Client uploads docs:
   - Personal docs → /Personal folder (Personal client)
   - Business docs → /Business folder (Business client)
5. CPA prepares:
   - 1040 (from Personal docs)
   - 1120-S (from Business docs)
   - K-1 (business profit → personal client's return)
6. Client reviews both returns
7. Deliver in consolidated Return Package folder (visible in group)

Portal shows (for owner):
Salon Owner (Individual)
├─ Documents
├─ Messages
├─ Tasks
└─ Return Package: 1040

Nail Salon LLC (Business)
├─ Documents
├─ Messages
├─ Tasks
└─ Return Package: 1120-S
```

## Unresolved Implementation Questions (For Your Specific Product)

Based on research, these details vary by platform—**clarify before building**:

1. **Contact visibility across portals**: Can one contact have different "roles" showing different doc subsets in the same folder?
2. **Billing across entity types**: If you have Sole Prop + S-Corp clients, can you generate one WIP report across entity types?
3. **Client record → entity type migration**: If a sole prop becomes S-Corp mid-year, how do you migrate the client record?
4. **Folder inheritance**: If you change a parent folder permission, do subfolders auto-inherit or stay independent?
5. **Cross-entity document requests**: Can you request docs from multiple entities in one "request" or must each entity have separate request?

---

## References to Full Research Document

All specific quotes, screenshots, and feature details are in: **`CPA-ENTITY-SEPARATION-RESEARCH.md`**

Key sections:
- Section 1: Canopy implementation specifics
- Section 2: TaxDome implementation specifics
- Section 5: Real-world nail salon workflow
- Section 9: UI/UX pattern examples
- Section 10: Unresolved questions for each platform
