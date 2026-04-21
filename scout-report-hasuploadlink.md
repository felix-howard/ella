# Scout Report: hasUploadLink & No-Upload-Link Badge Implementation

**Date**: 2026-03-27  
**Search Terms**: hasUploadLink, no-upload-link badge  
**Scope**: apps/api, apps/workspace

---

## Summary

Found complete implementation of `hasUploadLink` field and "need send upload link" badge in the client list. The feature checks if a client has active magic links and displays a visual badge when they don't have one.

---

## Files Found

### Backend (API)

#### 1. **Apps/api/src/routes/clients/index.ts** (CLIENTS LIST ENDPOINT)
- **Path**: `/c/Users/Admin/Desktop/ella/apps/api/src/routes/clients/index.ts`
- **Role**: Implements GET /clients endpoint that returns clients with hasUploadLink field
- **Key Logic** (line 279):
  ```
  hasUploadLink: latestCase ? latestCase._count.magicLinks > 0 : false,
  ```
  Checks if latest tax case has any magic links (upload links). Returns true if count > 0.

- **Context**: Part of clients list response transformation where:
  - Fetches clients with their latest tax case
  - Includes magic links count via `_count.magicLinks`
  - Maps to ClientWithActions response type

#### 2. **Apps/api/src/routes/clients/schemas.ts**
- **Path**: `/c/Users/Admin/Desktop/ella/apps/api/src/routes/clients/schemas.ts`
- **Role**: Zod schemas for validation (no hasUploadLink schema here - it's computed response field)

### Frontend (Workspace)

#### 3. **Apps/workspace/src/components/clients/client-list-table.tsx** (TABLE COMPONENT)
- **Path**: `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-list-table.tsx`
- **Role**: Main table component rendering client list with Tasks column
- **Key Implementation** (lines 229-250):
  ```jsx
  {/* Action badges column */}
  <td className="px-4 py-3 hidden md:table-cell">
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {!client.hasUploadLink && (
        <ActionBadge type="need-upload-link" />
      )}
      {actionCounts?.hasNewActivity && (
        <ActionBadge type="new-activity" />
      )}
      {actionCounts?.toVerify !== undefined && actionCounts.toVerify > 0 && (
        <ActionBadge type="verify" count={actionCounts.toVerify} />
      )}
      {actionCounts?.toEnter !== undefined && actionCounts.toEnter > 0 && (
        <ActionBadge type="entry" count={actionCounts.toEnter} />
      )}
      {actionCounts?.staleDays !== null && actionCounts?.staleDays !== undefined && (
        <ActionBadge type="stale" days={actionCounts.staleDays} />
      )}
      {computedStatus === 'ENTRY_COMPLETE' && (
        <ActionBadge type="ready" />
      )}
    </div>
  </td>
  ```
  
  Renders badge when `!client.hasUploadLink` (i.e., when client does NOT have upload link)

#### 4. **Apps/workspace/src/components/clients/action-badge.tsx** (BADGE COMPONENT)
- **Path**: `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/action-badge.tsx`
- **Role**: Reusable badge component for displaying action indicators
- **Supported Types** (line 11):
  - 'missing', 'verify', 'entry', 'stale', 'ready', 'new-activity', 'need-upload-link'
- **Badge Styling for need-upload-link** (lines 20-28):
  ```jsx
  const BADGE_DOT_COLORS: Record<BadgeType, string> = {
    missing: 'bg-red-500',
    verify: 'bg-amber-500',
    entry: 'bg-blue-500',
    stale: 'bg-slate-400 dark:bg-slate-500',
    ready: 'bg-emerald-500',
    'new-activity': 'bg-purple-500',
    'need-upload-link': 'bg-rose-500',  // Rose/pink color indicator
  } as const
  ```
  
  Uses rose/pink color (bg-rose-500) for the badge dot indicator.

#### 5. **Apps/workspace/src/lib/api-client.ts** (API TYPE DEFINITIONS)
- **Path**: `/c/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts`
- **Role**: Type definitions for API responses
- **ClientWithActions Type** (line 1079):
  ```typescript
  hasUploadLink: boolean
  ```
  Defined as part of ClientWithActions interface returned from clients list endpoint.

#### 6. **Apps/workspace/src/lib/constants.ts** (BADGE LABELS & ARIA)
- **Path**: `/c/Users/Admin/Desktop/ella/apps/workspace/src/lib/constants.ts`
- **Role**: Constants for badge labels and accessibility text
- **English Labels** (lines 328-342):
  ```typescript
  'need-upload-link': 'actionBadge.needUploadLink',  // i18n key
  'need-upload-link': 'actionBadgeAria.needUploadLink',  // aria-label key
  ```

### Internationalization

#### 7. **Apps/workspace/src/locales/en.json** (ENGLISH TRANSLATIONS)
- **Path**: `/c/Users/Admin/Desktop/ella/apps/workspace/src/locales/en.json`
- **Lines 54, 61**:
  ```json
  "actionBadge.needUploadLink": "need send upload link",
  "actionBadgeAria.needUploadLink": "Client needs upload link sent",
  ```

#### 8. **Apps/workspace/src/locales/vi.json** (VIETNAMESE TRANSLATIONS)
- **Path**: `/c/Users/Admin\Desktop\ella/apps/workspace/src/locales/vi.json`
- **Lines 54, 61**:
  ```json
  "actionBadge.needUploadLink": "cần gửi link tải lên",
  "actionBadgeAria.needUploadLink": "Khách hàng cần được gửi link tải lên",
  ```

---

## Data Flow

```
1. API Endpoint (GET /clients)
   ↓
2. Fetches clients with latest tax case
   ↓
3. Counts magic links per case (_count.magicLinks)
   ↓
4. Returns ClientWithActions with hasUploadLink: boolean
   ↓
5. Frontend receives clients data
   ↓
6. ClientListTable component renders in Tasks column
   ↓
7. Checks: !client.hasUploadLink
   ↓
8. If true: renders <ActionBadge type="need-upload-link" />
   ↓
9. ActionBadge renders rose-colored badge with label
```

---

## Column Information

**Table Column Header** (line 69 of client-list-table.tsx):
```
t('clients.tasks')  // "Tasks" in English
```

**Visibility**: Hidden on mobile (md:table-cell), visible on medium+ screens

**Badge Display Logic**:
- Shows "need send upload link" badge (rose-500) when client doesn't have active magic links
- Can coexist with other badges (new activity, verification needed, etc.)
- Flex layout with gap-1, max-width 200px for multiple badges

---

## Code Snippets

### Magic Link Count Check (API)
```typescript
// apps/api/src/routes/clients/index.ts, line 279
hasUploadLink: latestCase ? latestCase._count.magicLinks > 0 : false,
```

### Badge Rendering (Frontend)
```typescript
// apps/workspace/src/components/clients/client-list-table.tsx, lines 231-233
{!client.hasUploadLink && (
  <ActionBadge type="need-upload-link" />
)}
```

### Badge Component (Reusable)
```typescript
// apps/workspace/src/components/clients/action-badge.tsx, line 27
'need-upload-link': 'bg-rose-500',
```

---

## Related Commits

Based on recent git history, this feature was added in:
- **Commit 5062834**: "[Update] | Add hasUploadLink field to client list and show upload link badge in Tasks column"
  - API: Added source field mapping and hasUploadLink check to clients list response
  - Frontend: Added client-has-no-upload-link badge in Tasks column for clients without active magic links
  - i18n: Added translation keys for new badge type in workspace and portal apps

---

## Summary Table

| File | Type | Purpose |
|------|------|---------|
| apps/api/src/routes/clients/index.ts | Backend | Computes hasUploadLink from magic links count |
| apps/workspace/src/components/clients/client-list-table.tsx | Frontend | Renders Tasks column with badge |
| apps/workspace/src/components/clients/action-badge.tsx | Component | Badge UI component |
| apps/workspace/src/lib/api-client.ts | Types | ClientWithActions interface |
| apps/workspace/src/lib/constants.ts | Constants | Badge label keys |
| apps/workspace/src/locales/en.json | i18n | English translations |
| apps/workspace/src/locales/vi.json | i18n | Vietnamese translations |

