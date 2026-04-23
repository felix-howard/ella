/**
 * NDA route module.
 *
 * Exposes two Hono apps mounted from `apps/api/src/app.ts`:
 *   - ndaStaffRoute  -> mounted on `/leads`  (paths: /:leadId/nda/*)
 *   - ndaPublicRoute -> mounted on `/public/nda` (paths: /:token, /:token/sign)
 */
export { staffRoute as ndaStaffRoute } from './staff-handlers'
export { publicRoute as ndaPublicRoute } from './public-handlers'
