/**
 * Built-in IRC 7216 consent template.
 */
import type { NdaTemplate, TemplateSection, TemplateVars } from './types'

export const CONSENT_7216_TEMPLATE_VERSION = 'consent-7216-v1'
export const CONSENT_7216_TEMPLATE_TITLE = 'Consent to Use and Disclose Tax Return Information'
export const CONSENT_7216_TEMPLATE_SUBTITLE =
  'Internal Revenue Code §7216 and Treas. Reg. §301.7216-3'

function render(vars: TemplateVars): TemplateSection[] {
  return [
    {
      heading: '1. Information Covered',
      paragraphs: [
        `This consent applies to tax return information provided to or prepared by ${vars.orgName}, including identity information, income, deductions, credits, tax forms, schedules, organizer responses, uploaded documents, messages, notes, and other information used to prepare, support, review, or administer the taxpayer's tax matter.`,
        'Tax return information may include information from current-year and prior-year returns, source documents, account records, and communications related to tax preparation, advisory, document collection, compliance, and administrative services.',
      ],
    },
    {
      heading: '2. Purpose',
      paragraphs: [
        `The taxpayer authorizes ${vars.orgName} to use and disclose tax return information as reasonably necessary to provide tax preparation, document management, client communication, compliance, billing, quality control, technology, and related administrative services.`,
        'This consent allows the firm to coordinate work, maintain records, communicate with the taxpayer, process uploaded documents, generate checklists, prepare deliverables, and operate secure systems used in the engagement.',
      ],
    },
    {
      heading: '3. Domestic Service Providers',
      paragraphs: [
        `${vars.orgName} may disclose tax return information to domestic service providers that assist the firm with tax preparation workflow, document storage, secure portals, messaging, electronic signature, payment processing, analytics, OCR, automation, and other operational services.`,
        'These providers may receive only the information reasonably needed to perform their services for the firm and are expected to maintain appropriate confidentiality and security safeguards.',
      ],
    },
    {
      heading: '4. Electronic Systems and Secure Portals',
      paragraphs: [
        'The taxpayer authorizes the firm to use electronic systems, secure portals, cloud storage, SMS, email, voice, automation, and related technology to collect, process, store, transmit, and manage tax return information.',
        'Electronic communications and systems may be used for document requests, uploads, reminders, status updates, signatures, payment links, and other engagement communications.',
      ],
    },
    {
      heading: '5. No Conditioning of Service',
      paragraphs: [
        'Federal law generally prohibits a tax return preparer from conditioning tax return preparation services on the taxpayer signing a consent to use or disclose tax return information beyond what is needed to prepare and file the tax return.',
        'The taxpayer may decline this consent. If declined, some technology-enabled services, communications, document workflows, or administrative features may be unavailable where they require the authorized use or disclosure.',
      ],
    },
    {
      heading: '6. Revocation',
      paragraphs: [
        'The taxpayer may revoke this consent by giving written notice to the firm. Revocation is effective only after the firm receives and has a reasonable opportunity to process the notice.',
        'Revocation does not affect uses or disclosures already made in reliance on this consent before revocation became effective.',
      ],
    },
    {
      heading: '7. Taxpayer Authorization',
      paragraphs: [
        'By signing this consent, the taxpayer confirms that the taxpayer has read and understands this authorization and voluntarily authorizes the uses and disclosures described above.',
        'The signature and taxpayer information entered during signing are included in the final signed PDF for audit and recordkeeping purposes.',
      ],
    },
  ]
}

export const consent7216Template: NdaTemplate = {
  version: CONSENT_7216_TEMPLATE_VERSION,
  title: CONSENT_7216_TEMPLATE_TITLE,
  subtitle: CONSENT_7216_TEMPLATE_SUBTITLE,
  render,
}
