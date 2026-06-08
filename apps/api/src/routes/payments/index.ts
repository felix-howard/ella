/**
 * Payments route module.
 *
 * - publicPaymentsRoute -> mounted on `/public/pay` (paths: /:payToken, /:payToken/checkout)
 * - publicQuotesRoute   -> mounted on `/public/quote` (sent pricing-quote pay page)
 *
 * Staff-facing payment endpoints live under `routes/clients/payments-staff.ts`
 * (mounted on `/clients`), mirroring the agreements split.
 */
export { publicPaymentsRoute } from './public-payment-handlers'
export { publicQuotesRoute } from './public-quote-handlers'
