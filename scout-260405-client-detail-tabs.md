# Client Detail Page Tabs Architecture

## Overview

The client detail page is controlled by a single component that manages tab state, visibility, and content routing. The page has 8 distinct tabs organized into two groups:

**Primary Tabs (Always Visible):**
1. Overview
2. Files
3. Businesses
4. Data Entry
5. Draft Return

**Overflow Tabs (Under "More" Dropdown):**
1. Schedule C
2. Schedule E

## Tab Definition & Visibility Logic

### Location
**File:** `apps/workspace/src/routes/clients/$clientId.tsx`

### Tab Definition (Lines 69-494)

Primary tabs - always visible in main navigation:
- overview (User icon)
- files (FolderOpen icon)
- businesses (Building2 icon)
- data-entry (ClipboardList icon)
- draft-return (FileText icon)

Overflow tabs - shown under "More" dropdown:
- schedule-c (Calculator icon)
- schedule-e (Home icon)

### Tab Visibility Control (Lines 666-740)

How it works:
1. Primary tabs render in a horizontal nav with overflow-x-auto
2. "More" dropdown button sits outside the scrollable nav (prevents clipping)
3. Overflow tabs are conditionally rendered inside the dropdown menu

State Management:
- isMoreOpen - controls dropdown visibility (lines 91-92)
- activeTab - current active tab (line 76)
- isOverflowActive - tracks if an overflow tab is currently selected (line 496)

Dropdown Behavior:
- Button shows "More" text until an overflow tab is selected
- When overflow tab active, shows that tab's label instead
- ChevronDown icon rotates 180 degrees when dropdown is open
- Auto-closes on menu item selection

Dropdown Dismissal (Lines 337-354):
- Closes on outside click
- Closes on Escape key press
- Uses ref-based click detection

## Schedule C & E Form Button Handling

### "Send Schedule C Form" Button

Location: apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-empty-state.tsx

The button appears in the "Schedule C Empty State" component when no expense form has been sent yet.

Button Implementation:
- Size: lg (large)
- Icon: Send icon
- Text: t('scheduleC.sendButton') 
- Disabled state while sending
- Shows spinner + "Sending..." text during send

What happens on click:
1. Opens SendFormMessageModal for message customization
2. User can customize or use default template
3. Modal triggers useScheduleCActions.sendForm mutation

API Call Chain:
- useScheduleCActions.sendForm
- api.scheduleC.send(caseId, customMessage)
- Backend sends SMS to client with magic link
- Toast message on success/failure

### "Send Schedule E Form" Button

Location: apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-empty-state.tsx

Same pattern as Schedule C. Appears when no rental property form exists.

Message Templates:
Both modals use language-specific templates:
- Schedule C: SCHEDULE_C_TEMPLATE_VI (Vietnamese), SCHEDULE_C_TEMPLATE_EN (English)
- Schedule E: SCHEDULE_E_TEMPLATE_VI (Vietnamese), SCHEDULE_E_TEMPLATE_EN (English)
Source: apps/workspace/src/components/shared/

## Tab Visibility Logic Summary

### Rules for Tab Rendering

Overview Tab:
- Always visible
- Shows client info, notes, activity timeline

Files Tab:
- Always visible
- Shows document uploads and classification

Businesses Tab:
- Always visible
- Shows business entities and 1099-NEC forms

Data Entry Tab:
- Always visible
- Shows verified documents needing data entry

Draft Return Tab:
- Always visible
- Shows draft tax returns for sharing with clients

Schedule C Tab (Overflow):
- Appears in "More" dropdown
- Shows self-employment expense form
- Hidden under dropdown to save space

Schedule E Tab (Overflow):
- Appears in "More" dropdown
- Shows rental property income/expense form
- Hidden under dropdown to save space

### State-Based Tab Content Rendering (Lines 743-866)

Each tab condition checks if that tab is active. Schedule C and E tabs are lazy-loaded with Suspense and ErrorBoundary for code splitting.

## Action Hooks

### useScheduleCActions

File: apps/workspace/src/hooks/use-schedule-c-actions.ts

Mutations:
- sendForm(customMessage?) - Send form to client with optional custom SMS message
- lock() - Lock form to prevent edits
- unlock() - Unlock form
- resend() - Resend form link to client

API Endpoints:
- api.scheduleC.send(caseId, customMessage)
- api.scheduleC.lock(caseId)
- api.scheduleC.unlock(caseId)
- api.scheduleC.resend(caseId)

Toast Messages on Success:
- formSent: "Schedule C form sent"
- formCreatedNoSms: "Form created but SMS not sent"
- formLocked: "Form locked"
- formUnlocked: "Form unlocked"
- linkResent: "Link resent"
- linkExtendedNoSms: "Link extended but SMS not sent"

### useScheduleEActions

File: apps/workspace/src/hooks/use-schedule-e-actions.ts

Same mutations as Schedule C but with optimistic updates for lock/unlock:
- Lock mutation: immediately sets status to LOCKED in cache, rolls back on error
- Unlock mutation: immediately sets status to SUBMITTED in cache, rolls back on error

## Key Files

File | Purpose
-----|--------
apps/workspace/src/routes/clients/$clientId.tsx | Main client detail page, tab management, state control
apps/workspace/src/components/cases/tabs/schedule-c-tab/index.tsx | Schedule C tab routing logic
apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-empty-state.tsx | Send Schedule C Form button
apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-actions.tsx | Lock/unlock and form link buttons
apps/workspace/src/components/cases/tabs/schedule-e-tab/index.tsx | Schedule E tab routing logic
apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-empty-state.tsx | Send Schedule E Form button
apps/workspace/src/components/cases/tabs/schedule-e-tab/schedule-e-actions.tsx | Lock/unlock and form link buttons
apps/workspace/src/hooks/use-schedule-c-actions.ts | Schedule C mutations
apps/workspace/src/hooks/use-schedule-e-actions.ts | Schedule E mutations

