# Entity Separation Research: Complete Index

## What This Research Covers

Deep dive into how **6 major CPA/tax platforms** implement "full entity separation"—the capability to manage one client with multiple tax-filing entities (individual + business) while keeping documents, billing, and portal access completely separated.

**Date:** April 2026
**Research Method:** Official documentation, knowledge base articles, YouTube demo references, user workflows
**Platforms Covered:** Canopy, TaxDome, Karbon, Drake Tax, CCH Axcess, plus real-world CPA workflows

---

## Files in This Research Package

### 1. **CPA-ENTITY-SEPARATION-RESEARCH.md** (Primary Deep Dive)
**Length:** ~2,500 lines | **Audience:** Technical architects, product managers
**What it contains:**
- Section 1: Canopy 3-tier model (Client Groups, Clients, Contacts) with exact setup steps
- Section 2: TaxDome account management with linked contacts explanation
- Section 3: Karbon client groups + engagements
- Section 4: Drake Tax multi-Schedule C linking via multi-form codes
- Section 5: Real-world nail salon owner workflow (sole prop vs S-Corp decision tree)
- Section 6: The 5 coordination layers of "full separation"
- Section 7: Contact vs Client vs Entity distinction (with 3-tier diagram)
- Section 8: Q&A on specific implementation questions
- Section 9: Actual UI/UX patterns (with ASCII mockups)
- Section 10: Unresolved implementation questions for your product

**Best for:** Understanding the complete architecture

### 2. **ENTITY-SEPARATION-IMPLEMENTATION-SUMMARY.md** (Quick Start)
**Length:** ~800 lines | **Audience:** Developers, product teams, decision-makers
**What it contains:**
- The 3-tier model (visual)
- Nail salon scenario: 2 client records + 1 group
- Tax entity decision tree (sole prop vs LLC vs S-Corp)
- Canopy vs TaxDome feature comparison table
- Document access control (Canopy vs TaxDome)
- Billing examples (consolidated vs separate)
- Portal experience mockups
- Implementation DO's and DON'Ts
- Decision framework (which platform for your use case)

**Best for:** Quick reference during implementation

### 3. **ENTITY-SEPARATION-VISUAL-GUIDE.md** (Diagrams & Flows)
**Length:** ~1,000 lines | **Audience:** Visual learners, stakeholders, new team members
**What it contains:**
- 7 detailed ASCII diagrams showing architecture
- Contact access model comparison (Canopy vs TaxDome side-by-side)
- Document visibility matrix (permission flows)
- Billing structure (single client vs S-Corp scenarios)
- Contact role matrix (who sees what)
- Complete data flow from client intake to return delivery
- Platform comparison table
- Key takeaway diagram: 5 layers of separation

**Best for:** Onboarding new developers, presenting to stakeholders

### 4. **This File: ENTITY-SEPARATION-RESEARCH-INDEX.md**
Quick navigation guide with research summaries

---

## Key Findings at a Glance

### The Universal Architecture (All Platforms)

```
CLIENT GROUP/LINKED ACCOUNTS
└── CLIENT RECORD/ACCOUNT (per tax entity)
    └── CONTACT (portal user)
```

### Three-Tier Access Control

| Layer | Canopy | TaxDome | Karbon |
|-------|--------|---------|--------|
| **Organizational** | Discrete contacts per client | Shared contacts across accounts | Discrete contacts per org |
| **Document** | Per-contact file toggle | Per-folder + per-doc permissions | Per-contact access |
| **Billing** | Group billing (consolidated) | Per-account (separate) | Per-engagement |
| **Portal** | Client picker | Account switcher | Client selector |

### Real-World Implementation: Nail Salon Owner

**Setup:**
```
Client 1: "Owner Personal" (Individual)
Client 2: "Salon LLC" (Business)
Group: "Owner Complete"
Contact: owner@salon.com (added to both)
```

**Billing Option A (Canopy):**
```
One Invoice: $4,000 total
├─ Personal Return: $2,000
├─ Business Return: $1,500
└─ S-Corp Setup: $500
```

**Billing Option B (TaxDome):**
```
Invoice 1: $2,000 (Personal)
Invoice 2: $2,000 (Business + Setup)
```

### Tax Filing Decision Tree

