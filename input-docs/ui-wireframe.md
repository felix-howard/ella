# UI WIREFRAMES: ELLA STAFF PORTAL

**Project:** Ella
**Role:** Staff / Admin Portal
**Design System:** Desktop-First, High Density, Shadcn/UI, Tailwind CSS.
**Core Philosophy:** Single-Tasking Workflow (Sort $\to$ Verify $\to$ Enter).

---

## 1. GLOBAL LAYOUT (THE APP SHELL)

**Component Name:** `AppShell`
**Description:** The persistent frame wrapping all pages.

### Wireframe

```text
+---------------------+-------------------------------------------------------+
|  [LOGO] ELLA        |  [Breadcrumb: Clients > Lan Nguyen]      [User: Tuan] |
|                     +-------------------------------------------------------+
|  NAVIGATION         |                                                       |
|                     |                                                       |
|  [icon] Dashboard   |                                                       |
|  [icon] All Clients |           { PAGE CONTENT RENDERS HERE }               |
|  [icon] Global Inbox|                                                       |
|  [icon] Settings    |                                                       |
|                     |                                                       |
|  -----------------  |                                                       |
|  [+ New Client]     |                                                       |
+---------------------+-------------------------------------------------------+
```

Here is the single, comprehensive UI_WIREFRAMES.md file containing every screen we discussed, detailed to the pixel level for your "Vibe Coding" session with Claude.

Markdown

# UI WIREFRAMES: ELLA STAFF PORTAL

**Project:** Ella
**Role:** Staff / Admin Portal
**Design System:** Desktop-First, High Density, Shadcn/UI, Tailwind CSS.
**Core Philosophy:** Single-Tasking Workflow (Sort $\to$ Verify $\to$ Enter).

---

## 1. GLOBAL LAYOUT (THE APP SHELL)

**Component Name:** `AppShell`
**Description:** The persistent frame wrapping all pages.

### Wireframe

```text
+---------------------+-------------------------------------------------------+
|  [LOGO] ELLA        |  [Breadcrumb: Clients > Lan Nguyen]      [User: Tuan] |
|                     +-------------------------------------------------------+
|  NAVIGATION         |                                                       |
|                     |                                                       |
|  [icon] Dashboard   |                                                       |
|  [icon] All Clients |           { PAGE CONTENT RENDERS HERE }               |
|  [icon] Global Inbox|                                                       |
|  [icon] Settings    |                                                       |
|                     |                                                       |
|  -----------------  |                                                       |
|  [+ New Client]     |                                                       |
+---------------------+-------------------------------------------------------+
Functional Specs
Sidebar: Fixed width (e.g., 250px). Dark mode capable.

Header: Minimal height (e.g., 64px). Shows current context (Client Name) to prevent errors.

New Client Button: Primary CTA, always visible.
```

2. DASHBOARD (HOME)
   Route: /dashboard Goal: Operational overview. Answers "Who do I work on today?"

+-----------------------------------------------------------------------------+
| DASHBOARD |
| |
| [ 🔍 Search Client... ] [ Filter: ⚡ Needs Action ▼ ] |
| |
| +-----------------------------------------------------------------------+ |
| | CLIENT NAME | TYPE | PROGRESS | STATUS | ACTION | |
| +-----------------------------------------------------------------------+ |
| | Lan Nguyen | 1120S | [====....] | 🟡 Verify | [ Go ] | |
| | Last msg: 10m ago | 1040 | 4/10 Docs | (3 pending) | | |
| +-----------------------------------------------------------------------+ |
| | Kevin Tran | 1040 | [========] | 🟢 Ready | [Enter] | |
| | | Sch-C | 100% Verified | | | |
| +-----------------------------------------------------------------------+ |
| | Julie Pham | 1065 | [=.......] | 🔴 Missing | [Chase] | |
| | | | | | | |
| +-----------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
Interaction LogicFilter Default: "Needs Action" (Shows clients with New Uploads or Ready for Entry).Action Button: Dynamic based on status:If Status = Missing $\to$ Goes to View 1 (Tracker).If Status = Verify $\to$ Goes to View 2 (Modal).If Status = Ready $\to$ Goes to View 3 (Assistant).

