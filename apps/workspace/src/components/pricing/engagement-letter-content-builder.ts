import type {
  PricingCalculatorInput,
  PricingCalculatorResult,
  PricingLineItem,
} from '@ella/shared/pricing'

export interface BuildCalculatorEngagementLetterHtmlInput {
  pricingInput: PricingCalculatorInput
  pricingResult: PricingCalculatorResult
  preparedAt?: Date | string
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

const MONEY_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function buildCalculatorEngagementLetterHtml({
  pricingInput,
  pricingResult,
  preparedAt = new Date(),
}: BuildCalculatorEngagementLetterHtmlInput): string {
  const preparedDate = formatPreparedDate(preparedAt)
  const serviceItems = buildScopeItems(pricingInput, pricingResult)

  return [
    '<h2>Engagement Letter</h2>',
    `<p><strong>Prepared:</strong> ${escapeHtml(preparedDate)}</p>`,
    '<h3>1. Scope of Services</h3>',
    '<p>The Firm will provide the professional services listed below, subject to the limitations, client responsibilities, billing terms, and exclusions in this engagement letter.</p>',
    renderList(serviceItems),
    '<p>Services not expressly listed in this engagement letter are outside the scope unless separately agreed in writing by the Firm.</p>',
    '<h3>2. Monthly Recurring Services</h3>',
    '<p>The following monthly services are included in the recurring fee schedule generated from the Calculator.</p>',
    renderFeeGroup(pricingResult.monthlyItems, 'monthly'),
    `<p><strong>Monthly recurring total:</strong> ${formatMoney(pricingResult.monthlyTotal)}</p>`,
    '<h3>3. One-Time Setup and Fixed-Fee Services</h3>',
    '<p>The following setup or fixed-fee services are generated from the Calculator and are billed separately from monthly recurring services.</p>',
    renderFeeGroup(pricingResult.setupDisplayItems, 'setup'),
    `<p><strong>Setup and fixed-fee total:</strong> ${formatMoney(pricingResult.setupDisplayTotal)}</p>`,
    '<h3>4. Separate Yearly Pre-Pay Services, If Applicable</h3>',
    '<p>Separate yearly pre-pay services, if applicable: Business tax return preparation is billed separately through a yearly payment link and is not included in the monthly recurring fees or setup fees above.</p>',
    '<p>The CPA may edit this section before sending if a separate yearly payment link, due date, or service description should be added for this client.</p>',
    '<h3>5. Scope Limitations</h3>',
    '<p>Only services specifically listed in this engagement letter are included. Out-of-scope services may include cleanup or reconstruction of prior-period books, amended returns, tax notice responses, audit representation, appeals, tax planning, multi-state work, historical reconciliations, expedited work, legal advice, investment advice, HR services, or any service not expressly listed.</p>',
    '<p>Out-of-scope services may require a separate written agreement, additional fees, a retainer, or payment before work begins.</p>',
    '<h3>6. Fee Schedule</h3>',
    `<p><strong>Monthly recurring fees:</strong> ${formatMoney(pricingResult.monthlyTotal)}</p>`,
    `<p><strong>Setup and fixed fees:</strong> ${formatMoney(pricingResult.setupDisplayTotal)}</p>`,
    '<p><strong>Separate yearly pre-pay services:</strong> billed separately through a yearly payment link if applicable.</p>',
    '<h3>7. Billing and Payment</h3>',
    '<p>Setup and fixed fees are due before work begins unless the Firm agrees otherwise in writing. Monthly services are billed in advance. Separate yearly payment links must be paid before the related business tax return work begins, if applicable.</p>',
    '<p>The Firm may pause or suspend work for nonpayment. Client must maintain a valid payment method and remains responsible for all approved fees, earned fees, third-party charges, failed payment fees, late fees, and collection costs to the extent permitted by law.</p>',
    '<h3>8. Client Responsibilities</h3>',
    '<p>Client agrees to provide complete, accurate, and timely information, maintain proper records, review all deliverables before filing or use, approve filings when required, notify the Firm of material changes, and remain responsible for management and compliance decisions.</p>',
    '<p>The Firm may rely on information provided by Client without independent verification unless the Firm determines additional inquiry is necessary.</p>',
    '<h3>9. Legal Terms and Disclaimers</h3>',
    '<p>The Firm is not engaged to perform an audit, review, compilation, forensic engagement, legal representation, valuation, or assurance service. The Firm does not guarantee specific outcomes, prevention of audits, uninterrupted monitoring, tax authority results, or detection of every event.</p>',
    '<p>The Firm may use secure third-party platforms and vendors to perform the engagement. Services may depend on third-party systems, transcript availability, and timely client cooperation.</p>',
    '<p>Either party may terminate this engagement by written notice. Client remains responsible for fees earned and costs incurred through termination. Electronic signatures are valid and enforceable.</p>',
  ].join('\n')
}

function buildScopeItems(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult,
): string[] {
  const items = [`${result.tierLabel} tier bookkeeping and routine support.`]

  if (input.payrollEmployees > 0) {
    const mode =
      input.payrollMode === 'ella-staff'
        ? 'Firm-managed payroll processing'
        : 'owner-managed payroll support'
    items.push(`${mode} for ${input.payrollEmployees} employee${plural(input.payrollEmployees)}.`)
  }

  if (input.cashPlan.enabled) {
    items.push(
      `Cash Plan support for ${input.cashPlan.employees} employee${plural(input.cashPlan.employees)} and ${input.cashPlan.owners} owner${plural(input.cashPlan.owners)}.`,
    )
  }

  if (input.auditProtection) {
    items.push('Audit Detection monitoring, subject to transcript availability and third-party systems.')
  }

  if (input.salesTaxShops > 0) {
    items.push(`Sales tax monitoring for ${input.salesTaxShops} shop${plural(input.salesTaxShops)}.`)
  }

  if (result.setupDisplayItems.length > 1) {
    items.push('One-time setup or fixed-fee services listed in the fee schedule.')
  }

  return items
}

function renderFeeGroup(items: PricingLineItem[], fallback: 'monthly' | 'setup'): string {
  if (items.length === 0) {
    const label = fallback === 'monthly' ? 'monthly recurring' : 'setup or fixed-fee'
    return `<p>No ${label} services are included from the Calculator.</p>`
  }

  return renderList(
    items.map((item) => {
      const note = item.note ? ` ${item.note}.` : ''
      return `${item.label}: ${formatMoney(item.amount)}.${note}`
    }),
  )
}

function renderList(items: string[]): string {
  return `<ul>\n${items.map((item) => `  <li>${escapeHtml(item)}</li>`).join('\n')}\n</ul>`
}

function formatPreparedDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not dated'
  return DATE_FORMAT.format(date)
}

function formatMoney(amount: number): string {
  return MONEY_FORMAT.format(amount)
}

function plural(count: number): string {
  return count === 1 ? '' : 's'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
