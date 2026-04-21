# Ella Codebase Architecture Scout Report

**Date**: 2026-04-05  
**Work Context**: C:\Users\Admin\Desktop\ella

## 1. Supabase Integration Status

**Finding**: No Supabase client or configuration found.  
**Search Results**: 
- Only references in `.opencode\skills\mcp-management\assets\tools.json` (unrelated metadata)
- One reference in `input-docs\clovie-system-architecture.md` (documentation file)

**Implication**: Project does NOT currently use Supabase. Uses Prisma with PostgreSQL directly via `DATABASE_URL` and `DIRECT_DATABASE_URL`.

---

## 2. Prisma Schema (Conversation & Message Models)

**Location**: `packages/db/prisma/schema.prisma`

### Conversation Model
```prisma
model Conversation {
  id        String   @id @default(cuid())
  caseId    String   @unique
  taxCase   TaxCase  @relation(fields: [caseId], references: [id], onDelete: Cascade)
  
  messages  Message[]
  
  lastMessageAt DateTime?
  unreadCount   Int      @default(0)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([lastMessageAt, createdAt])
}
```

### Message Model
```prisma
model Message {
  id             String           @id @default(cuid())
  conversationId String
  conversation   Conversation     @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  channel        MessageChannel   // SMS, PORTAL, SYSTEM, CALL
  direction      MessageDirection // INBOUND, OUTBOUND
  content        String           @db.VarChar(5000)
  
  twilioSid      String?          @unique
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  
  // Staff who sent this message
  sentById       String?
  sentBy         Staff?           @relation("SentMessages", fields: [sentById], references: [id], onDelete: SetNull)
  
  // Voice call specific fields
  callSid        String?          // Twilio Call SID
}

enum MessageChannel {
  SMS
  PORTAL
  SYSTEM
  CALL    // Voice call recordings
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}
```

**Key Facts**:
- Conversations are tied 1-to-1 to TaxCases via `caseId`
- Messages cascade delete with Conversation
- Staff can send messages (tracks sentById)
- Message content limited to 5000 chars
- Twilio integration exists (twilioSid for SMS tracking, callSid for voice)
- Portal is tracked as a channel (doc upload notifications)

---

## 3. Environment Configuration

**Location**: `apps/api/src/lib/config.ts`

**Active Env Vars (truncated for key items)**:
```
SERVER/PORT: PORT, NODE_ENV
CORS: CORS_ORIGINS
URLs: PORTAL_URL, WORKSPACE_URL
FILES: UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_FILES
AI: GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODELS
TWILIO: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, 
         TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID, 
         TWILIO_WEBHOOK_BASE_URL
CLERK: CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET
SCHEDULER: SCHEDULER_ENABLED, REMINDER_CRON (0 2 * * * = 9 PM EST)
INNGEST: INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
TAXBANDITS: TAXBANDITS_CLIENT_ID, TAXBANDITS_CLIENT_SECRET, TAXBANDITS_USER_TOKEN,
            TAXBANDITS_SANDBOX, TAXBANDITS_AWS_ACCESS_KEY, TAXBANDITS_AWS_SECRET_KEY,
            TAXBANDITS_BASE64_KEY, TAXBANDITS_S3_BUCKET
SCHEDULE_C: MILEAGE_RATE_CENTS (2024: 67 cents/mile)
```

**No Supabase env vars present** — all auth/DB via Clerk + PostgreSQL.

---

## 4. Frontend Auth (Clerk Integration)

**Location**: `apps/workspace/src/components/auth/clerk-auth-provider.tsx`

**Key Design**:
- Uses Clerk's `@clerk/clerk-react` for authentication
- Gets JWT token via `getToken()` from Clerk hook
- **Critical Pattern**: Sets `isTokenReady` state to prevent 401 race condition
  - Only renders children when Clerk is loaded AND token verified
  - On sign-in transition: waits for token before rendering (with 100ms retry)
  - On sign-out: clears React Query cache to avoid stale data