3. WORKSPACE - VIEW 1: THE TRACKER (ORGANIZE & CHASE)
   Route: /clients/[id]/tracker Goal: Triage raw files and communicate requirements. Layout: 3-Column Resizable Grid.

+------------------------+---------------------------------+------------------+
| COL 1: NEW UPLOADS | COL 2: CHECKLIST (TARGET) | COL 3: CHAT |
| (Source / Draggable) | (Target / Droppable) | (Context Aware) |
| | | |
| [Filter: All/Images] | ▼ 1. INCOME | [Client Profile] |
| | | Lan Nguyen |
| [📄 IMG_5823.jpg] | [📂 W-2 Husband (Tuan)] | +1 714-555-0199 |
| Preview: W2 Form | Status: 🟡 Pending Verify | |
| Tag: AI-W2 | Action: [👁️ Inspect] | ---------------- |
| [:: Drag Handle ::] | | [Lan]: I sent |
| ⬇️ | [📂 W-2 Wife (Lan)] | the W2 via SMS. |
| ⬇️ | Status: 🟢 Verified | |
| ⬇️ | | [System]: New |
| | [📂 1099-NEC] | file uploaded. |
| [📄 Screenshot.png] | Status: 🔴 Missing | |
| Preview: Bank App | Action: [🔔 Remind] --------->| [Draft Area] |
| [:: Drag Handle ::] | | "Hi Lan, missing |
| | ▼ 2. EXPENSES | 1099-NEC..." |
| | | |
| | [📂 Bank Statement] | [Send SMS] |
| | Status: 🔴 Missing | |
+------------------------+---------------------------------+------------------+

Interaction LogicDrag & Drop: Staff drags items from Col 1 to Col 2.State Change: Dropping a file changes status from 🔴 Red $\to$ 🟡 Yellow.Chasing: Clicking [🔔 Remind] on a missing item auto-populates the Chat (Col 3) with a specific template (e.g., "We need your 1099-NEC").

4. WORKSPACE - VIEW 2: VERIFICATION MODAL
   Component: Dialog / Overlay (FullScreen) Trigger: Clicking [👁️ Inspect] on a Yellow item in View 1. Goal: Compare Image vs. AI Data (The Quality Gate).

+-----------------------------------------------------------------------------+
| VERIFYING: W-2 HUSBAND (1/3 Pending) [ Save & Next ]|
+-------------------------------------+---------------------------------------+
| IMAGE CANVAS (Left) | DATA FORM (Right) |
| | |
| Toolbar: | Document Type: [ W-2 ▼ ] |
| [Zoom +] [Zoom -] [Rotate L/R] | |
| | Employer EIN: |
| +-------------------------------+ | [ 12-3456789 ] |
| | | | |
| | (Rendered Image) | | Wages (Box 1): |
| | | | [ 45,000.00 ] |
| | "W-2 Form 2025" | | |
| | "Wage & Tax..." | | Fed Tax (Box 2): |
| | | | [ 5,000.00 ] |
| | | | |
| +-------------------------------+ | SSN (Masked): |
| | [ ***-**-1234 ] [Show] |
| Status: Good Quality | |
| | ----------------------------------- |
| ACTIONS | DECISION |
| | |
| [ 🚫 Reject Image ] | [ ✅ Confirm & Verify ] |
| Reason: [ Blurry / Cut-off ▼ ] | (Locks data, moves to next doc) |
+-------------------------------------+---------------------------------------+

Interaction Logic
AI Pre-fill: The form on the right is pre-filled by GPT-4o OCR.

Correction: Staff types over any wrong numbers.

Reject: If rejected, status goes back to 🔴 Red and prompts an SMS to client.

