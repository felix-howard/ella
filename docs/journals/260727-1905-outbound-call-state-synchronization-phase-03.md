---
date: "2026-07-27 19:05 Asia/Saigon"
session: "260727-1905"
topic: "outbound-call-state-synchronization-phase-03"
---

# Outbound Call State Synchronization Phase 03

## Context

Phase 03 closed the trust-boundary gap and the remaining Device race conditions left after Phase 02. The first security review landed at 6.5/10 because outbound voice still had a bad habit of trusting raw `To` and weak callback identity. That was the real bug, not a cosmetic review nit.

## What Happened

We removed raw-`To` fallback and made outbound routing depend on signed `From=client:staff_<id>` identity plus stored `messageId`, `caseId`, and `sentById` ownership checks. The child-leg status callback now carries `messageId`, while terminal webhook writes stay idempotent and prefer the correlated message over whichever callback arrived first.

On the Workspace side, `useVoiceCall` got hardening for setup, connect, and stale replacement calls. Slow `connect()` work, replayed setup, and late-arriving replacement calls now get cleaned up instead of winning by timing accident. That was the right fix because the old code was quietly optimistic in exactly the wrong places.

Validation finally matched the code: API 100 tests, Workspace 20 tests, both package type-checks, touched lint clean, and `git diff --check` all passed. The final review came back 10/10.

## Reflection

This phase was frustrating because the problem was bigger than one function. It was a tenant-boundary mistake wrapped in lifecycle races. The 6.5/10 score was deserved. Raw-To fallback looked convenient, but it was really a way to let caller-supplied data steer a privileged path. That is the sort of shortcut that comes back as a security incident.

## Decisions Made

| Decision | Why | Rejected Alternative |
| --- | --- | --- |
| Require signed staff identity plus message/case ownership | Keeps outbound calls inside the correct tenant boundary | Trust raw `To` or arbitrary caller input |
| Remove raw-To fallback | Stops unauthenticated destination guessing | Keep the fallback for compatibility |
| Treat child-leg status callbacks as durable history | Prevents racing webhooks from corrupting terminal state | Let any callback overwrite the message |
| Harden setup/connect/stale-call cleanup | Stops slow or replayed Device work from winning | Hope Twilio and React timing stay friendly |

## Next Steps

External PSTN smoke and deployment are still pending and remain separately authorized. After that, verify live callback ordering, recording persistence, and tenant-scoped rejection on real traffic.

## Unresolved Questions

None in code. The only open item is the external smoke and deployment gate.
