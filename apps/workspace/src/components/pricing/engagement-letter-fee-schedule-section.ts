import type {
  PricingCalculatorInput,
  PricingCalculatorResult,
  PricingLineItem,
} from '@ella/shared/pricing'
import {
  escapeHtml,
  formatMoney,
  OUT_OF_SCOPE_HOURLY_RATE,
  renderList,
  TAX_ALLOCATION_MONTHS,
} from './engagement-letter-formatting'

export function renderFeeSchedule(
  input: PricingCalculatorInput,
  result: PricingCalculatorResult,
): string[] {
  const taxAllocation = getMonthlyTaxAllocation(result.yearlyTotal)

  return [
    '<h3>4. Fee Schedule</h3>',
    '<p><strong>4.1 One-Time Setup Fees</strong></p>',
    renderFeeGroup(result.setupDisplayItems, 'setup'),
    `<p><strong>Total Setup Fee:</strong> ${formatMoney(result.setupDisplayTotal)}</p>`,
    '<p>All setup fees are fully earned upon execution and are non-refundable to the extent permitted by law.</p>',
    '<p><strong>4.2 Monthly Recurring Fees</strong></p>',
    renderFeeGroup(result.monthlyItems, 'monthly'),
    input.payrollEmployees > 0
      ? '<p>If additional employees are added, payroll fees will increase accordingly.</p>'
      : '',
    `<p><strong>Total Monthly Billing:</strong> ${formatMoney(result.monthlyTotal)}</p>`,
    '<p><strong>4.3 Tax Filing Allocation (Months 1-6 Only)</strong></p>',
    result.yearlyItems.length > 0
      ? renderFeeGroup(result.yearlyItems, 'tax allocation')
      : '<p>No calculator tax filing allocation is included. The Firm may add annual tax preparation terms here before sending.</p>',
    result.yearlyItems.length > 0
      ? `<p><strong>Total annual tax preparation fee:</strong> ${formatMoney(result.yearlyTotal)}</p>`
      : '',
    result.yearlyItems.length > 0
      ? `<p><strong>Monthly allocation:</strong> ${formatMoney(taxAllocation)} for the first six (6) months.</p>`
      : '',
    result.yearlyItems.length > 0
      ? `<p><strong>Total Monthly Billing (Months 1-6):</strong> ${formatMoney(result.monthlyTotal + taxAllocation)}</p>`
      : '',
    `<p><strong>Total Monthly Billing (After Month 6):</strong> ${formatMoney(result.monthlyTotal)}</p>`,
    '<p><strong>4.4 Out-of-Scope Billing Rate</strong></p>',
    `<p>Out-of-Scope Services: ${formatMoney(OUT_OF_SCOPE_HOURLY_RATE)}/hour.</p>`,
  ].filter(Boolean)
}

export function getMonthlyTaxAllocation(yearlyTotal: number): number {
  return Math.round((yearlyTotal / TAX_ALLOCATION_MONTHS) * 100) / 100
}

function renderFeeGroup(items: PricingLineItem[], fallback: string): string {
  if (items.length === 0) {
    return `<p>No ${escapeHtml(fallback)} fees are included from the Calculator.</p>`
  }

  return renderList(
    items.map((item) => {
      const note = item.note ? ` ${item.note}.` : ''
      return `${item.label}: ${formatMoney(item.amount)}.${note}`
    }),
  )
}
