# USER JOURNEY & WORKFLOW LOGIC: ELLA

**Purpose:** This document maps the step-by-step flow of data and user interactions within Ella.
**Actors:**

1.  **Client:** Lan Nguyen (Nail Salon Owner).
2.  **Staff:** Tuan (Data Entry Specialist).
3.  **System:** Ella AI & Backend.

---

## PHASE 1: ONBOARDING & INITIATION

**Goal:** Establish a profile and generate the correct checklist without overwhelming the client.

### Step 1.1: Staff Initiates

- **Action:** Staff clicks `[+ New Client]` in Dashboard.
- **Input:** Name: "Lan Nguyen", Phone: "+1 714...", Year: "2025".
- **System Logic:** Creates a `Client` record with status `Onboarding`.

### Step 1.2: The Welcome Hook

- **System Action:** Automatically sends an SMS via Twilio:
  > "Hi Lan, this is Tuan from VietTax. Please click here to start your 2025 tax return: ella.tax/u/xyz123"
- **Client Action:** Clicks the link (or replies "Ok").

### Step 1.3: The Mini-Interview (Triage)

- **Client Action:** Opens the link on mobile. Answers 2 questions:
  1.  "Did you own a business in 2025?" -> Selects **YES**.
  2.  "Do you have children?" -> Selects **YES**.
- **System Logic:**
  - Base Checklist: `1040 Personal`.
  - Modifier: Adds `1120S Business` items (W-3, 1120S K-1).
  - Modifier: Adds `Child Tax Credit` items (Form 8812 proof).
- **Outcome:** A personalized **Dynamic Checklist** is generated in the database.

---

## PHASE 2: COLLECTION & TRIAGE (VIEW 1)

**Goal:** Gather raw files and sort them into the correct buckets.

### Step 2.1: The Data Dump

- **Client Action:** Takes photos of 5 documents and uploads them via the Web Portal (or sends MMS).
- **System Action (Background):**
  - Receives images.
  - **AI Processing:** Rotates images, attempts to identify type (e.g., "Looks like a W-2").
  - **Renaming:** Renames file to `LanNguyen_2025_W2_guess.jpg`.
  - **Placement:** Puts files into the **"New Uploads"** column in Staff Workspace.

### Step 2.2: Staff Sorting

- **Staff Action:** Opens **View 1 (Tracker)**. Sees 5 files in "New Uploads".
- **Interaction:**
  - Drags `LanNguyen_2025_W2_guess.jpg` -> Drops into Checklist Item: `W-2 Husband`.
  - Drags `IMG_999.jpg` -> Drops into Checklist Item: `Bank Statement`.
- **State Change:**
  - Checklist Item Status updates from 🔴 **MISSING** to 🟡 **PENDING VERIFY**.

### Step 2.3: Chasing Missing Docs

- **Staff Action:** Notices `1099-NEC` item is still 🔴 **MISSING**.
- **Interaction:** Clicks the `[🔔 Remind]` button next to the item.
- **System Action:** Auto-sends SMS:
  > "Lan ơi, thiếu tờ 1099-NEC rồi. Chụp gửi lại giúp em nhé."
- **Loop:** Workflow pauses for this item until Client uploads more files.

---

## PHASE 3: VERIFICATION (VIEW 2)

**Goal:** The "Quality Gate". Convert Raw Images into Verified Digital Data.

### Step 3.1: Entering the Studio

- **Staff Action:** Clicks on the 🟡 **PENDING VERIFY** item (e.g., "W-2 Husband").
- **System Action:** Opens the **Verification Modal**.
  - **Left:** Displays the raw image.
  - **Right:** Displays the form pre-filled with OCR data (EIN: 12-34567, Wages: 45000).

### Step 3.2: The Human Check

- **Scenario A: Image is Bad**
  - Staff sees the photo is blurry.
  - Action: Clicks `[🚫 Reject]`. Selects reason: "Blurry".
  - Outcome: Item Status reverts to 🔴 **MISSING**. System prompts SMS to Client.
- **Scenario B: Data is Wrong**
  - Staff sees OCR read "$45,000" but image says "$48,000".
  - Action: Staff manually types "48000" into the form field.
- **Scenario C: All Good**
  - Staff confirms Image is clear and Data is correct.
  - Action: Clicks `[✅ Confirm]`.

### Step 3.3: Digital Transformation

- **System Logic:**
  - Saves the specific values (EIN, Wages, Taxes) into the `Digital_Docs` table.
  - Updates Item Status to 🟢 **VERIFIED**.
  - **Auto-Advance:** Immediately loads the next Yellow item (if any).

---

## PHASE 4: DATA ENTRY & HANDOFF (VIEW 3)

**Goal:** Rapid transfer to OltPro tax software.

### Step 4.1: Unlocking Entry Mode

- **Prerequisite:** All required Checklist Items must be 🟢 **VERIFIED** (or marked ⚪ **N/A**).
- **System Action:** Enables the `[🚀 Start Data Entry]` button on the Dashboard/Tracker.

### Step 4.2: The Assistant Sidebar

- **Staff Action:** Opens OltPro (external software) and clicks `[Start Data Entry]` in Ella.
- **System Action:** Ella minimizes to the **Assistant Sidebar** (View 3).
  - Hides all images.
  - Shows only clean numbers.

### Step 4.3: Copy-Paste Flow

- **Staff Action:**
  1.  Clicks `[📋]` next to "EIN" in Ella. -> Pastes into OltPro.
  2.  Clicks `[📋]` next to "Wages" in Ella. -> Pastes into OltPro.
  3.  Repeats for all fields.

### Step 4.4: Completion

- **Staff Action:** Clicks `[✅ Mark as Filed]` in Ella.
- **System Action:**
  - Updates Job Status to `Completed`.
  - Moves Client from "Active" to "Archive" in Dashboard.
  - (Optional) Sends "Thank You" SMS to Client.

---

## EDGE CASES & HANDLING

### 1. The "Unknown Number"

- **Event:** A text arrives from an unsaved phone number.
- **Flow:** Message appears in **Global Inbox**. Staff checks message content ("Hi this is Lan's husband"). Staff clicks `[Link to Profile]` -> Selects "Lan Nguyen".

### 2. Multi-Page Documents

- **Event:** Client uploads 5 photos for 1 Bank Statement (Pages 1-5).
- **Flow:** In View 1, Staff drags all 5 photos into the single `Bank Statement` bucket. In View 2, Staff verifies them as a batch.

### 3. Re-opening a File

- **Event:** Staff realizes they made a mistake after verifying.
- **Flow:** Staff goes back to View 1, clicks the 🟢 item. Modal opens (ReadOnly mode). Staff clicks `[Edit]` to unlock and modify data. Status temporarily goes back to 🟡 until saved.
