# Code Review — Phase 2: Sendable Quote Backend & SMS

Date: 2026-06-08 16:35 | Reviewer: code-reviewer | Scope: Phase 2 changed files only

## Scope
- `apps/api/src/services/payments/quote-send-service.ts` (NEW, 202 LOC)
- `apps/api/src/services/payments/payment-sms-templates.ts` (added quote builders/constants)
- `apps/api/src/routes/billing/index.ts` (added `POST /quotes/send`)
- `apps/api/src/routes/billing/schemas.ts` (added `sendQuoteInputSchema`)
- `apps/api/src/routes/recipients/index.ts` (NEW `GET /recipients/search`)
- `apps/api/src/app.ts` (mounted `/recipients`)

## Overall Assessment
Solid, convention-aligned implementation. Auth, org-scoping, validation-before-persist, snapshot freezing, and phone privacy all correct. Mirrors `persistence.ts` / `deposit-payment-service.ts` cleanly (DRY). Production files type-check clean. Findings are mostly correctness-of-reporting and one spec gap (missing rate limit), no Critical security holes.

---

## Critical
None.

---

## High

### H1 — `smsSent: true` is reported even when the SMS was never delivered
`quote-send-service.ts:135-146` treats a non-throwing `sendSignerSmsAndPersist()` as success. But that function (`signer-sms-delivery.ts:39-72`) **never throws** on the two most common no-delivery paths:
- No phone on the signer record → it `console.warn`s and `return`s (line 52-57).
- Twilio not configured → it persists a `twilioStatus: 'ERROR: SMS_NOT_CONFIGURED'` Message and returns normally (line 59-61).

So the try/catch in `sendQuotePayLinkSms` only catches DB/exception failures, not actual send failures. Result: the API returns `smsSent: true` to the workspace UI even though no text went out, defeating the copy-link fallback the spec explicitly requires (phase spec Risk: "Return `smsSent:false` + reason… so the UI offers copy-link fallback").

Note the service *does* pre-check `recipient.phone` at line 122, so the no-phone case is partially covered here — but only because `resolveRecipient` selected `phone`. The Twilio-not-configured and Twilio-API-rejection cases still surface as false-positive `smsSent: true`.

Fix: have `sendSignerSmsAndPersist` return a `{ delivered: boolean; reason?: string }` result instead of `void`, and map it through. Minimal alternative if you don't want to touch the shared fn signature: not possible reliably from the caller — the truth only exists inside `sendSmsOnly`. Recommend returning the Twilio result up. This also future-proofs Phase 3/4 which reuse the same delivery fn.

---

## Medium

### M1 — `GET /recipients/search` is not rate-limited (spec gap)
`recipients/index.ts:37-42` chains `authMiddleware → requireOrg → requireAdminOrManager → zValidator` but no `strictRateLimit` (or a lighter limiter). The phase spec lists "rate-limited" as a non-functional requirement, and this endpoint runs two `contains` `findMany` scans per call (unindexed `ILIKE`), so it's a cheap DoS / scraping surface for an authenticated manager. `POST /quotes/send` correctly has `strictRateLimit` (`billing/index.ts:50`).
Fix: add a rate-limit middleware to the search route (a relaxed `searchRateLimit` is fine; `strictRateLimit` may be too aggressive for type-ahead).

### M2 — Recipient search bypasses the per-staff client visibility model
`recipients/index.ts:55-64` scopes clients by `organizationId` only. The canonical client list (`routes/clients/index.ts:220`) uses `buildClientScopeFilter(user)`, which restricts non-admins to *assigned* clients. Because this route is gated by `requireAdminOrManager`, a MANAGER who would normally NOT see all org clients can now enumerate every client (name + last4 phone) via this endpoint. Likely acceptable for the "send a quote to anyone" use case, but it's an intentional-looking divergence from the established authz model and should be a conscious decision, not an accident.
Fix (if tightening desired): apply `buildClientScopeFilter(user)` for non-admins, OR document explicitly that quote-send intentionally grants org-wide client visibility to managers. Leads have no equivalent per-staff scope, so leads are fine as-is.

