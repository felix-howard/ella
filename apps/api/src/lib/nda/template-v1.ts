/**
 * NDA Template v1 — static, versioned content.
 *
 * Placeholder fields are substituted at render time via `vars.*` access.
 * No regex, no runtime template compilation. To bump: copy this file to
 * `template-v2.ts`, change TEMPLATE_VERSION, register in `template-registry.ts`.
 *
 * NOTE: Wording is pending lawyer review before go-live (tracked in Phase 02 next-steps).
 */
import type { NdaTemplate, TemplateSection, TemplateVars } from './types'

export const TEMPLATE_VERSION = 'v1'
export const TEMPLATE_TITLE = 'Non-Disclosure Agreement'

function render(vars: TemplateVars): TemplateSection[] {
  // Prefer recipientFullName (entity-agnostic); fall back to leadFullName for any
  // pre-refactor caller that still populates only the legacy field.
  const recipientName = vars.recipientFullName || vars.leadFullName
  return [
    {
      heading: '1. Parties',
      paragraphs: [
        `This Non-Disclosure Agreement ("Agreement") is entered into on ${vars.date} between ${vars.orgName} ("Company") and ${recipientName} ("Recipient").`,
      ],
    },
    {
      heading: '2. Definition of Confidential Information',
      paragraphs: [
        'Confidential Information means any non-public business, financial, tax, or personal information disclosed by either party in connection with the evaluation or provision of professional tax services, whether disclosed orally, in writing, or electronically.',
        'Confidential Information does not include information that (a) is or becomes publicly known through no fault of the Recipient, (b) was known to the Recipient prior to disclosure, or (c) is required to be disclosed by law.',
      ],
    },
    {
      heading: '3. Obligations',
      paragraphs: [
        'The Recipient shall hold all Confidential Information in strict confidence and shall not disclose, publish, or disseminate it to any third party without the prior written consent of the Company.',
        'The Recipient shall use the Confidential Information solely for the purpose of evaluating or receiving professional services from the Company.',
      ],
    },
    {
      heading: '4. Term',
      paragraphs: [
        'This Agreement shall remain in effect for a period of three (3) years from the date of signing, or until the Confidential Information no longer qualifies as confidential, whichever is later.',
      ],
    },
    {
      heading: `5. Deposit Acknowledgement (${vars.depositAmount})`,
      paragraphs: [
        `The Recipient acknowledges that a non-refundable engagement deposit of ${vars.depositAmount} is due to secure professional services. The deposit is recorded separately and is not governed by the terms of this Agreement beyond this acknowledgement.`,
        'The deposit may be applied toward the final engagement fee at the Company\'s discretion, or forfeited in the event of non-engagement under the Company\'s published policy.',
      ],
    },
    {
      heading: '6. Governing Law',
      paragraphs: [
        'This Agreement shall be governed by and construed in accordance with the laws of the United States and the state in which the Company is registered, without regard to conflict-of-law principles.',
      ],
    },
    {
      heading: '7. Signature',
      paragraphs: [
        `By signing below, ${recipientName} acknowledges that they have read, understood, and agreed to the terms of this Agreement.`,
      ],
    },
  ]
}

export const templateV1: NdaTemplate = {
  version: TEMPLATE_VERSION,
  title: TEMPLATE_TITLE,
  render,
}
