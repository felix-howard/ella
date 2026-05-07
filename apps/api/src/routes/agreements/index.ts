/**
 * Agreement route module.
 *
 * Exposes two Hono apps mounted from `apps/api/src/app.ts`:
 *   - agreementsStaffRoute  -> mounted on `/leads` (paths: /:leadId/agreements/*)
 *   - agreementsPublicRoute -> mounted on `/public/nda` (paths: /:token, /:token/sign)
 *
 * Phase 06 will add additional `/leads/:leadId/nda/...` and `/public/agreements/...`
 * aliases for backward / forward compatibility.
 */
export { staffRoute as agreementsStaffRoute } from './staff-handlers'
export { publicRoute as agreementsPublicRoute } from './public-handlers'
