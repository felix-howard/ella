# Deep Research: Full Entity Separation in CPA Practice Management Software

**Research Date:** April 2026
**Focus:** Implementation patterns for managing individual clients + business entities
**Status:** Comprehensive findings with specific implementation details

---

## EXECUTIVE SUMMARY

CPA practice management platforms implement "full entity separation" through a **3-tier hierarchical model**:
- **Client Group** (top) → **Client Record** (middle) → **Contact** (bottom)

Each platform uses this differently:
- **Canopy**: Contact-centric, per-contact file access control
- **TaxDome**: Account-centric, linked contacts, document folder permissions
- **Karbon**: Client group + engagement model, work items at entity level
- **Tax Software (Drake/CCH)**: Form linking at return level (Schedule C → 1040)

The key insight: **separation happens at multiple layers simultaneously** (billing, files, contacts, engagements, portal access).

---

## 1. CANOPY: CLIENT GROUPS + CONTACT-LEVEL FILE CONTROL

### 3-Tier Structure
**Source:** [Canopy Knowledge Base - Clients, Contacts, Client Groups Overview](https://support.getcanopy.com/en/articles/9653376-clients-contacts-client-groups-overview)

```
Client Group (e.g., "Kim Costa Group")
├── Client: Costa Family (Individual)
│   └── Contacts: Kim, Alessandro, Sally
├── Client: Kim's Cafe (Business)
    └── Contacts: Kim, Cafe Manager
```

**Key Distinction:**
- **Client** = "an individual or business entity for whom you complete work"
- **Contact** = "a person associated with a client (the people you interact with)"
- **Client Group** = "a grouping of related client records under the same ownership structure"

**CRITICAL:** One contact (Kim) can appear on multiple client records but each client is separate.

### How CPAs Create This Setup

**For a nail salon owner with personal + business:**

1. **Create Individual Client**: Click "Add Client" → Select "Individual" → Client name "Salon Owner Personal"
2. **Create Business Client**: Click "Add Client" → Select "Business" → Client name "Nail Salon LLC"
3. **Add Contacts to Each**:
   - Individual client: Owner email (primary contact)
   - Business client: Owner email + manager email (if applicable)
4. **Create Client Group**:
   - Go to Clients → Client Groups
   - Click "Create group"
   - Add both clients to group
   - Name: "Salon Owner Complete"

**Source:** [Canopy Knowledge Base - Manage Client Groups](https://support.getcanopy.com/en/articles/9548407-manage-client-groups)

### Document Organization & Access Control

**Visibility Model:**
- Files in client record are NOT automatically visible in client portal
- CPA controls visibility per file, per contact
- Each contact can have Files tab hidden/shown independently

**Source:** [Canopy Knowledge Base - Show or Hide Files & Folders](https://support.getcanopy.com/en/articles/9375948-show-or-hide-files-folders-on-your-client-s-portal)

**Implementation:**
```
Client Record UI → Files Tab
- Visibility Icon (Blue = Visible, Gray = Hidden)
- Per-Contact Toggle: "Files tab visible" ON/OFF

Example: Owner portal shows:
- /Personal/1040 materials
- /Personal/W2s
- /Business/1040-Schedule C materials
- /Business/Salon expenses

BUT Manager contact only sees:
- /Business/1040-Schedule C materials
- /Business/Payroll info
```

**Folder Template System:**
- Pre-set access permissions on folder structures
- Apply templates to contacts in bulk
- Example: "Individual Tax Return" template vs "Business Return" template

### Consolidated Group Billing

**The Core Feature:**
"Group Billing allows you to consolidate multiple invoices into a single bill for a group of clients."

**How It Works:**
1. Navigate to Billing → Invoices → Create Invoice
2. Select **Client Group** (not individual client)
3. Choose which client portal receives the invoice
4. Add line items (system tracks which client each line relates to)
5. Send to owner once

**What the Invoice Shows:**
- Consolidated view (all work across all entities)
- Optional detail view showing client attribution per line
- OR "Single Line Invoice" format (simplified)

**Source:** [Canopy Knowledge Base - Explore Group Billing](https://support.getcanopy.com/en/articles/9548431-explore-group-billing)

**Example Scenario:**
```
Invoice to Kim Costa (sent to one email address)
Line Items:
- Personal Tax Return - Hourly Time Entry - $2,400 (Costa Family)
- Business Tax Return - Hourly Time Entry - $1,800 (Kim's Cafe)
- Consultation - Flat Fee - $500 (Kim's Cafe)

Total Due: $4,700 (one invoice, one payment)
```

### Work-In-Progress at Group Level

When you add time to engagements, you can assign to individual client OR the client group. The WIP report filters by group, showing unbilled work across all entities.

---

## 2. TAXDOME: ACCOUNT-BASED SEPARATION + LINKED CONTACTS

### Core Model

**Accounts** = Billable entities (Individual or Company)
**Contacts** = People who access portal
**Relationship:** Accounts must link to at least one contact

**Source:** [TaxDome Help - Contacts & Accounts Explained](https://help.taxdome.com/article/514-contacts-accounts-explained)

### Creating Individual + Business Accounts

**Step 1: Add Individual Account**
```
Click "New" → "Account"
- Account Type: "Individual"
- Name: "Salon Owner"
- Address: [Full address]
- Tags: [Optional categorization]
- Team Members: [Assign access]
- Folder Template: [Apply default structure]
```

**Step 2: Add Contacts**
- Existing contacts (link to multiple accounts)
- New contacts (name, email)
- Login permissions (portal access toggle)
- Email sync (allow/block)
- Notification preferences (per contact)

**Source:** [TaxDome Help - Adding Accounts](https://help.taxdome.com/article/100-adding-accounts)

**Step 3: Add Business Account**
```
Click "New" → "Account"
- Account Type: "Company"
- Name: "Nail Salon LLC"
- Address: [Business address]
- Link same owner contact OR create new one
```

### The "Linked Accounts" Feature

**CRITICAL FEATURE:** One contact can link to multiple accounts.

**Example Implementation:**
```
Contact: "owner@salon.com"
├── Linked to: Salon Owner Individual Account
├── Linked to: Nail Salon LLC Account
├── Linked to: Salon Rentals LLC Account

Account: Salon Owner Individual
├── Contacts: owner@salon.com, spouse@salon.com
├── Role for owner: "Individual"

Account: Nail Salon LLC
├── Contacts: owner@salon.com, manager@salon.com
├── Role for owner: "Owner"
├── Role for manager: "Manager"
```

**TaxDome's exact language:** "as a contact, Adam Smith can be linked to the Smith Family, Smith Rentals LLC, Acme Corp and Adam Smith accounts, as he manages all four entities."

All accounts with shared contacts appear in "Linked accounts" section at bottom of account's Info tab.

**Source:** [TaxDome Help - Linked Accounts Feature](https://help.taxdome.com/article/127-multiple-logins-profile-access)

### Document Organization

**Five-Tab System (per account):**
1. **Documents**: All client docs + uploaded from portal
2. **Approvals**: Firm-prepared docs awaiting approval
3. **Signatures**: Firm docs needing signatures
4. **Tax Return Delivery**: Tax return packages
5. **File Requests**: Links for clients without portal login

**Source:** [TaxDome Help - Documents Overview](https://help.taxdome.com/article/818-how-docs-work)

**Folder Structure & Permissions:**

```
Folder Permission Levels:
├── "Client can view & edit" (Shared, editable)
├── "Client can view" (Shared, read-only)
└── "Private" (CPA only, invisible to client)

Individual vs Business Examples:
Account: Salon Owner
├── Personal (Client can view)
│   ├── 1040 docs
│   ├── W2s
│   └── Investment statements
└── Private (CPA only)
    └── Personal notes

Account: Nail Salon LLC
├── Business (Client can view)
│   ├── Schedule C materials
│   ├── Payroll records
│   └── Expense docs
└── Private (CPA only)
    └── Tax planning notes
```

**Granular Individual Permissions:**
- Override default folder permissions for specific docs
- Hide single doc even if folder is "view-only"
- Share private folder doc without moving it

**Source:** [TaxDome Help - Document & Folder Permissions](https://help.taxdome.com/article/137-documents-explained)

### Multi-Account Visibility

**Portal Experience:**
When contact logs in with one email linked to multiple accounts:
- Dashboard shows all linked accounts
- Can switch between accounts (explicit account selector)
- Documents visible/hidden per account + folder permission
- Does NOT auto-show personal account docs in business account portal

---

## 3. KARBON: CLIENT GROUPS + ENGAGEMENTS AT ENTITY LEVEL

### Setup Structure

**Client Group** = Organization (family, business group, trust)
**Clients/Organizations** = Individual entities within group
**Engagements** = Work tied to specific entity OR group

**Source:** [Karbon Help - Manage a Client Group](https://help.karbonhq.com/en/s/articles/5880261-manage-a-client-group)

### Real-World Example (from Karbon community)

"1 Group creation, 6 organizations need to be created, 2 people contacts need to be created, 1 onboarding work item to the group, and 10 annual work items for the tax returns to the organizations set to recurring annually."

**This shows:**
- Group level for relationship management
- Organization level for tax entities
- Work items can be at group OR org level

### Work Items & Engagements

**How it Works:**
1. Create engagement letter (standard template)
2. Client signs engagement → work items auto-created for assigned team
3. Work items tied to specific entity or entire group
4. Engagement tracks what was promised vs. what's being delivered

**Example for Salon Owner:**
```
Client Group: Salon Owner Complete
├── Engagement 1: Personal Tax Return (entity: Individual)
│   └── Work Items:
│       - Gather documents (1040)
│       - Prepare return
│       - Client review
├── Engagement 2: Business Tax Return (entity: Nail Salon LLC)
    └── Work Items:
        - Gather documents (Schedule C)
        - Prepare return
        - Client review
```

**Source:** [Karbon - Engagements Feature](https://karbonhq.com/feature/engagements/)

### Document & Contact Management

Similar to Canopy—contacts can appear on multiple client records within a group. The system emphasizes relationship management (who's connected to whom) more than strict document separation.

---

## 4. TAX SOFTWARE: FORM LINKING (Drake, CCH Axcess)

### Drake Tax: Multi-Schedule C on Single 1040

**How It Handles Multiple Businesses:**

If individual has 2+ sole proprietorships:
1. Create separate Schedule C for each business
2. Each C links to same 1040
3. Use "multi-form code" to direct income from forms

**Exact Implementation:**
- Schedule C screen 1: Nail Salon business
- Schedule C screen 2: Consulting business
- Multi-form code directs 1099s to correct C screen
- Both Cs sum net profit/loss → flows to 1040

**Source:** [Drake Tax KB - Multiple 1099s for Same Business](https://kb.drakesoftware.com/kb/Drake-Tax/11610.htm)

**Additional Income Tabs:**
Drake 2023+ added multiple income tabs on DD1 (data entry) screen for clients with 3+ businesses—keeps detailed info per business separately.

**Key Distinction:**
- Individual = one 1040 record
- Businesses = multiple Schedule C records
- Linking happens via multi-form codes (not separate client records)

### CCH Axcess: Client Collaboration Portal

**Supporting Multiple Entity Returns:**

With single login, clients can switch between:
- 1040 (personal)
- S-Corp, C-Corp, Partnership
- Fiduciary returns
- Employee plans
- Non-profits

**Source:** [Wolters Kluwer - CCH Axcess Client Collaboration](https://www.wolterskluwer.com/en/solutions/cch-axcess/client-collaboration)

**Exact Client Experience:**
```
Login: owner@salon.com
Password: [one password]

Client Portal Dashboard:
├── Request: "2025 Personal Tax Return (1040)"
├── Request: "2025 Business Tax Return (S-Corp)"
├── Request Switcher: Easy navigation between active requests
```

**CPA-Side Templates:**
Firms can create completely different templates (organizers, engagement letters) per entity type:
- Individual template (collects W2s, investment docs)
- S-Corp template (collects payroll records, basis docs)

**Source:** [CCH Axcess Release Notes v6.2](https://support.cch.com/axcess/releasenotes/clientcollaboration/CCH%20Axcess%20Client%20Collaboration%20v.%206.2%20Release%20Notes.pdf)

---

## 5. REAL-WORLD CPA WORKFLOW: NAIL SALON OWNER

### Scenario Setup

**Client:** Jennifer owns a nail salon. She has:
- Personal income + expenses (self-employed)
- Nail Salon LLC (owned 100% by her)
- Question: Should she file as sole proprietor or S-Corp?

### How Each Platform Handles This

#### **Canopy Workflow:**

```
SETUP PHASE:
1. Create Client: "Jennifer Personal"
   - Type: Individual
   - Contact: jennifer@email.com (give her login)

2. Create Client: "Nail Salon LLC"
   - Type: Business
   - Contact: jennifer@email.com (same person)

3. Create Client Group: "Jennifer Complete"
   - Add both clients
   - Now CPA can bill her once for both entities

DOCUMENT COLLECTION:
4. In Jennifer Personal Client:
   - Create folders: /Personal/Income, /Personal/Expenses
   - Visibility: Client can see (she uploads W2s, investment docs)

5. In Nail Salon Client:
   - Create folders: /Business/Salon Expenses, /Business/Payroll
   - Visibility: Client can see (she uploads receipts, payroll records)

PORTAL EXPERIENCE (Jennifer's view):
- Gets one login
- Sees both client records in her dashboard
- Can upload to appropriate folders
- Downloads her completed return when ready

BILLING:
- Creates Group Invoice: "Jennifer Complete"
- Includes: Personal return prep + Business return prep
- One invoice, one payment
- Line items show which entity work relates to
```

#### **TaxDome Workflow:**

```
SETUP PHASE:
1. Create Account: "Jennifer" (Type: Individual)
   - Add contact: jennifer@email.com
   - Grant login: YES

2. Create Account: "Nail Salon LLC" (Type: Company)
   - Link same contact: jennifer@email.com
   - Grant login: YES
   - Assign team members with access

3. Both accounts now appear in "Linked Accounts"

DOCUMENT ORGANIZATION:
4. In Jennifer account:
   - Folder structure: /Personal/Income, /Personal/Expenses
   - Permissions: "Client can view"
   - Jennifer sees these docs in her portal

5. In Nail Salon account:
   - Folder structure: /Business/Salon Expenses, /Business/Payroll
   - Permissions: "Client can view"
   - Jennifer sees these docs when viewing Business account

PORTAL EXPERIENCE (Jennifer's view):
- Single login with one email
- Dashboard shows 2 linked accounts
- Explicit switcher: "Switch to Nail Salon LLC"
- When viewing Personal account: only sees Personal docs
- When viewing Business account: only sees Business docs
- (No cross-leakage of documents between accounts)

BILLING:
- Create separate invoices per account OR
- Consolidate externally (not a built-in feature like Canopy)
```

### Tax Entity Decision Flow

#### **Option 1: Sole Proprietor (Simplest)**
```
Individual Client Record: Jennifer
├── Schedule C filed with 1040
├── Self-employment tax on full net profit
└── Documents collected in one place

Software Workflow:
- Drake: One 1040, one Schedule C
- Canopy: One Client (Individual) with Schedule C documents
- TaxDome: One Account (Individual) with salon docs in Business folder
```

#### **Option 2: S-Corporation Election (Complex, higher income)**
```
Individual Client: Jennifer (personal 1040 + K-1 docs)
Business Client: Nail Salon LLC (Form 1120-S)

Workflow:
- Drake: 1040 + Schedule 1 (K-1 from S-Corp) + separate 1120-S return
- Canopy: Two clients (both linked), Group billing consolidates
- TaxDome: Two accounts, Jennifer linked to both, separate K-1 and 1120-S docs

Documents Collected:
- Personal: W2s, investment income, itemized deductions
- Business: Payroll W2s (salary Jennifer pays herself), profit distribution, basis records
```

#### **Option 3: Single-Member LLC (Taxed as Sole Prop)**
```
Default tax treatment = Schedule C with 1040
Same workflow as Option 1 but:
- LLC provides liability protection
- Still files Schedule C (no separate entity return)
```

### The Complete Document Matrix

```
CLIENT RECORD/ACCOUNT: Jennifer (Individual)
├── Documents Folder: /Personal
│   ├── 2025 W2 (from consulting work)
│   ├── Investment income 1099-DIV
│   ├── Mortgage interest statement
│   └── Medical expenses (if itemizing)
├── Permissions: Jennifer can VIEW
├── Visibility to Jennifer's portal: YES

CLIENT RECORD/ACCOUNT: Nail Salon LLC
├── Documents Folder: /Salon Operations
│   ├── P&L from salon accounting software
│   ├── Receipts for supplies & equipment
│   ├── Salon rent contract
│   ├── Chair rental agreements (if applicable)
│   ├── Payroll records (W2s, 1099s paid to contractors)
│   └── Depreciation schedule
├── Documents Folder: /Private (CPA only)
│   ├── Entity formation docs (LLC papers)
│   ├── Tax planning workpapers
│   └── S-Corp analysis spreadsheet
├── Permissions: Jennifer can VIEW (public folder) or NO ACCESS (private folder)
├── Visibility to Jennifer's portal: YES (if business owner), NO (if contractor)

BILLING:
- Consolidated Invoice: "Jennifer Complete Tax Services"
  - Item 1: Personal return preparation (Jennifer entity) - $2,000
  - Item 2: Business return preparation (Salon LLC entity) - $1,500
  - Item 3: Consultation on S-Corp election (grouped) - $500
  - TOTAL: $4,000 (one invoice, one payment)

TIMELINE:
Jan-Mar: Jennifer uploads docs as they arrive
- Personal docs → Personal folder
- Salon expense docs → Business folder
Apr-May: CPA prepares returns
- 1040 based on personal docs
- Schedule C based on salon docs
  OR
- 1040 + K-1 + 1120-S if S-Corp election chosen
Jun: Jennifer reviews & signs (client portal)
- Views consolidated return package
- Downloads for filing
```

---

## 6. KEY IMPLEMENTATION PATTERNS: THE "FULL SEPARATION" MODEL

### Layer 1: Billing Separation
- **Canopy**: Group billing consolidates OR creates separate invoices per client
- **TaxDome**: Separate invoices per account (consolidation is manual)
- **Tax Software**: Billing at return level (1040 vs 1120-S)

### Layer 2: Document Separation
- **Canopy**: Per-contact file access control (can hide files from specific contacts)
- **TaxDome**: Per-account folder structure + granular per-document permissions
- **Tax Software (Drake)**: Form-level linking (Schedule C → 1040)
- **Tax Software (CCH)**: Return-level organization (separate requests for each return)

### Layer 3: Portal Access Separation
- **Canopy**: Contacts log in to specific client record (implicit entity separation)
- **TaxDome**: Contacts log in once, switch between linked accounts (explicit switcher)
- **CCH Axcess**: Single login, Request Switcher between return types
- **Drake**: Not applicable (tax software, not practice management)

### Layer 4: Contact/User Management
- **Canopy**: Contacts unique per client (one person can be contact on multiple clients, but must be added separately)
- **TaxDome**: Contacts shared across accounts (one contact can link to unlimited accounts, appears in "Linked Accounts")
- **Karbon**: Similar to Canopy (contacts per organization in group)

### Layer 5: Engagement/Work Separation
- **Canopy**: Engagements per client (implicit separation)
- **TaxDome**: Not engagement-focused (task/deadline focused)
- **Karbon**: Engagements at group OR entity level (explicit choice)
- **Tax Software**: Returns at entity level (1040 vs 1120-S vs Schedule C)

---

## 7. THE CONTACT VS CLIENT VS ENTITY DISTINCTION

### Three-Tier Conceptual Model

```
┌─────────────────────────────────────────────────────────────┐
│ ENTITY / ACCOUNT / CLIENT RECORD (what you bill for)       │
│ ├─ Salon Owner (Individual)                                 │
│ └─ Nail Salon LLC (Business)                                │
├─────────────────────────────────────────────────────────────┤
│ CLIENT (who you bill) - can be entity or contact            │
│ ├─ Salon Owner Personal                                     │
│ └─ Salon Owner Business                                     │
├─────────────────────────────────────────────────────────────┤
│ CONTACT (who logs in) - shared across entities              │
│ ├─ jennifer@salon.com (has login to both)                  │
│ └─ manager@salon.com (has login to business only)          │
└─────────────────────────────────────────────────────────────┘
```

### Canopy's Exact Model

**Client**: "an individual or business entity for whom you complete work"
- One client = one tax return preparation engagement
- Example: "Salon Owner Personal" is separate client from "Nail Salon LLC"

**Contact**: "a person associated with a client (the people you interact with)"
- Multiple contacts per client (example: owner + CPA at business)
- One contact can be on multiple clients (example: Jennifer on both Personal + Business)

**Client Group**: "a grouping of related client records under the same ownership structure"
- Groups related clients for billing + document sharing
- Not a required concept (optional organization)

**Constraint:** Each contact on a client can have Files tab visibility toggled independently
- Jennifer logs in to Salon Owner Personal → sees /Personal documents
- Jennifer logs in to Nail Salon LLC → sees /Business documents
- (But if her spouse is also a contact on Personal, spouse's view can be different)

### TaxDome's Exact Model

**Account**: "an entity you interact with" (Individual or Company)
- Billable entity
- Has its own document folders, team access, permissions

**Contact**: "the actual people you interact with"
- Portal login credentials
- Email address(es) per contact
- Can be linked to multiple accounts

**Linked Accounts**: "all accounts with shared contacts"
- Visible in account's Info tab
- Shows relationship graph

**Key Difference from Canopy:** A contact can link to accounts without being added separately to each—the system maintains the "linked accounts" relationship automatically once a contact is created.

---

## 8. REAL QUESTIONS ANSWERED

### Q: "Is a business a separate 'Client' record or a sub-entity?"
**A:** Depends on platform:
- **Canopy**: Separate Client record (required for separate billing/engagement)
- **TaxDome**: Separate Account record
- **Tax Software**: Separate return form (1120-S file)

**Best Practice:** Always create as separate for tax purposes (different returns = different records).

### Q: "How do documents get organized per entity?"
**A:**
- **Canopy**: Per-client folder structure, visibility toggled per contact
- **TaxDome**: Per-account folder structure, permissions set at folder or doc level
- **Both support year-based organization** (e.g., /2025, /2026)

### Q: "How does the CPA navigate between individual and business?"
**A:**
- **Canopy**: Dashboard shows all clients, click to switch
- **TaxDome**: Dashboard shows all accounts, explicit "Switch to Salon Owner LLC" button
- **CCH Axcess**: "Request Switcher" for return-level switching

### Q: "What does the billing look like—one invoice or separate?"
**A:**
- **Canopy**: One consolidated Group Invoice OR separate invoices (CPA's choice)
- **TaxDome**: Separate invoices per account (no built-in consolidation)
- **CCH Axcess**: Billing at request level (could be per return)

### Q: "How do they handle when individual has S-Corp + personal?"
**A:**
- **Canopy**: Two clients in one group, two separate return engagements
- **TaxDome**: Two accounts (Individual + S-Corp), Jennifer linked to both
- **Drake**: One 1040, separate 1120-S file, K-1 flows to 1040
- **CCH Axcess**: Two separate requests (1040 + 1120-S), same login

### Q: "Can one person log in and see both returns without confusion?"
**A:** YES, explicitly designed for this:
- **Canopy**: Client logs into account → sees appropriate documents
- **TaxDome**: Client logs in → switches between accounts (manual switcher)
- **CCH Axcess**: "Request Switcher" → automatically organized returns
- **Drake**: Not applicable (not client-facing portal)

---

## 9. SPECIFIC UI/UX PATTERNS

### Canopy Client Portal (from CPA's setup)

```
CPA Admin View:
┌─ Clients
│  ├─ Salon Owner Personal (Individual)
│  │  ├─ Contacts: jennifer@salon.com
│  │  ├─ Files
│  │  │  ├─ /Personal Income (Visible to jennifer: YES)
│  │  │  └─ /Personal Expenses (Visible to jennifer: YES)
│  │  └─ Engagements: 2025 Personal Return
│  │
│  ├─ Nail Salon LLC (Business)
│  │  ├─ Contacts: jennifer@salon.com, manager@salon.com
│  │  ├─ Files
│  │  │  ├─ /Salon Expenses (Visible to jennifer: YES, manager: YES)
│  │  │  └─ /CPA Workpapers (Visible to jennifer: NO, manager: NO)
│  │  └─ Engagements: 2025 Business Return
│  │
│  └─ Client Groups
│     └─ "Salon Owner Complete" (contains: Personal + Business)

Client Portal View (jennifer@salon.com):
┌─ My Clients
│  ├─ Salon Owner Personal
│  │  ├─ Documents
│  │  │  ├─ /Personal Income
│  │  │  └─ /Personal Expenses
│  │  └─ Tasks/Messages
│  │
│  └─ Nail Salon LLC
│     ├─ Documents
│     │  └─ /Salon Expenses
│     └─ Tasks/Messages

(CPA Workpapers folder is hidden from her view)
```

### TaxDome Account Dashboard

```
CPA Admin View:
Account: Jennifer
├─ Type: Individual
├─ Contacts: jennifer@salon.com
├─ Documents
│  ├─ Personal
│  │  └─ Visibility: "Client can view"
│  └─ Private
│     └─ Visibility: "Private (CPA only)"
├─ Team Members: [CPA1, CPA2]
└─ Linked Accounts
   ├─ Nail Salon LLC
   └─ (any other entities with shared contact)

Account: Nail Salon LLC
├─ Type: Company
├─ Contacts: jennifer@salon.com, manager@salon.com
├─ Documents
│  ├─ Business
│  │  └─ Visibility: "Client can view"
│  └─ Private
│     └─ Visibility: "Private (CPA only)"
├─ Team Members: [CPA1, CPA3]
└─ Linked Accounts
   └─ Jennifer

Client Portal View (jennifer@salon.com):
┌─ My Accounts
│  ├─ Jennifer (Switch to Account)
│  │  └─ Documents: [Personal folder contents]
│  └─ Nail Salon LLC (Switch to Account)
│     └─ Documents: [Business folder contents]
```

### Karbon Client Group View

```
Client Group: "Salon Owner Complete"
├─ Related Organizations
│  ├─ Salon Owner (Individual)
│  │  ├─ Contact: jennifer@salon.com
│  │  └─ Engagements: 2025 Personal Return
│  │
│  └─ Nail Salon LLC (Organization)
│     ├─ Contacts: jennifer@salon.com, manager@salon.com
│     └─ Engagements: 2025 Business Return (1120-S), Payroll Setup

├─ Work Items
│  ├─ Group Level: "Annual onboarding review"
│  ├─ Personal Entity: "Gather 1040 documents"
│  └─ Business Entity: "Prepare 1120-S return"

├─ Documents
│  ├─ /Salon Owner (Individual)
│  └─ /Nail Salon LLC
```

---

## 10. UNRESOLVED IMPLEMENTATION QUESTIONS

1. **Portal Document Sync Timing**: How often do portal-visible documents update in real-time vs batch? (Not explicitly documented)

2. **Sole Proprietor → S-Corp Migration**: How do platforms handle moving from sole prop client record to S-Corp if entity type changes? (Not covered in docs)

3. **Spouse/Co-Owner Document Access**: If business has two owners with different roles, can folder permissions be role-based rather than contact-based? (Canopy/TaxDome not explicit)

4. **Multi-Entity Engagement Letters**: Can you attach one engagement letter to multiple entities in a client group, or must each entity have separate engagement? (Karbon unclear)

5. **Year-to-Year Client Record Migration**: When a client's situation changes (e.g., adds second business in year 2), how do platforms handle the historical record? (Not documented)

6. **Reporting Across Client Groups**: Can you generate WIP/billing reports across ALL client groups simultaneously, or only per-group? (Canopy mentions per-group but doesn't address cross-group)

7. **Drake Multi-Form Code Mechanics**: What happens if two Schedule Cs have the same line-item code? Does the system auto-route or require manual assignment? (Documentation exists but specifics unclear)

8. **TaxDome Account Merging**: If Jennifer's personal account and business account had separate contacts initially, can you merge them later without data loss? (Not covered)

---

## SOURCES

### Canopy
- [Clients, Contacts, Client Groups Overview](https://support.getcanopy.com/en/articles/9653376-clients-contacts-client-groups-overview)
- [Manage Client Groups](https://support.getcanopy.com/en/articles/9548407-manage-client-groups)
- [Manage Clients & Contacts](https://support.getcanopy.com/en/articles/9868821-manage-your-clients-contacts)
- [Explore Group Billing](https://support.getcanopy.com/en/articles/9548431-explore-group-billing)
- [Show or Hide Files & Folders on Client Portal](https://support.getcanopy.com/en/articles/9375948-show-or-hide-files-folders-on-your-client-s-portal)
- [Setting Access & Permissions](https://support.getcanopy.com/en/articles/9375802-setting-access-permissions)

### TaxDome
- [Adding Accounts](https://help.taxdome.com/article/100-adding-accounts)
- [Contacts & Accounts Explained](https://help.taxdome.com/article/514-contacts-accounts-explained)
- [Contact Settings (Login, Notify, Email Sync)](https://help.taxdome.com/article/127-multiple-logins-profile-access)
- [Document Management System](https://help.taxdome.com/article/818-how-docs-work)
- [Document and Folder Permissions](https://help.taxdome.com/article/137-documents-explained)
- [Move Files & Folders & Change Visibility](https://help.taxdome.com/article/145-how-to-move-documents)

### Karbon
- [Manage a Client Group](https://help.karbonhq.com/en/s/articles/5880261-manage-a-client-group)
- [Engagements Feature](https://karbonhq.com/feature/engagements/)

### Tax Software
- [Drake Tax - Multiple 1099s for Same Business](https://kb.drakesoftware.com/kb/Drake-Tax/11610.htm)
- [CCH Axcess Client Collaboration](https://www.wolterskluwer.com/en/solutions/cch-axcess/client-collaboration)
- [CCH Axcess Entity Management](https://support.cch.com/kb/solution.aspx/sw2521)

### Tax Filing References
- [Schedule C (Form 1040) - IRS](https://www.irs.gov/forms-pubs/about-schedule-c-form-1040)
- [Single-Member LLCs - IRS](https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies)

---

## FINAL INSIGHT

**"Full entity separation" in CPA practice management is NOT a single feature—it's a coordinated system across:**

1. **Organizational structure** (Client Groups/Accounts holding related entities)
2. **Billing** (consolidated invoices with entity attribution OR separate per-entity)
3. **Document management** (per-entity folder hierarchies + permission controls)
4. **Portal access** (contact login → see only their authorized documents)
5. **Work tracking** (engagements/tasks at entity level)

The **weakest link in all these systems**: **There is no automatic enforcement preventing a CPA from accidentally showing Personal docs in a Business portal view.** All systems rely on manual setup discipline (correct folder permissions, contact access toggles, etc.).

Best practice: **Use Folder Templates** to enforce structure from day one, and audit quarterly whether permissions drift.
