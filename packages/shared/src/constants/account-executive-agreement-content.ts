/**
 * Account Executive Agreement content — single source of truth.
 *
 * Rendered in two places from this one definition:
 *  - Workspace signing modal (read-before-sign display)
 *  - API server-side PDF generation (the signed artifact)
 *
 * Placeholder tokens ({{companyName}}, {{signerName}}, {{date}}) are filled at
 * render time. Bump CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION in ./terms when
 * this content changes to force re-acceptance.
 */
import { CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION } from './terms'

export interface AccountExecutiveAgreementSection {
  /** Section heading, e.g. "1. POSITION" */
  heading: string
  /** Body paragraphs, rendered in order. Bullet-like lines are separate entries. */
  paragraphs: string[]
}

export interface AccountExecutiveAgreementContent {
  version: string
  title: string
  /** Preamble sentence; contains {{companyName}}, {{signerName}}, {{date}} tokens. */
  intro: string
  sections: AccountExecutiveAgreementSection[]
}

export const ACCOUNT_EXECUTIVE_AGREEMENT_CONTENT: AccountExecutiveAgreementContent = {
  version: CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION,
  title: 'ACCOUNT EXECUTIVE AGREEMENT',
  intro:
    'This Agreement is between {{companyName}} ("Company") and {{signerName}} ("Account Executive"), effective {{date}}.',
  sections: [
    {
      heading: '1. POSITION',
      paragraphs: [
        'The Account Executive will provide account management, accounting support, audit support, and other related services assigned by the Company.',
      ],
    },
    {
      heading: '2. COMPENSATION',
      paragraphs: [
        'Base Compensation: $200 per month',
        'Account Management: $5–$30 per month per account. The rate will depend on the account’s workload, complexity, and responsibilities.',
        'Additional Project Pay: The Account Executive may receive additional pay for approved projects, including:',
        '• Timecard reconstruction',
        '• Payroll reconstruction',
        '• Employee/independent contractor payment analysis',
        '• Audit schedules and calculations',
        '• Form reconstruction',
        '• Payroll and audit form preparation',
        '• Other accounting or audit-support projects',
        'Project compensation will be agreed upon based on the scope and complexity of the project.',
      ],
    },
    {
      heading: '3. COMPANY REQUIREMENTS',
      paragraphs: [
        'The Account Executive agrees to maintain:',
        '• Reliable high-speed internet',
        '• A functional computer suitable for Company work',
        '• A quiet and professional home workspace',
        '• The ability to attend required online training and meetings',
        '• Professional and timely communication with the Company and its clients',
      ],
    },
    {
      heading: '4. COMMUNICATION REQUIREMENT',
      paragraphs: [
        'The Company’s official hours are:',
        '• Monday–Saturday',
        '• 6:00 AM–11:00 AM U.S. Time',
        '• 6:00 PM–9:00 PM U.S. Time',
        'During these hours, the Account Executive must monitor the Company’s official Slack/messenger communication channel and respond to messages within 15 minutes, except when attending a meeting/training session. If you fail to respond in a 15 minute time frame may result in a $25 deduction each time or termination.',
      ],
    },
    {
      heading: '5. CONFIDENTIALITY',
      paragraphs: [
        'The Account Executive agrees to keep all Company and client information confidential, including financial, payroll, accounting, employee, audit, and business information. Confidential information may not be shared or used for purposes unrelated to authorized Company work.',
      ],
    },
    {
      heading: '6. PROFESSIONAL PERFORMANCE',
      paragraphs: [
        'The Account Executive agrees to complete assigned work accurately, professionally, and within agreed deadlines, and to promptly communicate any issues that may affect completion of assigned work.',
      ],
    },
    {
      heading: '7. INDEPENDENT CONTRACTOR',
      paragraphs: [
        'The Account Executive is engaged as an independent contractor, not as an employee, unless otherwise required by applicable law. The Account Executive is responsible for their own applicable taxes and personal work equipment and expenses unless otherwise agreed in writing.',
      ],
    },
  ],
}

export interface AccountExecutiveAgreementFillValues {
  companyName: string
  signerName: string
  date: string
}

/** Replace {{companyName}}, {{signerName}}, {{date}} tokens in a template string. */
export function fillAccountExecutiveAgreementText(
  template: string,
  values: AccountExecutiveAgreementFillValues,
): string {
  return template
    .replaceAll('{{companyName}}', values.companyName)
    .replaceAll('{{signerName}}', values.signerName)
    .replaceAll('{{date}}', values.date)
}
