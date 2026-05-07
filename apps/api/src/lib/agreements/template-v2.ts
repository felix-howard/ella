/**
 * NDA Template v2 — 21-section Confidentiality and Non-Disclosure Agreement.
 *
 * Matches target PDF: "NDA ELLA.pdf". Governing law placeholders resolved from
 * TemplateVars at render time. Header (Parties block) and Section 21 (Signatures)
 * are rendered as React-PDF components, NOT in this HTML body — this module only
 * returns sections 1-20.
 *
 * Confidentiality period is hardcoded as "five (5)" per legal spec; no runtime var.
 *
 * Design note: Each section may carry paragraphs[], bullets[], ordered[], and
 * trailingParagraphs[]. The renderer serializes them in order:
 *   paragraphs → bullets/ordered → trailingParagraphs
 * This avoids duplicate heading keys while keeping list-continuation text clean.
 */
import type { NdaTemplate, TemplateSection, TemplateVars } from './types'

export const TEMPLATE_VERSION = 'v2'
export const TEMPLATE_TITLE = 'Confidentiality and Non-Disclosure Agreement'
export const TEMPLATE_SUBTITLE = 'Firm Advice, Strategy, Planning, and Work Product Protection'

/** Fallback placeholder text for preview renders where org data is absent. */
const FALLBACK_STATE = '[State]'
const FALLBACK_COUNTY = '[County, State]'