```
Individual Client: Jennifer

Option 1: SOLE PROPRIETOR
├─ Returns: 1040 + Schedule C
├─ Complexity: Low
├─ CPA Setup: 1 Client (Individual)
└─ Best if: Income < $50k, no liability concerns

Option 2: SINGLE-MEMBER LLC (default = sole prop tax)
├─ Returns: 1040 + Schedule C
├─ Complexity: Low (legal) + Low (tax)
├─ CPA Setup: 1 Client (Individual)
└─ Best if: Wants liability protection, simple taxes

Option 3: S-CORPORATION ELECTION
├─ Returns: 1040 + 1120-S + K-1
├─ Complexity: High
├─ CPA Setup: 2 Clients (Individual + Business) in Group
├─ SE Tax Savings: 15.3% on distributions (if income > $50k)
└─ Best if: Income > $50k consistently, wants max tax efficiency
```

---

## Implementation Checklist

Based on research findings, here's what you need to implement:

### ✓ Core Data Model
- [ ] Client/Account entity supporting "Individual" and "Business" types
- [ ] Contact entity with portal login capability
- [ ] Client Group/Linked Accounts for relating multiple clients/accounts
- [ ] Engagement entity (engagement letter, work items)

### ✓ Document Management
- [ ] Per-client/account folder structure
- [ ] Per-contact visibility toggle (can show/hide Files tab)
- [ ] Per-folder permission levels (Client View, Client Edit, Private)
- [ ] Per-document override permissions (can hide specific doc from contact)
- [ ] Folder templates for consistent structure

### ✓ Billing
- [ ] Ability to create invoice at group level (select multiple entities)
- [ ] Ability to create invoice at single entity level
- [ ] Line items track which entity they relate to
- [ ] Group invoice consolidates into one invoice with entity attribution

