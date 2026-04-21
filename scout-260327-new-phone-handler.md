# Scout Report: Unknown Phone Number Handling in Ella

Date: March 27, 2026
Topic: How new/unknown phone numbers are handled when they call or text Ella's number

## Summary

When an unknown phone number calls or texts Ella, the system auto-creates a placeholder client with the phone number as the display name, creates an associated tax case and conversation, then associates the incoming message with that placeholder. The client name is derived from the phone number itself (formatted as "(XXX) XXX-XXXX"). Admins can then manage/assign the client via the "Managed By" column in the client list.

## 1. Incoming SMS Handler Flow

File: apps/api/src/services/sms/webhook-handler.ts

Key Logic:
- Lines 135-226: processIncomingMessage() - Main handler for incoming SMS
- Line 165: Lookup client by phone (3 format attempts: original, E.164, normalized digits)
- Line 186: If client NOT found → Unknown caller path
- Line 200: Create placeholder conversation via createPlaceholderConversation()
- Lines 266-286: Create action record with "Số mới nhắn" (new number message)

Unknown Caller Handling (Lines 186-208):
1. Validate phone is E.164 format
2. Call createPlaceholderConversation(fromPhone, defaultOrgId)
3. Get caseId from created placeholder
4. Create message in placeholder conversation
5. Create HIGH priority action to alert staff

Known Client Handling (Lines 209-226):
- Uses existing client's latest tax case
- Upserts conversation for that case
- Creates message with NORMAL priority

## 2. Incoming Voice Call Handler

File: apps/api/src/routes/webhooks/twilio.ts

A. Incoming Call Routing (Lines 464-636)
- POST /webhooks/twilio/voice/incoming
- Lines 498-507: Lookup client by phone number
- Lines 509-549: Route logic:
  - If known client with org → Route to managing staff + org admins
  - If unknown caller → Route to all online staff
- Lines 590-614: Create placeholder conversation for unknown callers
  - Uses createPlaceholderConversation(from, defaultOrgId)
  - Creates inbound call message record

B. Voicemail Recording Handler (Lines 846-976)
- POST /webhooks/twilio/voice/voicemail-recording
- Lines 886-919: If call message exists (known caller path)
  - Updates existing message with recording URL/duration
  - Increments conversation unreadCount
- Lines 920-970: If unknown caller path
  - Validates phone format
  - Finds or creates conversation via findConversationByPhone()
  - Creates new voicemail message with recording
  - Increments unreadCount

## 3. Placeholder Conversation Creation

File: apps/api/src/services/voice/voicemail-helpers.ts

Function: createPlaceholderConversation() (Lines 132-207)

How Client Name is Set:
1. Line 137: Sanitize phone → safePhone = sanitizePhone(phone) (only + and digits)
2. Lines 140-144: Format for display:
   - Extract 10-digit US number: digits.slice(-10)
   - Format as: (813) 644-2540
   - Use as client name
3. Lines 150-151:
   - firstName: formatted phone display
   - lastName: space placeholder
   - name: formatted phone display

Transaction Flow (Lines 146-204):
1. Upsert Client (Lines 148-167):
   - Use phone as unique key
   - Create with formatted phone as name
   - Associate with organization if provided
2. Create Tax Case (Lines 174-193):
   - Tax year = current year - 1
   - Create engagement via findOrCreateEngagement()
   - Status = "INTAKE"
   - taxTypes = ["FORM_1040"] (default)
3. Create Conversation (Lines 196-201):
   - Link to tax case
   - Initialize lastMessageAt

Helper Functions:
- isValidE164Phone() (Lines 38-41): Validates format
- sanitizePhone() (Lines 49-54): Removes non-digits/plus
- findDefaultOrganizationId() (Lines 20-27): Gets first active org

## 4. Client List - "Managed By" Column

File: apps/workspace/src/components/clients/client-list-table.tsx

Display Logic (Lines 165-193):
- Admin-only column (shown only if isAdmin=true)
- Data source: client.managedBy object
- Shows staff avatar or initials + name
- Shows dash if no manager assigned

Database Schema:
File: packages/db/prisma/schema.prisma

model Client {
  managedById    String?
  managedBy      Staff?    @relation("ManagedClients",
                            fields: [managedById],
                            references: [id],
                            onDelete: SetNull)
}

## 5. Client List API - Including Managed By

File: apps/api/src/routes/clients/index.ts

GET /clients endpoint (Lines 92-172):
- Line 135-137: Includes managedBy relation
- Line 118-120: Supports managedById query filter (admin only)
- Line 98: Checks isAdmin status

Client Assignment (Line ~1250):
- Update client.managedById with staffId
- Include managedBy in response

## 6. Complete Incoming Flow Summary

SMS from Unknown Number:
1. Twilio webhook → /webhooks/twilio/sms
2. Validate signature + rate limit
3. processIncomingMessage():
   - Look up client by phone (3 format attempts)
   - NOT found → Unknown caller path
   - Create placeholder conversation
   - Create message in that conversation
   - Create HIGH priority action

Voice Call from Unknown Number:
1. Twilio webhook → /webhooks/twilio/voice/incoming
2. Validate signature + rate limit
3. Look up client by phone
4. NOT found → Unknown caller path
5. Route to all online staff
6. Create placeholder conversation
7. If voicemail → /webhooks/twilio/voice/voicemail-recording
   - Find or create conversation
   - Create voicemail message with recording
   - Increment unreadCount

Placeholder Client Created With:
- Name: Formatted phone (e.g., "(813) 644-2540")
- Phone: E.164 format (original from Twilio)
- Language: Vietnamese (VI) by default
- Tax Year: Current year - 1
- Tax Types: [FORM_1040] (default individual)
- Status: INTAKE
- Organization: Default org (if available)
- ManagedBy: NULL (initially unassigned)

## File Reference Map

SMS Webhook Handler | apps/api/src/services/sms/webhook-handler.ts | processIncomingMessage()
Voice Webhook Routes | apps/api/src/routes/webhooks/twilio.ts | Multiple POST handlers
Placeholder Creation | apps/api/src/services/voice/voicemail-helpers.ts | createPlaceholderConversation()
Client List UI | apps/workspace/src/components/clients/client-list-table.tsx | ClientRow component
Client API | apps/api/src/routes/clients/index.ts | GET /clients, assignment
Database Schema | packages/db/prisma/schema.prisma | Client, Staff, Relations

## Key Observations

1. No Manual Client Creation: Auto-creates placeholder clients atomically
2. Phone as Name: Client name = formatted phone number until manually updated
3. Organization Scoping: Placeholder inherits default org
4. Tax Year Default: Always uses previous year
5. Priority Handling: Unknown caller SMS = HIGH; known clients = NORMAL
6. Race Condition Safety: Uses upsert to handle concurrent calls
7. Managed By Initially Null: Unassigned until admin explicitly assigns

## Unresolved Questions

1. Client Name Update: What flow allows updating placeholder name from phone to actual name?
2. Default Org Fallback: What happens if findDefaultOrganizationId() returns null?
3. Conversation Uniqueness: Can one client have multiple conversations?