- Auto-selects first org for newly signed-in users

**Token Flow**:
1. ClerkAuthProvider sets auth token getter via `setAuthTokenGetter()`
2. Getter is called by API client before each request
3. Prevents rendering until token is available (race condition fix)

---

## 5. API Client (Token Injection)

**Location**: `apps/workspace/src/lib/api-client.ts` (90.7KB file)

**Key Features**:
- Module-level token getter pattern: `getAuthToken: (() => Promise<string | null>) | null`
- Set by ClerkAuthProvider at startup
- Applied to all requests via `setAuthTokenGetter()` 
- API_BASE_URL from env: `VITE_API_URL` (defaults to `http://localhost:3002`)
- Timeout: 30 seconds default
- Retry logic: up to 3 retries with exponential backoff (1s base delay)

**Note**: File is large (90.7KB) — contains all HTTP methods, type definitions, error handling.

---

## 6. Dependencies

**Root** (`package.json`):
- pnpm 9.15.4 workspace
- Turbo build orchestration
- TypeScript, ESLint, Prettier

**Frontend** (`apps/workspace/package.json`):
- React 19.0.0 + Vite 6.0.7
- @clerk/clerk-react 5.59.3
- @tanstack/react-router 1.94.0
- @tanstack/react-query 5.64.1
- lucide-react (icons)
- react-pdf, @react-pdf/renderer (PDF viewing/generation)
- i18next (translations)
- zustand (state management)
- @tiptap/* (rich text editor)

**NO** Supabase JS client in dependencies.

---

## 7. Deployment Configuration

**Findings**: 
- No `fly.toml` (not deployed to Fly.io)
- No `railway.json` (not on Railway)
- No `wrangler.toml` (not on Cloudflare Workers)
- No `docker-compose.yml` (no local Docker Compose)

**Implication**: Deployment strategy unknown from repo — likely configured externally or in environment-specific configs not checked in.

---

## 8. Sidebar Polling (Unread Count)

**Location**: `apps/workspace/src/components/layout/sidebar.tsx` (lines 114-123)

```typescript
const { data: unreadData } = useQuery({
  queryKey: ['unread-count'],
  queryFn: async () => {
    const response = await api.messages.listConversations({ limit: 1 })
    return response.totalUnread || 0
  },
  refetchInterval: 30000,    // ← 30 second polling
  staleTime: 10000,          // ← 10 second cache
})
const unreadCount = unreadData || 0
```

**Current Behavior**:
- Calls `api.messages.listConversations()` every 30 seconds
- Caches for 10 seconds between refetches
- Displays total unread count in sidebar

---

## Summary: No Supabase Integration

This codebase is **NOT** using Supabase. Instead:
- **Database**: PostgreSQL (direct connection via `DATABASE_URL`)
- **ORM**: Prisma (with migrations in `packages/db/prisma/migrations/`)
- **Auth**: Clerk (JWT tokens from Clerk SDK)
- **Frontend State**: React Query + Zustand
- **Real-time**: Not implemented (polling approach for unread counts)

To add Supabase Real-time for conversations would require:
1. Install `@supabase/supabase-js`
2. Create Supabase client instance in frontend
3. Subscribe to Message inserts/updates on Conversation channel
4. Replace 30-second polling with real-time listener
5. Keep PostgreSQL as primary (Supabase is just the RT layer)

---

## Key Files for Implementation

- Database schema: `/packages/db/prisma/schema.prisma`
- API client: `/apps/workspace/src/lib/api-client.ts`
- Auth provider: `/apps/workspace/src/components/auth/clerk-auth-provider.tsx`
- Sidebar: `/apps/workspace/src/components/layout/sidebar.tsx`
- Environment config: `/apps/api/src/lib/config.ts`
- Conversation/Message API: `apps/api/src/routes/` (search for messages/conversations routes)

