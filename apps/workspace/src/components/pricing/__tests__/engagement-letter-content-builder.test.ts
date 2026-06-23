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
    expect(html).toContain('Payroll base: $50.')
    expect(html).toContain('Payroll setup: $250.')
    expect(html).toContain('Payroll employees (8 × $7, owner-manual): $56.')
    expect(html).toContain('<strong>Monthly recurring total:</strong> $181')
    expect(html).toContain('<strong>Setup and fixed-fee total:</strong> $400')
  })

  it('renders Cash Plan and Audit Detection scope and fees', () => {
    const input = createDefaultPricingInput()
    input.cashPlan = { enabled: true, employees: 7, owners: 1 }
    input.auditProtection = true

    const html = buildHtml(input)

    expect(html).toContain('Cash Plan support for 7 employees and 1 owner.')
    expect(html).toContain('Audit Detection monitoring')
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

  it('includes editable yearly pre-pay copy without adding yearly calculator totals', () => {
    const input = createDefaultPricingInput()
    input.oneTime.businessTaxReturn = 1
    const result = calculatePricing(input)

    const html = buildCalculatorEngagementLetterHtml({
      pricingInput: input,
      pricingResult: result,
      preparedAt,
    })

    expect(result.yearlyItems).toHaveLength(1)
    expect(html).toContain('Separate yearly pre-pay services, if applicable')
    expect(html).toContain(
      'Business tax return preparation is billed separately through a yearly payment link',
    )
    expect(html).toContain('billed separately through a yearly payment link if applicable')
    expect(html).not.toContain(result.yearlyItems[0].label)
  })

  it('does not emit unresolved bracket placeholders', () => {
    const html = buildHtml()

    expect(html).not.toMatch(/\[[^[\]\n]{2,120}\]/)
  })
})
