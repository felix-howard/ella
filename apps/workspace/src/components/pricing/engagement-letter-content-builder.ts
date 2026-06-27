import type {
  PricingCalculatorCustomBillingInterval,
  PricingCalculatorCustomItem,
  PricingCalculatorInput,
  PricingCalculatorResult,
  PricingLineItem,
} from '@ella/shared/pricing'
import {
  getMonthlyTaxAllocation,
  renderFeeSchedule,
} from './engagement-letter-fee-schedule-section'
import {
  escapeHtml,
  formatMoney,
  formatPreparedDate,
  plural,
  renderList,
} from './engagement-letter-formatting'
import {
  renderLegalTerms,
  renderScopeLimitations,
} from './engagement-letter-legal-sections'

export interface BuildCalculatorEngagementLetterHtmlInput {
  pricingInput: PricingCalculatorInput
  pricingResult: PricingCalculatorResult
  preparedAt?: Date | string
}

export function buildCalculatorEngagementLetterHtml({
  pricingInput,
  pricingResult,
  preparedAt = new Date(),
}: BuildCalculatorEngagementLetterHtmlInput): string {
  const preparedDate = formatPreparedDate(preparedAt)

  return [
    '<h2>Engagement Letter</h2>',
    `<p><strong>Prepared:</strong> ${escapeHtml(preparedDate)}</p>`,
    ...renderScopeOfServices(pricingInput, pricingResult),
    ...renderSetupServices(pricingResult.setupDisplayItems),
    ...renderScopeLimitations(),
    ...renderFeeSchedule(pricingInput, pricingResult),
    ...renderLegalTerms(),
  ].join('\n')
}

function renderScopeOfServices(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult,
): string[] {
  return [
    '<h3>1. Scope of Services</h3>',
    '<p>The Firm will provide monthly bookkeeping services strictly as described below and subject to all terms, exclusions, limitations, and fee provisions contained in this Agreement.</p>',
    '<h3>1.1 Monthly Recurring Services</h3>',
    ...renderMonthlyServiceBlocks(input, result),
  ]
}

function renderMonthlyServiceBlocks(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult,
): string[] {
  const blocks: string[] = []
  let blockIndex = 0
  const append = (title: string, paragraphs: string[], bullets?: string[]) => {
    blocks.push(...renderLetteredServiceBlock(blockIndex, title, paragraphs, bullets))
    blockIndex += 1
  }

  append('Monthly Bookkeeping', [
    'The Firm will provide routine client support, account maintenance, bookkeeping support, and general administrative servicing directly related to the services expressly described in this Agreement.',
  ])

  if (input.cashPlan.enabled) {
    append('Cash Plan', [
      `The Cash Plan includes coverage for ${input.cashPlan.owners} owner${plural(input.cashPlan.owners)} at ${formatMoney(input.rates.cashPlan.perOwnerMonthly)} per owner per month.`,
      `Current pricing assumes ${input.cashPlan.employees} non-owner employee${plural(input.cashPlan.employees)} under the Cash Plan component.`,
    ])
  }

  if (input.auditProtection) {
    append(
      'Audit Detection Monitoring',
      [
        'The Firm will provide transcript monitoring and event notification services, when available through third-party providers, including monitoring for:',
      ],
      [
        'Possible audits, including advance notice when available',
        'Federal tax liens',
        'Installment Agreement changes',
        'Offer in Compromise (OIC) activity',
        'Passport certification to the Secretary of State',
        'IRS Advance Notices (IAN), when available',
        'Other transcript activity made available by the applicable provider',
        'Monitoring services are dependent on transcript availability and third-party systems',
      ],
    )
  }

  if (input.payrollEmployees > 0) {
    append(
      'Payroll Services',
      [`Payroll services include processing for up to ${input.payrollEmployees} employee${plural(input.payrollEmployees)} and include:`],
      [
        'Payroll processing',
        'Federal Form 941 filings',
        'Federal Form 940 filing',
        'Applicable state payroll filings',
        'Year-end payroll reconciliation',
        'W-2 preparation and issuance',
      ],
    )
    blocks.push(
      '<p>Payroll fees are based on the employee count, filing frequency, and jurisdictions stated in this Agreement.</p>',
      '<p>Any of the following are out-of-scope unless separately agreed in writing:</p>',
      renderList([
        'Employee count exceeding included number',
        'Off-cycle or special payroll runs',
        'Payroll corrections or amendments',
        'Historical catch-up payroll',
        'Multi-state payroll not listed herein',
        'Compensation structure changes',
        'Additional payroll support beyond standard processing',
      ]),
    )
  }

  if (input.salesTaxShops > 0) {
    append('Sales Tax Monitoring', [
      `Sales tax monitoring includes routine monitoring for ${input.salesTaxShops} shop${plural(input.salesTaxShops)} based on the jurisdictions and filing assumptions stated in this Agreement.`,
    ])
  }

  const customMonthlyItems = getCustomItems(input, 'month')
  if (customMonthlyItems.length > 0) {
    append(
      'Additional Monthly Services',
      ['The following calculator-defined monthly services are included:'],
      customMonthlyItems.map(formatCustomItemLabel),
    )
  }

  if (result.yearlyItems.length > 0) {
    append('Business Tax Filing Allocation', [
      'Annual tax preparation includes the business tax filing services listed in the fee schedule, including the federal business return and one (1) state return unless edited before sending.',
      `Total annual tax preparation fee: ${formatMoney(result.yearlyTotal)}.`,
      `This fee will be billed over the first six (6) months of the engagement at ${formatMoney(getMonthlyTaxAllocation(result.yearlyTotal))} per month unless the Firm edits this allocation before sending.`,
    ])
  }

  return blocks
}

function renderSetupServices(items: PricingLineItem[]): string[] {
  return [
    '<h3>2. One-Time Setup Services</h3>',
    '<p>The following onboarding, setup, or fixed-fee services are included:</p>',
    items.length > 0
      ? renderList(items.map((item) => (item.note ? `${item.label} (${item.note})` : item.label)))
      : '<p>No one-time setup services are included from the Calculator.</p>',
    '<p>These services begin immediately upon execution of this Agreement.</p>',
  ]
}

function renderLetteredServiceBlock(
  index: number,
  title: string,
  paragraphs: string[],
  bullets: string[] = [],
): string[] {
  return [
    `<p><strong>${String.fromCharCode(65 + index)}. ${escapeHtml(title)}</strong></p>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    bullets.length > 0 ? renderList(bullets) : '',
  ].filter(Boolean)
}

function getCustomItems(
  input: PricingCalculatorInput,
  billingInterval: PricingCalculatorCustomBillingInterval,
): PricingCalculatorCustomItem[] {
  const customItems = Array.isArray(input.customItems) ? input.customItems : []
  return customItems.filter(
    (item) =>
      item.billingInterval === billingInterval &&
      item.quantity > 0 &&
      item.amount > 0 &&
      item.label.trim().length > 0,
  )
}

function formatCustomItemLabel(item: PricingCalculatorCustomItem): string {
  const label = item.label.trim().replace(/\s+/g, ' ')
  return item.quantity > 1 ? `${label} × ${item.quantity}` : label
}
