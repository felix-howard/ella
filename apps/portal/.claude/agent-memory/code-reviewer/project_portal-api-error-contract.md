---
name: portal-api-error-contract
description: How API errors flow from Hono backend to portal ApiError, so frontend status-code mapping can be trusted
metadata:
  type: project
---

Backend (`apps/api`) throws `HTTPException(status, {message})`. There is NO explicit HTTPException branch in `middleware/error-handler.ts`; it falls through to the generic branch which emits valid JSON `{ error: 'ERROR'|'INTERNAL_ERROR', message }` with the right status. Handlers that return business errors send `c.json({ success:false, error: CODE, message }, status)` directly (e.g. 409 ALREADY_PAID/NOT_PAYABLE, 429 RATE_LIMIT_EXCEEDED).

Portal `lib/api-client.ts` `request<T>()`: special-cases 429 early → `ApiError(429,'RATE_LIMITED')`; otherwise reads `data.error` as the code and throws `ApiError(status, code, msg)`. So frontend can reliably branch on `err.status` (404/409/429/5xx).

**Why:** Proven by the agreement-sign-page flow which maps the same status codes in production.

**How to apply:** When reviewing portal pages, trust `err instanceof ApiError && err.status === N` checks — the contract holds. Verify the frontend covers every status the matching backend handler can return.