### M3 — Sent quotes persist with `createdByStaffId = null`
`quote-send-service.ts:80-98` sets `sentByStaffId` but omits `createdByStaffId` (the anonymous/create-link path in `persistence.ts:33` sets `createdByStaffId`). For a quote that is *created and sent* in one staff action, leaving `createdByStaffId` null means "who created this quote" is unattributable later (reporting, audit, "my quotes" filters that key on `createdByStaffId` — there's an index on it, `schema.prisma:1690`). The same staff is both creator and sender here.
Fix: also set `createdByStaffId: context.staffId`. Low risk, high audit value.

---

## Low / Informational

### L1 — Two near-identical `buildInputSnapshot` + `toPrismaJson` helpers (DRY)
`quote-send-service.ts:190-201` duplicates `persistence.ts:38-45` + the `toPrismaJson` JSON round-trip almost verbatim (the only difference is `Omit<…,'recipient'>` vs `Omit<…,'quoteNotes'>`). Acceptable for now (input types differ), but if a 3rd snapshot writer appears, extract a shared `freezeQuoteSnapshot(input)` / `toPrismaJson` util.

### L2 — `resolveOrgName` fallback `'us'` is a silent placeholder
`quote-send-service.ts:178-184` returns `'us'` when the org has no name. The SMS then reads "here's your quote from us." Harmless but slightly odd copy. A missing org name at this point is effectively impossible (org is required by `requireOrg`), so consider it defensive-only; fine to leave.

### L3 — Test fixture type error (not a production file, but in the phase's test)
`src/services/payments/__tests__/quote-send-service.test.ts:82,499` fails `tsc --noEmit`: the `buildPricingInput` helper's `payrollMode` widens to `string` instead of the `'owner-manual' | 'ella-staff'` literal, so the object isn't assignable to `CheckoutPricingInput`. Production code type-checks clean; this only breaks the test build.
Fix: add `satisfies CheckoutPricingInput` to the fixture return, or `payrollMode: 'owner-manual' as const`.

### L4 — `customerEmail`/`customerName`/`businessName` passed through unsanitized into JSON snapshot
These are zod-validated for shape/length (`schemas.ts:68-70`) which is sufficient — they're only ever stored and rendered server-side in SMS that don't interpolate them. No action; noting that they are not HTML-escaped, which is correct because they aren't rendered as HTML here. Verify Phase 3 portal page escapes them when displaying.

---

## Verified Correct (acceptance criteria)
- Auth: both routes require `authMiddleware + requireOrg + requireAdminOrManager`. `getVerifiedAuth` re-asserts org+staff non-null. (billing/index.ts:47-49, recipients/index.ts:39-41) ✅
- Org-scoping: `resolveRecipient` uses `findFirst({ where: { id, organizationId } })` → no cross-org leakage; 404 via `HTTPException(404)` when absent. Search scoped by `orgId`. ✅
- Validate-before-persist: `calculateCheckoutQuote(input.pricingInput)` runs at line 74 *before* `paymentQuote.create`; tampered/below-default rate throws `CheckoutQuoteError` → mapped to 400 at `billing/index.ts:61-63`. ✅
- Recipient XOR: `clientId`/`leadId` set mutually exclusively from `recipient.type` (lines 84-85). ✅
- PaymentQuote correctness: `id = quote.quoteId`, `payToken` unique (schema `@unique`), `status:'sent'`, `sentAt`, `sentByStaffId` persisted. `monthlyTotal * 100` is integer-safe (rates+quantities are zod `.int()`), matches `persistence.ts`. ✅
- SMS never throws the request: no-phone short-circuits to `smsSent:false/no_phone`; exceptions caught → `send_failed`. Quote persists regardless. (Caveat: H1 — non-delivery that doesn't throw is misreported as success.) ✅ (partial)
- Phone privacy: `/recipients/search` returns `phoneLast4` only via `toRecipient` (recipients/index.ts:132); full `phone` selected from DB but stripped before serialization. No full number leaves the API. ✅
- app.ts mount present and commented (app.ts:91). ✅

## Metrics
- Production files type-check: clean (`tsc --noEmit` errors are confined to the test fixture, L3).
- New endpoints: 2. New auth gaps: 0. Cross-org leak vectors: 0.

## Unresolved Questions
1. M2 — Is org-wide client visibility for MANAGERs via `/recipients/search` intentional? Confirm with product/authz owner.
2. H1 — Does the Phase 3/4 plan expect `smsSent` to reflect *actual* Twilio delivery, or just "we attempted without exception"? The spec's copy-link-fallback requirement implies the former.
3. M3 — Should `createdByStaffId` be backfilled for sent quotes, or is `sentByStaffId` the only attribution the reporting layer keys on?

---
**Status:** DONE_WITH_CONCERNS
**Summary:** Auth/org-scoping/validation/privacy all correct; main concern is `smsSent:true` misreported when Twilio is unconfigured or rejects (H1), plus a missing rate limit on the search route (M2/M1) — no Critical security holes.
