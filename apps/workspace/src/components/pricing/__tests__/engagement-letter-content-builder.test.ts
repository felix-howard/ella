import { describe, expect, it } from 'vitest'
import { calculatePricing, createDefaultPricingInput } from '@ella/shared/pricing'
import { buildCalculatorEngagementLetterHtml } from '../engagement-letter-content-builder'

const preparedAt = new Date('2026-06-23T00:00:00.000Z')

function buildHtml(input = createDefaultPricingInput()): string {
  return buildCalculatorEngagementLetterHtml({
    pricingInput: input,
    pricingResult: calculatePricing(input),
    preparedAt,
  })
}

describe('buildCalculatorEngagementLetterHtml', () => {
  it('renders a basic payroll engagement letter with setup and monthly totals', () => {
    const input = createDefaultPricingInput()
    input.payrollEmployees = 8

    const html = buildHtml(input)

    expect(html).toContain('<h2>Engagement Letter</h2>')
    expect(html).toContain('Prepared:</strong> June 23, 2026')
    expect(html).toContain('<h3>1. Scope of Services</h3>')
    expect(html).toContain('<p><strong>B. Payroll Services</strong></p>')
    expect(html).toContain('Payroll services include processing for up to 8 employees')
    expect(html).toContain('Payroll base: $50.')
    expect(html).toContain('Payroll setup: $250.')
    expect(html).toContain('Payroll employees (8 × $7, owner-manual): $56.')
    expect(html).toContain('<strong>Total Monthly Billing:</strong> $181')
    expect(html).toContain('<strong>Total Setup Fee:</strong> $400')
    expect(html).toContain('<h3>23. Acceptance</h3>')
  })

  it('renders Cash Plan and Audit Detection scope and fees', () => {
    const input = createDefaultPricingInput()
    input.cashPlan = { enabled: true, employees: 7, owners: 1 }
    input.auditProtection = true

    const html = buildHtml(input)

    expect(html).toContain('The Cash Plan includes coverage for 1 owner at $50 per owner per month.')
    expect(html).toContain('Current pricing assumes 7 non-owner employees')
    expect(html).toContain('Audit Detection Monitoring')
    expect(html).toContain('Federal tax liens')
    expect(html).toContain('Cash Plan (7 emp × $5 + 1 owner × $50): $85.')
    expect(html).toContain('Cash Plan setup: $1,000.')
    expect(html).toContain('Audit Protection: $300.')
    expect(html).toContain('Audit Protection setup: $1,000.')
  })

  it('escapes custom monthly and one-time item labels', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'monthly-custom',
        label: 'Advisory <script>alert("x")</script>',
        amount: 125,
        quantity: 2,
        billingInterval: 'month',
      },
      {
        id: 'one-time-custom',
        label: "Cleanup & owner's notes",
        amount: 400,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    const html = buildHtml(input)

    expect(html).toContain('Advisory &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; × 2: $250.')
    expect(html).toContain('Cleanup &amp; owner&#39;s notes: $400.')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain("Cleanup & owner's notes")
  })

  it('escapes generated line item notes', () => {
    const input = createDefaultPricingInput()
    const result = calculatePricing(input)

    const html = buildCalculatorEngagementLetterHtml({
      pricingInput: input,
      pricingResult: {
        ...result,
        setupDisplayItems: [
          {
            label: 'Setup review',
            amount: 100,
            kind: 'setup',
            note: 'Requires <approval> & "signature"',
          },
        ],
        setupDisplayTotal: 100,
      },
      preparedAt,
    })

    expect(html).toContain('Requires &lt;approval&gt; &amp; &quot;signature&quot;')
    expect(html).not.toContain('Requires <approval> & "signature"')
  })

  it('renders business tax allocation over the first six months', () => {
    const input = createDefaultPricingInput()
    input.oneTime.businessTaxReturn = 1
    const result = calculatePricing(input)

    const html = buildCalculatorEngagementLetterHtml({
      pricingInput: input,
      pricingResult: result,
      preparedAt,
    })

    expect(result.yearlyItems).toHaveLength(1)
    expect(html).toContain('Business Tax Filing Allocation')
    expect(html).toContain('Business tax return pre-pay (1 tax year): $900.')
    expect(html).toContain('<strong>Total annual tax preparation fee:</strong> $900')
    expect(html).toContain('<strong>Monthly allocation:</strong> $150')
    expect(html).toContain('<strong>Total Monthly Billing (Months 1-6):</strong> $225')
    expect(html).toContain('<strong>Total Monthly Billing (After Month 6):</strong> $75')
  })

  it('does not emit unresolved bracket placeholders', () => {
    const html = buildHtml()

    expect(html).not.toMatch(/\[[^[\]\n]{2,120}\]/)
  })
})
