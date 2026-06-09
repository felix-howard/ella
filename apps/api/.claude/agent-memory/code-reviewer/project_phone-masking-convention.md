---
name: phone-masking-convention
description: How client phone masking is enforced server-side (MANAGER role plan Phase 3) and which sites are intentionally raw
metadata:
  type: project
---

Client phone masking is server-enforced via `apps/api/src/lib/phone-privacy.ts` (`serializePhone(user, phone)` / `maskPhone` / `canViewFullPhone`). Full phone visible ONLY to ADMIN (`orgRole === 'org:admin' || role === 'ADMIN'` — mirrors `requireOrgAdmin` in middleware/auth.ts:169). MANAGER/STAFF/CPA get `*** *** <last4>`.

**Why:** Part of MANAGER staff-role rollout — managers gain admin-gated routes except team mgmt, but must NOT see full client phones.

**How to apply:** When reviewing any new workspace-facing route returning a client/lead/group record, ensure `phone: serializePhone(user, ...)` is applied at the response-build point and placed AFTER any `...record` spread (order matters — override must follow spread). Mask format must stay identical to `apps/workspace/src/lib/formatters.ts` (`*** *** <last4>`).

Intentionally LEFT RAW (do not flag as bugs): SMS send targets, lead-convert dedup/match + client create, voice `/caller/:phone` (echoes inbound caller), Twilio webhooks, portal/client-facing routes, contractor phones (`contractors/client-contractors.ts` — 1099 payees, open question), staff's own `phoneNumber` in team routes.
