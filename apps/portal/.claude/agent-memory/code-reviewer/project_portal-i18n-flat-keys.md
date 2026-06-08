---
name: portal-i18n-flat-keys
description: Portal locale files use flat dotted i18n keys (not nested JSON); en.json and vi.json must stay key-for-key in sync
metadata:
  type: project
---

`apps/portal/src/locales/en.json` and `vi.json` store i18next keys as **flat dotted strings** (e.g. `"pay.error.server.title"`), not nested objects. A `t('pay.foo')` call will NOT resolve a nested `{ pay: { foo } }` object here.

**Why:** Convention chosen for this app; grepping `"pay` finds all keys directly.

**How to apply:** When reviewing i18n completeness, extract every `t('...')` literal AND every dynamic ``t(`prefix.${code}.suffix`)`` (enumerate the union the variable can take), then assert each composed key exists in BOTH en.json and vi.json. Missing key in one locale = bug (renders raw key string to user).
