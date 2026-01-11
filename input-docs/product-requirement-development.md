# PRODUCT REQUIREMENT DOCUMENT (PRD)

**Project Name:** Ella
**Version:** 1.0 (MVP)
**Status:** Draft
**Target Audience:** Vietnamese-American CPAs & Nail Salon Clients

---

## 1. EXECUTIVE SUMMARY

### 1.1. Product Vision

Ella is a "Pre-accounting & Data Staging Factory" designed to streamline the tax document collection process for the niche market of Vietnamese CPAs serving the Nail Salon industry. It acts as a middleware between the Client (Raw Images) and the CPA’s Tax Software (OltPro).

### 1.2. The Core Problem

- **Clients** send unorganized, blurry photos via text message.
- **Staff** waste time downloading, renaming, and organizing files.
- **Data Entry** is prone to error due to manual typing and lack of verification.

### 1.3. Value Proposition

- **Client:** Dead simple submission (No password, SMS-based).
- **Staff:** Single-tasking workflow (Organize $\to$ Verify $\to$ Enter).
- **System:** "Quality Gate" ensures no data enters the tax software until it is verified.

---

## 2. USER PERSONAS

| Persona        | Role                      | Characteristics                    | Goals                                                        |
| :------------- | :------------------------ | :--------------------------------- | :----------------------------------------------------------- |
| **Lan Nguyen** | Nail Salon Owner (Client) | Low-tech, mobile-first, impatient. | Wants to "dump" receipts and be done. Hates logins.          |
| **Tuan**       | Staff (Data Entry)        | High volume, detail-oriented.      | Wants speed. Hates switching tabs. Needs clear instructions. |
| **Kevin**      | CPA (Admin)               | Business owner.                    | Wants oversight, security, and process standardization.      |

---

## 3. FUNCTIONAL REQUIREMENTS

### EPIC 1: CLIENT PORTAL ("THE MAGIC BUCKET")

**FR-1.1: Authentication (No-Password)**

- System must allow login via **Magic Link** sent via SMS.
- Links must expire after 7 days for security.
- **Fallback:** Clients can simply reply to the SMS with images (MMS) without clicking the link.

**FR-1.2: Smart Onboarding (Mini-Interview)**

- Upon first access, the user sees a simple form:
  - _Question 1:_ "Who are you filing for?" (Options: Personal Only / Nail Salon Business).
  - _Question 2:_ "Marital Status?" (Single / Married).
- **Output:** System dynamically generates the required **Checklist** based on answers (e.g., if Business $\to$ Add "1120S Requirements").

**FR-1.3: The Upload Bucket**

- UI must feature a prominent "Camera/Upload" button.
- Users can upload multiple files at once.
- Users **do not** need to categorize files. They just dump them into the bucket.

### EPIC 2: INTELLIGENT INGESTION (BACKEND)

**FR-2.1: Auto-Routing**

- System must identify the client based on the incoming phone number (Twilio Webhook).
- MMS images must be automatically routed to the client's "New Uploads" folder.

**FR-2.2: AI Triage (Pre-processing)**

- Upon receipt, AI (GPT-4o Vision) must process the image:
  - **Auto-Rotate:** Correct orientation.
  - **Classification:** Predict document type (W-2, 1099, Bank Stmt).
  - **Renaming:** Rename file to standard format: `{ClientName}_{Year}_{DocType}_{Index}.jpg`.

### EPIC 3: STAFF WORKSPACE - VIEW 1: THE TRACKER (ORGANIZE)

**FR-3.1: The 3-Column Layout**

- **Left Column (New Uploads):** Displays unassigned images.
- **Center Column (Checklist):** Displays required items (Income, Expenses, Identity).
- **Right Column (Chat):** Context-aware SMS history.

**FR-3.2: Drag & Drop Sorting**

- Staff must be able to drag an image from "New Uploads" to a specific Checklist Item (e.g., "W-2 Husband").
- **State Change:** Dropping a file changes Item Status from **RED** (Missing) to **YELLOW** (Pending Verify).

**FR-3.3: Contextual Chasing**

- Beside every **RED** item, display a `[🔔 Remind]` button.
- Clicking `[Remind]` populates the Chat box with a pre-written template (e.g., _"Hi Lan, we are missing your 1099-NEC. Please send it."_).