function render(vars: TemplateVars): TemplateSection[] {
  const governingState = vars.governingState?.trim() || FALLBACK_STATE
  const governingCounty = vars.governingCounty?.trim() || FALLBACK_COUNTY

  return [
    {
      heading: '1. Purpose of Agreement',
      paragraphs: [
        'The Firm may provide the Client with confidential advice, recommendations, planning ideas, business structure options, tax strategies, financial strategies, operational guidance, advisory concepts, documents, templates, reports, analyses, and other professional information.',
        "The purpose of this Agreement is to protect the Firm's confidential information, proprietary methods, intellectual property, strategies, planning concepts, and work product from unauthorized disclosure, copying, distribution, or use outside the agreed relationship.",
      ],
    },
    {
      heading: '2. Protected Firm Information',
      paragraphs: [
        'For purposes of this Agreement, "Protected Firm Information" means any non-public information, advice, materials, or work product shared by the Firm with the Client, whether spoken, written, electronic, visual, or otherwise.',
        'Protected Firm Information includes, but is not limited to:',
      ],
      bullets: [
        'Tax advice and tax planning concepts',
        'Business structure recommendations',
        'Entity planning strategies',
        'Financial strategies',
        'Accounting strategies',
        'Bookkeeping systems or workflows',
        'Operational improvement plans',
        'Advisory recommendations',
        'Compliance strategies',
        'Pricing models',
        'Planning memoranda',
        'Client-specific recommendations',
        'Meeting notes',
        'Reports',
        'Analyses',
        'Projections',
        'Tax savings strategies',
        'Internal firm methods',
        'Firm templates',
        'Checklists',
        'Workpapers',
        'Spreadsheets',
        'Presentations',
        'Training materials',
        'Written explanations',
        'Email advice',
        'Text messages or portal messages',
        'Verbal advice provided during meetings or calls',
        'Any documents or summaries created from Firm advice or strategy',
      ],
      trailingParagraphs: [
        "Protected Firm Information also includes the Firm's processes, methods, know-how, planning framework, professional judgment, and recommendations developed or communicated during discussions with the Client.",
      ],
    },
    {
      heading: '3. Client Confidentiality Obligations',
      paragraphs: ["The Client agrees that it will not, without the Firm's prior written permission:"],
      ordered: [
        'Disclose Protected Firm Information to any third party;',
        'Share Firm advice, strategies, documents, templates, or recommendations with another accountant, tax preparer, bookkeeper, consultant, advisor, attorney, financial planner, business partner, employee, contractor, vendor, or other person;',
        'Copy, reproduce, forward, publish, upload, distribute, or transmit Protected Firm Information;',
        'Use Protected Firm Information to obtain services from another provider;',
        "Use the Firm's advice, strategy, planning, or structure outside the Firm's engagement;",
        "Reverse engineer, recreate, imitate, or adapt the Firm's methods, templates, systems, or strategies;",
        "Claim ownership of the Firm's ideas, materials, templates, analysis, or work product;",
        'Allow any unauthorized person to access Protected Firm Information;',
        'Use Protected Firm Information for any purpose other than evaluating or receiving services from the Firm.',
      ],
    },
    {
      heading: '4. Limited Use Permission',
      paragraphs: [
        "The Firm grants the Client a limited, non-transferable, non-exclusive permission to use Protected Firm Information only for the Client's own internal review and only in connection with services provided by the Firm.",
        'This permission does not allow the Client to:',
      ],
      bullets: [
        'Share the information with another provider;',
        'Use the information after ending the relationship with the Firm;',
        "Implement the Firm's strategy through another firm;",
        'Reproduce Firm documents or templates;',
        'Use Firm work product for any outside business or third party;',
        'Commercialize, sell, publish, or distribute the information.',
      ],
    },
    {
      heading: '5. No Transfer of Ownership',
      paragraphs: [
        'All Protected Firm Information remains the exclusive property of the Firm.',
        "The Client does not receive any ownership rights, intellectual property rights, license rights, copyright rights, trade secret rights, or other rights in the Firm's advice, strategies, methods, documents, templates, or work product.",
        "Payment for services does not transfer ownership of the Firm's internal methods, strategies, templates, workpapers, systems, or proprietary materials.",
      ],
    },
    {
      heading: '6. Third-Party Advisors',
      paragraphs: [
        'If the Client needs to share Firm information with an attorney, CPA, lender, investor, business partner, or other professional, the Client must first obtain written permission from the Firm.',
        'The Firm may require the third party to sign a separate confidentiality agreement before any information is shared.',
        'The Client remains responsible for any unauthorized disclosure or misuse by any person who receives Protected Firm Information from the Client.',
      ],
    },
    {
      heading: '7. Exceptions',
      paragraphs: ['This Agreement does not restrict disclosure of information that:'],
      ordered: [
        'Was publicly available through no fault of the Client;',
        'Was already lawfully known by the Client before disclosure by the Firm;',
        'Is required to be disclosed by law, court order, subpoena, tax authority, or government agency;',
        'The Firm approves for disclosure in writing.',
      ],
      trailingParagraphs: [
        'If the Client is legally required to disclose Protected Firm Information, the Client must notify the Firm in writing before disclosure, unless prohibited by law.',
      ],
    },
    {
      heading: '8. No Circumvention',
      paragraphs: [
        "The Client agrees not to use the Firm's advice, planning, structure, strategy, templates, or work product to avoid hiring or paying the Firm.",
        "The Client also agrees not to take the Firm's advice, planning, structure, strategy, or work product to another service provider for implementation, completion, filing, preparation, replication, or execution without the Firm's prior written permission.",
        'This restriction applies whether the Protected Firm Information was provided during a free consultation, paid consultation, proposal meeting, planning meeting, tax advisory meeting, or active engagement.',
      ],
    },
    {
      heading: '9. Prohibited Uses',
      paragraphs: ['The Client specifically agrees not to:'],
      bullets: [
        'Take Firm recommendations to another tax preparer for implementation;',
        'Use Firm tax planning concepts with another accountant without written permission;',
        'Give Firm templates or structures to another advisor;',
        'Use Firm entity structure recommendations outside the Firm;',
        'Use Firm bookkeeping workflows with another bookkeeper;',
        'Copy Firm pricing, service models, processes, or strategies;',
        'Share Firm planning notes or reports with competitors;',
        'Use Firm strategy to self-implement without paying applicable Firm fees;',
        'Provide Firm work product to any third party for review, editing, implementation, or filing.',
      ],
    },
    {
      heading: '10. Return or Destruction of Firm Information',
      paragraphs: [
        "Upon request by the Firm, the Client must return or destroy all Protected Firm Information in the Client's possession, custody, or control.",
        'This includes printed copies, electronic files, screenshots, emails, downloads, notes, summaries, and copies stored in cloud accounts or devices.',
        'The Client may not retain copies unless the Firm provides written permission or retention is required by law.',
      ],
    },
    {
      heading: '11. Confidentiality Period',
      paragraphs: [
        "The Client's confidentiality obligations under this Agreement begin immediately upon receipt of any Protected Firm Information and continue for five (5) years from the date of disclosure.",
        'For trade secrets, proprietary methods, templates, intellectual property, and non-public firm processes, the obligations continue for as long as the information remains non-public.',
      ],
    },
    {
      heading: '12. Remedies for Breach',
      paragraphs: [
        'The Client understands that unauthorized disclosure or misuse of Protected Firm Information may cause serious financial and business harm to the Firm.',
        'If the Client breaches this Agreement, the Firm may seek all available remedies, including but not limited to:',
      ],
      bullets: [
        'Injunctive relief;',
        'Recovery of damages;',
        'Recovery of lost fees;',
        "Recovery of attorney's fees and costs, where permitted by law or ordered by a court;",
        'Disgorgement of benefits gained from unauthorized use;',
        'Termination of services;',
        'Refusal to provide future services.',
      ],
      trailingParagraphs: [
        'The Client agrees that money damages alone may not be enough to fully protect the Firm, and the Firm may seek court orders to stop unauthorized use or disclosure.',
      ],
    },
    {
      heading: '13. No Client Relationship Unless Separately Engaged',
      paragraphs: [
        'This Agreement does not create a tax, accounting, bookkeeping, advisory, legal, or consulting engagement by itself.',
        'The Firm is not obligated to provide services unless a separate engagement letter is signed and required payment is received.',
        'Any advice or discussion before a signed engagement letter is for preliminary discussion only and should not be relied upon as final professional advice.',
      ],
    },
    {
      heading: '14. No Legal, Investment, or Unauthorized Services',
      paragraphs: [
        'Unless specifically stated in a separate engagement letter, the Firm does not provide legal advice, investment advice, securities advice, or any service requiring a license the Firm does not hold.',
        'The Client should consult appropriate legal, financial, or investment professionals when needed.',
      ],
    },
    {
      heading: '15. Electronic Communications',
      paragraphs: [
        'Protected Firm Information may be shared by email, client portal, video meeting, phone, text message, documents, or other electronic methods.',
        'The Client agrees not to record meetings, calls, video conferences, or conversations with the Firm without prior written consent.',
        'The Client also agrees not to screenshot, copy, forward, or redistribute electronic communications containing Protected Firm Information without written permission.',
      ],
    },
    {
      heading: '16. Non-Waiver',
      paragraphs: [
        'If the Firm does not enforce any part of this Agreement immediately, it does not waive the right to enforce it later.',
        'Any waiver must be in writing and signed by the Firm.',
      ],
    },
    {
      heading: '17. Severability',
      paragraphs: [
        'If any part of this Agreement is found invalid or unenforceable, the remaining parts will continue in full force to the maximum extent permitted by law.',
        'The invalid provision will be modified only as necessary to make it enforceable while preserving the intent of protecting the Firm.',
      ],
    },
    {
      heading: '18. Governing Law',
      paragraphs: [
        `This Agreement shall be governed by and interpreted under the laws of the State of ${governingState}, without regard to conflict of law rules.`,
        `Any legal action related to this Agreement shall be brought in the courts located in ${governingCounty}, unless otherwise required by law.`,
      ],
    },
    {
      heading: '19. Entire Agreement',
      paragraphs: [
        'This Agreement is the entire agreement between the Firm and Client regarding confidentiality and non-disclosure of Protected Firm Information.',
        'It replaces all prior oral or written discussions regarding the confidentiality of Firm advice, planning, strategy, structure, and work product.',
        'Any changes must be in writing and signed by both Parties.',
      ],
    },
    {
      heading: '20. Client Acknowledgment',
      paragraphs: ['By signing below, the Client acknowledges and agrees that:'],
      bullets: [
        'Firm advice, planning, strategy, structure, templates, and work product are confidential;',
        'The Client may not disclose Firm information without written permission;',
        'The Client may not take Firm strategies to another provider for use or implementation;',
        'The Client may not use Firm information to avoid paying the Firm;',
        "The Firm retains ownership of its methods, documents, templates, and intellectual property;",
        'Unauthorized disclosure or use may result in legal action.',
      ],
    },
    // Section 21 (Signatures) is intentionally omitted here.
    // It is rendered as a <SignatureBlock> React-PDF component appended after the body.
  ]
}

export const templateV2: NdaTemplate = {
  version: TEMPLATE_VERSION,
  title: TEMPLATE_TITLE,
  subtitle: TEMPLATE_SUBTITLE,
  render,
}
