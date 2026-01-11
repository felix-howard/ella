# PROJECT MANIFESTO: ELLA

## 1. PROJECT VISION

**Ella** is not a traditional Practice Management Software (PMS). It is a **Tech-Enabled Tax Operations Platform** specifically built for a niche market: **Vietnamese-American CPAs serving the Nail Salon Industry.**

**The Mission:** To eliminate the chaos of tax data collection and processing. To transform the workflow from "Manual, Fragmented, and Slow" to "Automated, Centralized, and High-Speed."

**The Definition:** Ella acts as a **"Pre-accounting & Data Staging Factory."** It sits between the Client and the CPA's Tax Software (OltPro). Its job is to ingest raw, messy data (images) and convert it into clean, verified digital records ready for entry.

---

## 2. THE PAIN POINTS (WHY WE BUILD THIS)

### A. The Client (Nail Salon Owners & Technicians)

- **Tech-Averse & Login Fatigue:** They hate downloading apps, creating accounts, and remembering passwords. Traditional portals are a barrier to entry.
- **Spontaneous Behavior:** Their default habit is snapping a photo of a document and texting it via SMS or Zalo immediately.
- **"The Data Dump":** They send photos that are blurry, angled, and unorganized. They do not categorize files (e.g., they won't sort W-2s from 1099s).
- **Impatience:** They expect the CPA to "just handle it" once the photo is sent.

### B. The Staff (Vietnamese Outsourcing Team)

- **Data Spaghetti:** They spend 50% of their time just downloading images from texts, renaming files (e.g., `IMG_5823.JPG`), and organizing folders.
- **Communication Bottlenecks:** They cannot easily "chase" clients for missing docs because they lack a US phone number and cannot use personal accounts. They rely on the CPA to act as a middleman.
- **Cognitive Overload:** Trying to categorize files, check image quality, verify numbers, and enter data all at once leads to errors.
- **Lack of Context:** They often don't know if a client has fully submitted everything required to start the return.

### C. The CPA (Firm Owner)

- **The Middleman Trap:** The CPA is stuck forwarding messages between Client and Staff.
- **Security & Control:** Client data is scattered across personal phones and unsecure messaging apps.

---

## 3. CORE PHILOSOPHY

1.  **Dead Simple for Client:** No Passwords. No Apps. No Categorization required. Just "One Big Button" to upload, or send via SMS.
2.  **Single-Tasking for Staff:** Separate the workflow into distinct phases: **Organize** -> **Verify** -> **Enter**. Do not mix them.
3.  **Automation First:** AI must "triage" the data (Rename, Categorize, OCR) before a human ever touches it.
4.  **Quality Gate:** No data moves to the "Entry" phase until it has been explicitly verified by a human.
5.  **Context-Aware:** The system must know _who_ the client is and _what_ they are missing based on their specific tax entity type (1040 vs. 1120S).

---

## 4. THE SOLUTION & CORE FEATURES

### A. Client Side: "The Magic Bucket"

- **No-Password Access:** Authentication via OTP or Magic Links sent via SMS.
- **Smart Onboarding (Mini-Interview):** A simple 2-question triage ("Are you filing for a Business?", "Do you have kids?") to dynamically generate the correct Document Checklist.
- **The "Dump" Interface:** A single, massive "Camera/Upload" button. Clients throw all documents into one bucket.
- **SMS Gateway:** Full integration with Twilio to accept MMS images directly from clients who refuse to use the web link.

### B. System Side: "The AI Engine"

- **Auto-Routing:** The system identifies the client based on the incoming phone number (Caller ID) and routes files to the correct profile.
- **AI Vision & OCR (GPT-4o):**
  - **Classification:** Guess document types (W-2, 1099-NEC, Bank Stmts).
  - **Renaming:** Standardize filenames (e.g., `LanNguyen_2025_W2.jpg`) for easier sorting.
  - **Extraction:** Extract key values (EIN, Wages, Withholding) for the verification phase.

### C. Staff Side: "The 3-Stage Production Workspace"

The Staff interface is designed around a strict "Single-Tasking" philosophy to reduce cognitive load. It has three distinct views:

**View 1: The Tracker (Organize & Chase)**

- **Goal:** Triage and Communication. No data entry here.
- **UI:** A 3-column layout.
  - _Left:_ **New/Unassigned Images** (The "Junk" Pile).
  - _Center:_ **The Checklist** (The Target). Staff drags images from Left to Center to classify them.
  - _Right:_ **Context Aware Chat**. Staff sees missing items and clicks `[Remind]` to send SMS templates.

**View 2: The Verification Studio (The Quality Gate)**

- **Goal:** Convert Raw Images to Verified Digital Data.
- **UI:** A dedicated **Modal/Overlay** that focuses on one document at a time.
  - _Left:_ Raw Image (Viewer with Zoom/Rotate).
  - _Right:_ AI Extracted Data Form.
- **Action:** Staff compares Image vs. Data. If correct, they click **"Verify"**. This creates a "Digital Twin" of the document and locks it.

**View 3: The Assistant (Data Entry Sidebar)**

- **Goal:** Rapid Transfer to OltPro.
- **UI:** A compact sidebar that only appears when the checklist is fully verified (Green).
- **Action:** Displays only the clean data with **[Clipboard Copy]** buttons. No images, no noise.

---

## 5. THE TRAFFIC LIGHT SYSTEM (STATUS LOGIC)

The system enforces a strict "Quality Gate". Data cannot move to the Entry phase until it passes the Green light.

- 🔴 **RED (Missing):** No file exists for a required checklist item (e.g., Client is S-Corp but no W-3 found).
- 🟡 **YELLOW (Pending Verify):** A file has been uploaded (by Client) or classified (by Staff), but has **not** been checked for clarity or accuracy. **It is not yet safe to enter.**
- 🟢 **GREEN (Verified):** Staff has opened the Verification Modal, confirmed the image is legible, and validated the AI data. **Safe to enter.**
- ⚪ **GRAY (Optional):** Items not applicable to this client.

---

## 6. OPERATIONAL WORKFLOW (THE USER JOURNEY)

1.  **Initiation:** Staff creates a profile. Client receives an SMS with a Magic Link.
2.  **Collection:** Client uploads photos via Web or SMS. AI runs in the background to rename and guess document types.
3.  **Triage (View 1):**
    - Staff opens "The Tracker".
    - Staff sees "New Uploads" and drags them into the correct Checklist slots.
    - _Status changes from Red -> Yellow._
4.  **Chasing (View 1):**
    - Staff identifies remaining RED items.
    - Staff clicks `[Remind]` in the chat panel to request specific docs via SMS.
5.  **Verification (View 2):**
    - Staff clicks a YELLOW item. The **Verification Modal** opens.
    - Staff reviews the image quality (rejects if blurry) and corrects AI numbers.
    - Staff clicks `[Confirm]`.
    - _Status changes from Yellow -> Green._
6.  **Hand-off (View 3):**
    - Once all items are GREEN, the "Start Data Entry" button unlocks.
    - Staff opens "The Assistant" sidebar and copies verified values into OltPro.

---

## 7. SUPPORT ECOSYSTEM

To ensure a complete operation, the system includes:

- **Global Inbox:** To catch messages from unknown numbers or unsaved leads, allowing Staff to assign them to new or existing profiles.
- **Smart Client Creation:** A flow that triggers an immediate "Welcome/Onboarding" SMS upon profile creation.
- **Template Manager:** Allows the CPA to modify Checklist requirements and SMS Templates without changing code.

---

## 8. DATA ENTITIES & LOGIC

- **Clients:** Must support "Linked Profiles" (e.g., One user manages both a Personal 1040 Profile and a Business 1120S Profile).
- **Jobs:** Represents a Tax Year (e.g., "2025 Return").
- **Documents:** Stored contextually. Each document has two states: `Raw_Image` and `Verified_Data`.
- **Messages:** Unified inbox merging SMS, MMS, and System Alerts, viewable alongside the document workspace.

_This document serves as the foundational context for the Ella project. All code and design decisions must prioritize the specific needs of Vietnamese Staff and non-tech-savvy Clients outlined above._