Confirm: Status goes to 🟢 Green, creates a Digital Doc, and auto-loads the next Yellow document.

5. WORKSPACE - VIEW 3: THE ASSISTANT (ENTRY)
   Component: Sheet (Side Drawer) or Collapsible Sidebar. Trigger: Enabled only when ALL Checklist items are 🟢 Green. Goal: Rapid Data Entry into OltPro (Copy/Paste).

+---------------------------------------+
| ELLA ASSISTANT [X Close] |
+---------------------------------------+
| STATUS: 🟢 READY FOR ENTRY |
| CLIENT: LAN NGUYEN |
| |
| ▼ 1. PERSONAL INFO |
| SSN (Husband): |
| **\*-**-1234 [📋] |
| SSN (Wife): |
| **\*-**-5678 [📋] |
| |
| ▼ 2. INCOME |
| ---------------- |
| DOC: W-2 (Husband) |
| EIN: 12-34567 [📋] |
| Wages: 45,000 [📋] |
| Tax: 5,000 [📋] |
| ---------------- |
| DOC: 1099-NEC (Wife) |
| Amount: 12,500 [📋] |
| |
| ▼ 3. EXPENSES |
| Supplies: 5,000 [📋] |
| Rent: 12,000 [📋] |
| |
| ----------------------------------- |
| [ ✅ MARK AS FILED ] |
| (Archives the job, removes from dash)|
+---------------------------------------+

Interaction Logic
Visuals: No images shown. Only high-contrast text and numbers.

Clipboard: Clicking [📋] copies value to clipboard immediately.

Mark as Filed: Changes Job Status to "Completed".

6. CLIENT CREATION MODAL
   Component: Dialog Goal: Add lead and trigger onboarding.

+------------------------------------------+
| NEW CLIENT |
+------------------------------------------+
| Full Name: [ ] |
| Phone: [ +1 ] |
| Email: [ ] |
| Tax Year: [ 2025 ▼ ] |
| |
| Profile Type (Predicted): |
| ( ) Personal Only (1040) |
| ( ) Business Owner (1120S / 1065) |
| |
| Onboarding Action: |
| [x] Send Welcome SMS with Magic Link |
| [ ] Create empty profile only |
| |
| [ Cancel ] [ Create Client ] |
+------------------------------------------+

7. GLOBAL INBOX
   Route: /inbox Goal: Handle unknown numbers and general support.

+---------------------------+-------------------------------------------------+
| INBOX (List) | CONVERSATION (Detail) |
| | |
| [ 🔍 Search... ] | +1 408-999-8888 (Unknown) |
| | |
| 🔴 +1 408-999-8888 | [User]: Hi, can you do my taxes? |
| "Hi, can you do..." | 10:30 AM |
| | |
| 🟢 Lan Nguyen | [Staff]: Sure, what is your name? |
| "Thanks!" | 10:35 AM |
| | |
| 🟢 Kevin Tran | --------------------------------------------- |
| "Sent." | SYSTEM ACTIONS: |
| | [ 👤 Create New Client from this number ] |
| | [ 🔗 Link to Existing Client ] |
+---------------------------+-------------------------------------------------+

8. TEMPLATE EDITOR (SETTINGS)
   Route: /settings/templates Goal: Manage Checklists and SMS content.

+----------------------+------------------------------------------------------+
| SETTINGS MENU | EDIT CHECKLIST: 1040 PERSONAL |
| | |
| General | Default Items (Required): |
| Team | [x] W-2 Form |
| > Templates | [x] 1099-NEC |
| | [x] Driver License |
| | [+] Add Item Row |
| | |
| | -------------------------------------------------- |
| | EDIT SMS TEMPLATE: "CHASING REMINDER" |
| | |
| | "Hi {{name}}, we are still missing your {{doc}}. |
| | Please upload it here: {{link}}" |
| | |
| | [ Save Changes ] |
+----------------------+------------------------------------------------------+
