# Phone Number Uniqueness Check - Code Locations Report

Date: 2026-04-09
Scope: All code locations where phone number uniqueness is checked during client/business creation

## CRITICAL LOCATIONS

### 1. DATABASE CONSTRAINT
File: packages/db/prisma/schema.prisma

Client Model (Line 564):
- phone String @unique
- @@index([phone]) at Line 611

This @unique constraint enforces phone number uniqueness at the database level globally (not scoped by organization).

Lead Model (Line 1424):
- @@unique([phone, organizationId])
- Phone is organization-scoped for leads only

---

### 2. BACKEND API ENDPOINTS - ERROR THROWING

A) POST /clients/ - Create Client
   File: apps/api/src/routes/clients/index.ts (Lines 1676-1681)
   Error: HTTPException(409, { message: 'A client with this phone number already exists' })
   Trigger: Prisma P2002 unique constraint violation

B) POST /clients/:id/link-business - Link Business to Individual
   File: apps/api/src/routes/clients/index.ts (Lines 1819-1824)
   Error: HTTPException(409, { message: 'A client with this phone number already exists' })
   Trigger: Prisma P2002 unique constraint violation

C) POST /leads/:id/convert - Convert Lead to Client
   File: apps/api/src/routes/leads/index.ts (Lines 340-408)
   Error: c.json({ success: false, error: 'Client with this phone already exists', existingClient }, 409)
   Trigger: Transaction-based duplicate check (before creation, not P2002)
   Key: Returns existingClient info

D) GET /leads/:id/convert-check - Duplicate Check Helper
   File: apps/api/src/routes/leads/index.ts (Lines 274-302)
   Purpose: Frontend helper to warn before conversion
   Returns: { hasDuplicate: boolean, existingClient?: {...} }

---

### 3. FRONTEND ERROR/WARNING DISPLAY

File: apps/workspace/src/components/leads/convert-lead-dialog.tsx

Line 48-51: Fetch duplicate check
- useQuery({ queryKey: ['lead-convert-check', lead.id], queryFn: () => api.leads.convertCheck(lead.id) })

Line 108-120: Display yellow warning banner if hasDuplicate=true
- Shows AlertTriangle icon
- Displays existing client name

Line 280-283: Generic error display on mutation error
- Shows t('leads.convertError') - generic error message

---

### 4. INPUT VALIDATION

File: apps/api/src/routes/clients/schemas.ts (Lines 6-9)
- Phone regex: /^\+1\d{10}$/ (E.164 US format)

File: apps/api/src/routes/form/schemas.ts (Lines 13-15)
- Phone regex: /^\+\d{7,15}$/ (E.164 international format)

---

### 5. API CLIENT TYPE DEFINITIONS

File: apps/workspace/src/lib/api-client.ts (Lines 1202-1206)

convertCheck: (id) => request<{ hasDuplicate: boolean; existingClient?: {...} }>
convert: (id, data) => request<{ clientId: string; engagementId: string }>

---

## KEY FINDINGS

1. Three separate code paths throw "phone number already exists" error:
   - POST /clients/ (generic error)
   - POST /clients/:id/link-business (generic error)
   - POST /leads/:id/convert (error with existingClient details)

2. Phone uniqueness is GLOBAL (not org-scoped):
   - Client.phone is @unique (global)
   - Lead.phone is @@unique([phone, organizationId]) (org-scoped)

3. Frontend duplicate warning (yellow banner) only shown for lead conversion:
   - Uses GET /leads/:id/convert-check to show warning
   - No similar warning for direct client creation

4. Transaction safety:
   - All client creation paths wrapped in transactions
   - POST /leads/:id/convert has explicit check inside transaction
   - POST /clients/ and /link-business rely on DB constraint (P2002 catch)

5. Error message inconsistency:
   - POST /clients/: "A client with this phone number already exists"
   - POST /leads/:id/convert: "Client with this phone already exists"
   - Frontend shows generic t('leads.convertError') regardless of cause

---

## ALL RELEVANT FILE PATHS

Database:
- C:/Users/Admin/Desktop/ella/packages/db/prisma/schema.prisma

Backend:
- C:/Users/Admin/Desktop/ella/apps/api/src/routes/clients/index.ts
- C:/Users/Admin/Desktop/ella/apps/api/src/routes/clients/schemas.ts
- C:/Users/Admin/Desktop/ella/apps/api/src/routes/leads/index.ts
- C:/Users/Admin/Desktop/ella/apps/api/src/routes/leads/schemas.ts
- C:/Users/Admin/Desktop/ella/apps/api/src/routes/form/schemas.ts

Frontend:
- C:/Users/Admin/Desktop/ella/apps/workspace/src/components/leads/convert-lead-dialog.tsx
- C:/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts
- C:/Users/Admin/Desktop/ella/apps/workspace/src/routes/leads/index.tsx
- C:/Users/Admin/Desktop/ella/apps/workspace/src/components/leads/lead-detail-drawer.tsx

