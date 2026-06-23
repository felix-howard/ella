import { describe, expect, it, vi } from 'vitest'
import {
  buildCalculatorEngagementLetterPayload,
  createCalculatorEngagementLetterDraft,
  submitCalculatorEngagementLetter,
} from '../calculator-engagement-letter-modal-helpers'

describe('calculator engagement letter modal helpers', () => {
  it('seeds the direct editor with calculator content and initial payment off', () => {
    const draft = createCalculatorEngagementLetterDraft('<h2>Prepared content</h2>')

    expect(draft.titleOverride).toBe('Engagement Letter')
    expect(draft.htmlOverride).toBe('<h2>Prepared content</h2>')
    expect(draft.depositEnabledOverride).toBe(false)
    expect(draft.expiryDays).toBe(30)
  })

  it('builds a normal engagement-letter agreement payload without deposit by default', () => {
    const payload = buildCalculatorEngagementLetterPayload({
      title: ' Engagement Letter ',
      contentHtml: ' <p>Fees</p> ',
      depositEnabled: false,
      depositAmount: '500.00',
      internalNote: ' ',
      expiryDays: 30,
    })

    expect(payload).toEqual({
      type: 'ENGAGEMENT_LETTER',
      title: 'Engagement Letter',
      contentHtml: '<p>Fees</p>',
      depositAmount: null,
      internalNote: undefined,
      expiryDays: 30,
    })
  })

  it('submits the normalized agreement payload through the create mutation', () => {
    const mutate = vi.fn()
    const onSuccess = vi.fn()

    submitCalculatorEngagementLetter(
      {
        title: ' Engagement Letter ',
        contentHtml: ' <p>Fees</p> ',
        depositEnabled: true,
        depositAmount: '250.00',
        internalNote: ' calculator quote ',
        expiryDays: 30,
      },
      { mutate },
      onSuccess,
    )

    expect(mutate).toHaveBeenCalledWith(
      {
        type: 'ENGAGEMENT_LETTER',
        title: 'Engagement Letter',
        contentHtml: '<p>Fees</p>',
        depositAmount: '250.00',
        internalNote: 'calculator quote',
        expiryDays: 30,
      },
      { onSuccess },
    )
  })
})