### ✓ Portal Experience
- [ ] Contact can switch between multiple client/account records
- [ ] Each view shows only documents authorized for that client/account
- [ ] No cross-contamination (personal docs don't leak to business view)
- [ ] Upload capability per folder/permission level

### ✓ Engagement Management
- [ ] Engagement can be tied to single entity OR group
- [ ] Work items inherit entity assignment from engagement
- [ ] Time tracking attributes time to specific entity

### ✓ Access Control
- [ ] Per-team-member client/account access
- [ ] Per-contact file visibility control
- [ ] Folder template inheritance with override capability
- [ ] Audit log of permission changes

---

## Questions Answered by This Research

### ❓ "How do CPA practice management platforms separate individual from business?"
**Answer:** Section 1 & 2 of RESEARCH file (Canopy & TaxDome detailed implementation)

### ❓ "What's the difference between a Client and a Contact?"
**Answer:** Section 7 of RESEARCH file + VISUAL GUIDE (3-tier model diagrams)

### ❓ "How does billing work when someone has multiple entities?"
**Answer:** SUMMARY file (billing examples) + VISUAL GUIDE (billing architecture diagrams)

### ❓ "Can one person see their personal AND business documents without confusion?"
**Answer:** Section 5 of RESEARCH file (nail salon workflow) + VISUAL GUIDE (portal experience)

### ❓ "What happens if a sole proprietor becomes S-Corp mid-year?"
**Answer:** SUMMARY file (decision tree) + Section 10 of RESEARCH file (unresolved questions)

### ❓ "How do we prevent accidental document leakage?"
**Answer:** Section 8-9 of RESEARCH file (DO's and DON'Ts)

---

## Specific Product References

### CANOPY
- **Official Link:** [getcanopy.com](https://www.getcanopy.com/)
- **Key Feature:** Group Billing (consolidated invoice with entity attribution)
- **Best For:** Family-based practices where billing consolidation is important
- **KB Articles Referenced:** 12+ (all linked in RESEARCH file)

### TAXDOME
- **Official Link:** [taxdome.com](https://taxdome.com/)
- **Key Feature:** Linked Accounts (one contact shared across unlimited accounts)
- **Best For:** Complex multi-entity structures (business owners + rentals + trusts)
- **KB Articles Referenced:** 8+ (all linked in RESEARCH file)

### KARBON
- **Official Link:** [karbonhq.com](https://karbonhq.com/)
- **Key Feature:** Engagements (work tied to entity level with auto-task creation)
- **Best For:** Engagement-driven firms with structured workflows
- **Help Links Referenced:** 3+ (linked in RESEARCH file)

### DRAKE TAX
- **Official Link:** [drakesoftware.com](https://www.drakesoftware.com/)
- **Key Feature:** Multi-Form Codes (Schedule C links to 1040 explicitly)
- **Best For:** Tax software (not practice management, but handles entity separation)
- **KB Articles Referenced:** 4+ (linked in RESEARCH file)

### CCH AXCESS
- **Official Link:** [wolterskluwer.com/solutions/cch-axcess](https://www.wolterskluwer.com/en/solutions/cch-axcess)
- **Key Feature:** Request Switcher (one login, switch between 1040 vs 1120-S vs other returns)
- **Best For:** Tax software with client collaboration portal
- **Documentation Referenced:** Release notes, client collaboration guide

---

## Where to Find Specific Details

| Question | File | Section |
|----------|------|---------|
| How does Canopy create a client group? | RESEARCH | 1 |
| What's TaxDome's linked accounts feature? | RESEARCH | 2 |
| How do you control file visibility per contact? | RESEARCH | 1-2 |
| What's the billing model? | RESEARCH | 1-2 + SUMMARY + VISUAL |
| How does S-Corp workflow differ from sole prop? | RESEARCH | 5 + SUMMARY |
| What are the DO's and DON'Ts? | SUMMARY | Implementation Rules |
| Show me the 3-tier model visually | VISUAL | Section 1 |
| Portal experience mockups | VISUAL | Section 4 |
| Complete workflow from intake to return | VISUAL | Section 6 |
| Tax filing decision tree | SUMMARY | Tax Entity Decision |
| Nail salon owner example | RESEARCH | Section 5 |
| Contact access model comparison | VISUAL | Section 2 |
| Document visibility matrix | VISUAL | Section 3 |

---

## For Your Product: Ella

This research is applicable if Ella is building:
- A practice management platform (like Canopy/TaxDome/Karbon)
- A client portal (like CCH Axcess)
- A tax software wrapper (like Drake/ProConnect)
- A CPA back-office system with multi-entity support

**Key Architecture Decisions You'll Face:**
1. Do you use discrete contacts (Canopy) or shared contacts (TaxDome)?
2. Do you consolidate billing at group level (Canopy) or keep per-account (TaxDome)?
3. Do you track engagements explicitly (Karbon) or implicitly?
4. What happens to portal experience when switching between entities?
5. How granular should folder permissions be (per-folder vs per-doc)?

**All of these are answered in the RESEARCH and VISUAL GUIDE files.**

---

## Using This Research Effectively

### For Architects
→ Read RESEARCH file (Sections 1-4, 6-10)
→ Reference VISUAL GUIDE (Sections 1-3, 5-7)

### For Product Managers
→ Read SUMMARY file (first pass)
→ Read RESEARCH file (Section 5 - real workflow)
→ Reference VISUAL GUIDE (Section 6 - complete workflow)

### For Developers
→ Read SUMMARY file (implementation checklist)
→ Read VISUAL GUIDE (all diagrams)
→ Reference RESEARCH file for specific features

### For Design/UX
→ Read VISUAL GUIDE (Sections 4, 6 - portal experiences)
→ Read RESEARCH file (Section 9 - UI patterns)
→ Reference SUMMARY file (Canopy vs TaxDome comparison)

### For Stakeholders/Leadership
→ Read SUMMARY file (key decision points)
→ Review VISUAL GUIDE (diagrams and workflows)
→ Reference RESEARCH file for deep dives on specific platforms

---

## Not Covered (Out of Scope)

This research does NOT include:
- Pricing/cost comparison (platforms differ widely)
- Customer support quality ratings
- Migration paths from other platforms
- Integration with accounting software (QuickBooks, etc.)
- Compliance/audit trail features
- Performance benchmarks
- User satisfaction scores

For those, reference individual platform reviews (G2, Capterra, etc.)

---

## References & Sources

All sources are cited within each file as hyperlinks:
- 30+ official knowledge base articles
- 4 YouTube demo references
- IRS documentation (Schedule C, S-Corp elections)
- Real-world case studies (nail salon owner)

**URLs are embedded in markdown format** → Click-through in your markdown viewer.

---

## Last Updated

**April 8, 2026**

Research based on:
- Platform documentation as of April 2026
- Official knowledge bases (accessed April 2026)
- Product feature comparisons
- Tax filing requirements (2026 forms)

**Note:** Platforms update features frequently. If you reference this in 6+ months, verify against current platform docs.

---

## Questions or Clarifications?

This research was designed to answer:
> "I need SPECIFIC details on how CPA practice management software implements 'full entity separation', not general overviews."

If you need additional research on:
- Specific platform features not covered
- Different use cases (non-individual clients)
- Integration scenarios
- Scaling considerations

→ Let me know, and I can expand the research.

---

**Total Research:**
- ~4,300 lines of documentation
- 6 platforms analyzed
- 3 real-world scenarios detailed
- 40+ features documented
- 7 visual architecture diagrams
