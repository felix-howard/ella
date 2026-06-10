/**
 * Built-in Engagement Letter template.
 *
 * This is editor seed content, not a PDF layout. Header and signature blocks
 * are rendered by the shared PDF components when the agreement is previewed
 * and signed.
 */
import type { NdaTemplate, TemplateSection, TemplateVars } from './types'

export const ENGAGEMENT_LETTER_TEMPLATE_VERSION = 'engagement-letter-v1'
export const ENGAGEMENT_LETTER_TEMPLATE_TITLE = 'Engagement Letter'
export const ENGAGEMENT_LETTER_TEMPLATE_SUBTITLE = 'Professional Services Engagement'

const notProvided = 'Not provided'

function v(value: string | undefined): string {
  return value?.trim() || notProvided
}

function render(vars: TemplateVars): TemplateSection[] {
  const firmAddress = v(vars.firmAddress)
  const firmPhone = v(vars.firmPhone)
  const firmEmail = v(vars.firmEmail)
  const firmWebsite = v(vars.firmWebsite)
  const clientName = v(vars.clientNameOrBusiness ?? vars.recipientFullName ?? vars.leadFullName)
  const clientContact = v(vars.clientContact)
  const clientAddress = v(vars.clientAddress)

  return [
    {
      heading: 'Engagement Letter',
      paragraphs: [
        `Date: ${vars.date}`,
        `Firm: ${vars.orgName}`,
        `Firm Address: ${firmAddress}`,
        `Firm Contact: ${firmPhone} | ${firmEmail} | ${firmWebsite}`,
        `Client: ${clientName}`,
        `Client Contact: ${clientContact}`,
        `Client Address: ${clientAddress}`,
      ],
    },
    {
      heading: '1. Purpose of Engagement',
      paragraphs: [
        `This engagement letter confirms the terms under which ${vars.orgName} ("Firm") will provide professional services to ${clientName} ("Client").`,
        'The Firm will provide the services described in this letter, subject to the assumptions, limitations, client responsibilities, fees, and terms below.',
      ],
    },
    {
      heading: '2. Scope of Services',
      paragraphs: [
        'The Firm will perform the following services:',
        '[Describe specific scope of work here.]',
      ],
      bullets: [
        '[Service item 1]',
        '[Service item 2]',
        '[Service item 3]',
      ],
      trailingParagraphs: [
        'Services outside the scope above are not included unless agreed in writing by the Firm.',
      ],
    },
    {
      heading: '3. Client Responsibilities',
      paragraphs: [
        'Client agrees to provide complete, accurate, and timely information needed for the Firm to perform the services.',
        'Client is responsible for maintaining records, substantiating income, deductions, credits, and other reported amounts, and reviewing all deliverables before filing or use.',
        'Client must respond to Firm questions and document requests by [Deadline Date].',
      ],
    },
    {
      heading: '4. Firm Responsibilities',
      paragraphs: [
        'The Firm will use professional judgment and reasonable care in performing the services described in this engagement letter.',
        'The Firm may rely on information provided by Client without independent verification unless the Firm determines additional inquiry is necessary.',
      ],
    },
    {
      heading: '5. Fees and Payment',
      paragraphs: [
        'Client agrees to pay the Firm according to the following fee arrangement:',
        'Base fee: [Amount]',
        'Monthly fee, if applicable: [Monthly Fee Amount]',
        'Rush fee, if applicable: [Rush Fee Amount]',
        'Payment deadline: [Payment Deadline]',
        'The Firm may pause work until required payments or initial payments are received.',
      ],
    },
    {
      heading: '6. Deadlines and Timing',
      paragraphs: [
        'The Firm will make reasonable efforts to complete the engagement according to agreed deadlines, but completion depends on Client providing complete information on time.',
        'Client must provide all requested documents by [Document Deadline].',
        'If Client provides information after the deadline, the Firm may require an extension, charge a rush fee, or decline to complete the work by the original target date.',
      ],
    },
    {
      heading: '7. Changes in Scope',
      paragraphs: [
        'If the Firm determines that additional work is needed beyond the scope described above, the Firm will notify Client.',
        'Additional services may require a separate written agreement, additional fees, or both.',
      ],
    },
    {
      heading: '8. Communication',
      paragraphs: [
        'Client agrees that the Firm may communicate by phone, SMS, email, client portal, and other electronic methods.',
        'Client is responsible for notifying the Firm of any changes to contact information.',
        'Primary notice details: [Notice Details].',
      ],
    },
    {
      heading: '9. Confidentiality',
      paragraphs: [
        'The Firm will keep Client information confidential except as authorized by Client, required by law, or necessary to perform the services.',
        'Client authorizes the Firm to use secure third-party technology providers as needed to perform the engagement.',
      ],
    },
    {
      heading: '10. Use of Information and Deliverables',
      paragraphs: [
        'Deliverables are prepared for Client for the specific engagement described in this letter.',
        'Client may not rely on draft deliverables, preliminary calculations, or informal discussions as final advice unless confirmed in writing by the Firm.',
      ],
    },
    {
      heading: '11. Limitations',
      paragraphs: [
        'The Firm is not responsible for penalties, interest, missed deadlines, or other consequences caused by incomplete, inaccurate, late, or withheld information from Client.',
        'Unless expressly included in the scope of services, the Firm does not provide legal, investment, insurance, or valuation advice.',
      ],
    },
    {
      heading: '12. Termination',
      paragraphs: [
        'Either party may terminate this engagement by written notice.',
        'Client remains responsible for fees earned and costs incurred through the termination date.',
        'Termination notice requirements: [Termination Notice Details].',
      ],
    },
    {
      heading: '13. Acceptance and Signature',
      paragraphs: [
        'By signing this engagement letter, Client confirms that Client has read, understands, and agrees to the terms of this engagement.',
        'The Firm is pre-signed. Client signature will complete this engagement letter.',
      ],
    },
  ]
}

export const engagementLetterTemplate: NdaTemplate = {
  version: ENGAGEMENT_LETTER_TEMPLATE_VERSION,
  title: ENGAGEMENT_LETTER_TEMPLATE_TITLE,
  subtitle: ENGAGEMENT_LETTER_TEMPLATE_SUBTITLE,
  render,
}
