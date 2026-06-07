/**
 * Payments route module.
 *
 * - publicPaymentsRoute -> mounted on `/public/pay` (paths: /:payToken, /:payToken/checkout)
 *
 * Staff-facing payment endpoints live under `routes/clients/payments-staff.ts`
 * (mounted on `/clients`), mirroring the agreements split.
 */
export { publicPaymentsRoute } from './public-payment-handlers'
