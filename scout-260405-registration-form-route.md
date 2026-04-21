# Registration Form Route Scout Report
**Date**: 2026-04-05

## Summary
Located registration form routes in **portal app** (not workspace or landing). System uses two public routes for lead registration that accept `orgSlug` and optional `campaignSlug` (called `eventSlug` in code).

---

## Route Definitions

### Route 1: With Campaign/Event Slug
**Path**: `/register/:orgSlug/:eventSlug/`
**File**: `apps/portal/src/routes/register/$orgSlug/$eventSlug/index.tsx`

- Accepts both orgSlug and eventSlug parameters
- Renders RegistrationForm component with both parameters
- Sets meta robots to `noindex, nofollow`
- Validates organization existence before rendering form

### Route 2: Without Campaign/Event Slug
**Path**: `/register/:orgSlug/`
**File**: `apps/portal/src/routes/register/$orgSlug/index.tsx`

- Accepts only orgSlug parameter
- Passes empty string for eventSlug to the same validation hook
- Allows general lead capture without campaign association

---

## Campaign Slug Validation & Usage

### Frontend Validation
**File**: `apps/portal/src/lib/use-registration-page.ts`

The `useRegistrationPage` hook handles:
1. **Organization validation**: Fetches org info via `formApi.getOrgInfo(orgSlug)`
   - Returns 404 error if org not found or inactive
   - Sets page state to 'error' on validation failure
2. **Campaign slug handling**: Passes `eventSlug` to form submission
   - eventSlug is optional (can be empty string)
   - No direct validation of campaign slug existence on frontend

### Form Data Structure
**File**: `apps/portal/src/lib/form-api.ts`

```typescript
async createLead(data: {
  firstName: string
  lastName: string
  phone: string
  email?: string
  businessName?: string
  orgSlug: string
  eventSlug?: string  // Campaign slug parameter
}): Promise<{ success: boolean; leadId?: string; error?: string }>
```

---

## API Endpoint (Backend)

### Lead Creation Endpoint
**Route**: `POST /leads`
**File**: `apps/api/src/routes/leads/index.ts`

#### Schema Validation
**File**: `apps/api/src/routes/leads/schemas.ts`

```typescript
export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[\d\s\-()]{10,15}$/),
  email: z.string().email().max(254).optional().nullable(),
  businessName: z.string().max(200).optional().nullable(),
  orgSlug: z.string().min(1).max(100),
  eventSlug: z.string().max(100).regex(/^[a-z0-9-]+$/)
    .optional()
    .or(z.literal(''))
    .transform(v => v || undefined),  // Converts empty string to undefined
})
```

#### Campaign Slug Processing (Lines 62-69)
```typescript
// Look up campaign tag from slug
let campaignTag: string | null = null
if (eventSlug) {
  const campaign = await prisma.campaign.findUnique({
    where: { slug_organizationId: { slug: eventSlug, organizationId: org.id } },
    select: { tag: true },
  })
  campaignTag = campaign?.tag || eventSlug  // Falls back to slug if campaign not found
}
```

**Key behavior**:
- Looks up campaign by slug + orgId combination
- Extracts campaign `tag` field for storage
- Falls back to eventSlug value if campaign not found in DB
- Stored in lead's `campaignTag` and `tags` array

#### Rate Limiting
- Endpoint is public (no auth required)
- Rate limited to 5 requests per key via `rateLimiter` middleware

---

## Campaign Schema & Database
**File**: `packages/db/prisma/schema.prisma`

Campaign fields:
- `id`: CUID primary key
- `slug`: String (part of unique constraint: `slug_organizationId`)
- `organizationId`: String (foreign key)
- `tag`: String (used to tag leads)
- `name`: String
- `description`: String?
- `status`: Enum (ACTIVE, ARCHIVED)
- `createdById`: String (staff who created it)

Unique constraint: `@@unique([slug, organizationId])`

---

## Integration Flow

### 1. User visits registration URL
```
/register/acme-corp/spring-2026
```

### 2. Frontend (Portal App)
- React Router matches route to `RegisterPage` component
- Extracts params: `orgSlug="acme-corp"`, `eventSlug="spring-2026"`
- Hook `useRegistrationPage()` validates org exists
- Renders `RegistrationForm` component

### 3. User submits form
Form data: firstName, lastName, phone, email?, businessName?

### 4. Frontend makes API call
```javascript
await formApi.createLead({
  firstName, lastName, phone, email, businessName,
  orgSlug: "acme-corp",
  eventSlug: "spring-2026"  // Can be empty string
})
```

### 5. Backend processes
- Validates request schema
- Looks up org by slug (fails if not active)
- Looks up campaign by slug + orgId
  - If found: uses campaign.tag
  - If not found: uses eventSlug as fallback
- Creates lead with campaignTag and tags array
- Returns 201 with leadId

---

## Error Handling

### Frontend
- **404 Org Not Found**: Shows AlertCircle error message
  - Uses i18n key: `register.errors.orgNotFound`
- **Submit Errors**: Displays in red banner
  - Extracted from API response
- **Network Errors**: Generic "Registration failed" message

### Backend
- **Org Validation** (line 50-57):
  - Returns 404 if org not found
  - Returns 404 if org.isActive = false
- **Duplicate Phone** (line 87-92):
  - P2002 (unique constraint violation) → returns 200 with "Registration received"
  - Silently succeeds to prevent enumeration attacks
- **Validation Errors**: Handled by Zod validator middleware

---

## Files List

### Frontend (Portal App)
1. `apps/portal/src/routes/register/$orgSlug/$eventSlug/index.tsx` - Route with campaign slug
2. `apps/portal/src/routes/register/$orgSlug/index.tsx` - Route without campaign slug
3. `apps/portal/src/components/register/registration-form.tsx` - Form component with validation
4. `apps/portal/src/components/register/registration-success.tsx` - Success page
5. `apps/portal/src/lib/use-registration-page.ts` - Hook managing page state & submission
6. `apps/portal/src/lib/form-api.ts` - API client for form endpoints

### Backend (API App)
7. `apps/api/src/routes/leads/index.ts` - Lead creation endpoint (POST /leads)
8. `apps/api/src/routes/leads/schemas.ts` - Zod validation schemas
9. `apps/api/src/routes/campaigns/index.ts` - Campaign CRUD endpoints
10. `apps/api/src/routes/campaigns/schemas.ts` - Campaign schemas

### Database
11. `packages/db/prisma/schema.prisma` - Campaign & Lead models

---

## Notes

- **Campaign slug validation**: Only backend validates campaign exists via unique index lookup. Frontend accepts any eventSlug value.
- **Fallback behavior**: If eventSlug doesn't match any campaign, the eventSlug value itself is used as the campaign tag.
- **No public campaign listing**: Frontend doesn't validate or list available campaigns - requires URL to be manually provided.
- **Rate limiting**: 5 requests per key (IP-based by default) to prevent spam.
- **Duplicate prevention**: Duplicate phone+org combinations silently succeed (return 200) to prevent lead enumeration attacks.