### EPIC 4: STAFF WORKSPACE - VIEW 2: VERIFICATION STUDIO (VERIFY)

**FR-4.1: The Verification Modal**

- Triggered when Staff clicks a **YELLOW** item.
- UI must be a **Modal overlay** blocking the rest of the screen to enforce focus.

**FR-4.2: Split-View Interface**

- **Left Panel:** Image Viewer with Pan, Zoom, Rotate, and Brightness controls.
- **Right Panel:** Data Extraction Form. AI pre-fills values (EIN, Wages, SSN).

**FR-4.3: Validation Actions**

- **Reject:** Staff marks image as "Blurry/Cut-off". Status reverts to **RED**. System prompts to send SMS to client.
- **Verify:** Staff confirms data matches image.
  - Action 1: Save data to database (`Verified_Data`).
  - Action 2: Change Status to **GREEN**.
  - Action 3: Auto-load the next Yellow document.

### EPIC 5: STAFF WORKSPACE - VIEW 3: THE ASSISTANT (ENTRY)

**FR-5.1: Compact Sidebar Mode**

- This view is only accessible when all Checklist Items are **GREEN**.
- UI minimizes to a vertical sidebar (width ~400px) to sit alongside OltPro.

**FR-5.2: Copy-Paste Workflow**

- Display _only_ the verified data fields (No images).
- Every field must have a `[Clipboard Icon]` button.
- Clicking the button copies the value to the system clipboard.

---

## 4. DATA LOGIC & STATES

### 4.1. The Traffic Light System (Item Status)

| Color | Status       | Definition                                | Next Action                     |
| :---- | :----------- | :---------------------------------------- | :------------------------------ |
| 🔴    | **MISSING**  | No file associated with this requirement. | Staff sends Reminder SMS.       |
| 🟡    | **PENDING**  | File uploaded/assigned, but not verified. | Staff opens Verification Modal. |
| 🟢    | **VERIFIED** | Image quality checked, Data validated.    | Ready for View 3 (Entry).       |

### 4.2. Document Entities

- **Raw Asset:** The original image file (S3 URL).
- **Digital Asset:** The JSON object containing verified values (EIN, Amount, etc.).
- _Relationship:_ One Checklist Item can hold multiple Raw Assets (e.g., 5 pages of Bank Statements) but resolves to one Digital Summary.

---

## 5. SUPPORTING FEATURES

**FR-6.1: Global Inbox**

- A centralized view of all incoming SMS.
- Ability to handle "Unknown Numbers":
  - _Option A:_ Create New Client from number.
  - _Option B:_ Link number to existing Client Profile.

**FR-6.2: Client Management**

- **Create Client:** Form to input Name, Phone, and Tax Type.
- **Auto-Welcome:** Option to send the "Magic Link" SMS immediately upon creation.

**FR-6.3: Template Editor**

- Admin (Kevin) can edit:
  - Checklist Requirements (e.g., Add "Crypto Report" for 2026).
  - SMS Chasing Templates.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

**NFR-1: Performance**

- Image upload to S3 must take < 3 seconds.
- AI Processing (OCR) should run in background (Async) and complete within 1 minute.

**NFR-2: Security**

- All data encrypted at rest and in transit.
- Magic Links must be one-time use or time-bound.
- Staff access logs must be maintained (Who verified what?).

**NFR-3: Mobile Responsiveness**

- **Client Portal:** Mobile-First design (must look like a native app).
- **Staff Portal:** Desktop optimized (not required to be mobile responsive).

---

## 7. USER INTERFACE GUIDELINES

### 7.1. View 1 (The Tracker)

- **Visual Priority:** High contrast for Red/Yellow/Green status.
- **Interaction:** Smooth Drag & Drop API (dnd-kit).

### 7.2. View 2 (The Modal)

- **Layout:** 50/50 split.
- **Focus:** Remove navigation bars/sidebars to prevent distraction.

### 7.3. View 3 (The Assistant)

- **Layout:** High density text, minimal padding.
- **Feedback:** Visual confirmation ("Copied!") when clicking buttons.

---

## 9. SUCCESS METRICS

- **Time to Verify:** Average time Staff spends in "View 2" per document.
- **Chasing Efficiency:** % of "Missing" items resolved within 24 hours of sending a Reminder.
- **Data Accuracy:** % of fields modified by Staff during verification (measures AI accuracy).
