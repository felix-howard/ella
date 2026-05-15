import type { ReactNode } from 'react'
import contractorAgreementClausesText from './contractor-agreement-document.txt?raw'
import type {
  ContractorAgreementClause,
  ContractorAgreementFirmSigner,
  ContractorAgreementOrganization,
} from './contractor-agreement-document-types'

interface ContractorAgreementDocumentProps {
  contractorName: string
  firmSigner?: ContractorAgreementFirmSigner | null
  organization?: ContractorAgreementOrganization
}

function parseClauses(text: string): ContractorAgreementClause[] {
  return text
    .trim()
    .split(/\n(?=\d+\.\s)/)
    .map((block) => {
      const [title, ...lines] = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      return { title, lines }
    })
}

const clauses = parseClauses(contractorAgreementClausesText)

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatAddress(organization?: ContractorAgreementOrganization) {
  const cityStateZip = [
    organization?.city,
    [organization?.state, organization?.zip].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  return [organization?.address, cityStateZip].filter(Boolean).join(', ')
}

function getClauseLines(clause: ContractorAgreementClause, governingLaw: string) {
  if (!clause.title.startsWith('26.')) return clause.lines
  if (!governingLaw) return clause.lines

  return [
    `This Agreement shall be governed by the laws of ${governingLaw}, without regard to conflict-of-law rules.`,
    `Any lawsuit, claim, or legal proceeding shall be brought exclusively in the state or federal courts located in ${governingLaw}, unless otherwise required by law.`,
  ]
}

function renderBlocks(lines: string[]) {
  const blocks: ReactNode[] = []
  let listItems: ReactNode[] = []

  const flushList = () => {
    if (!listItems.length) return
    blocks.push(
      <ol key={`list-${blocks.length}`} className="list-decimal space-y-2 pl-5">
        {listItems}
      </ol>
    )
    listItems = []
  }

  lines.forEach((line) => {
    const listMatch = line.match(/^(\d+)\.\s(.+)/)
    if (listMatch) {
      listItems.push(
        <li key={line} value={Number(listMatch[1])} className="pl-1">
          {listMatch[2]}
        </li>
      )
      return
    }

    flushList()
    blocks.push(
      <p key={line} className="mt-2 first:mt-0">
        {line}
      </p>
    )
  })

  flushList()
  return blocks
}

export function ContractorAgreementDocument({
  contractorName,
  firmSigner,
  organization,
}: ContractorAgreementDocumentProps) {
  const organizationName = organization?.name?.trim() || 'Ella Tax Services LLC'
  const effectiveDate = formatDate(new Date())
  const address = formatAddress(organization)
  const governingLaw = [organization?.governingState, organization?.governingCounty]
    .filter(Boolean)
    .join(', ')
  const agencyParty = address
    ? `${organizationName}, with its principal office at ${address} ("Agency")`
    : `${organizationName} ("Agency")`

  return (
    <section className="mt-5 rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-border pb-4">
        <p className="text-sm font-semibold text-foreground">Document</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Independent Contractor Agreement for Obamacare Contractor Agents
        </p>
      </div>

      <div
        aria-label="Independent Contractor Agreement content"
        className="max-h-[28rem] overflow-y-auto overscroll-contain rounded-lg border border-border bg-slate-50 px-5 py-5 text-[0.9375rem] leading-7 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary sm:max-h-[32rem] sm:px-6"
        role="document"
        tabIndex={0}
      >
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Independent Contractor Agreement
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-950">
            Non-Compete, Non-Solicitation, Confidentiality, Compliance & Commission Agreement
          </h2>
          <dl className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Effective Date</dt>
              <dd className="mt-1 font-medium text-slate-900">{effectiveDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Contractor</dt>
              <dd className="mt-1 font-medium text-slate-900">{contractorName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Agency</dt>
              <dd className="mt-1 font-medium text-slate-900">{organizationName}</dd>
            </div>
            {governingLaw && (
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Governing Law</dt>
                <dd className="mt-1 font-medium text-slate-900">{governingLaw}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-slate-700">
            This Independent Contractor Agreement ("Agreement") is entered into as of{' '}
            <strong className="font-semibold text-slate-950">{effectiveDate}</strong>, by and
            between <strong className="font-semibold text-slate-950">{agencyParty}</strong>, and{' '}
            <strong className="font-semibold text-slate-950">
              {contractorName} ("Contractor")
            </strong>
            .
          </p>
          <p className="mt-2">
            Agency and Contractor may be referred to individually as a "Party" and collectively as
            the "Parties."
          </p>
        </header>

        <div className="space-y-5 py-5">
          {clauses.map((clause) => (
            <article key={clause.title} className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold leading-snug text-slate-950">
                {clause.title}
              </h3>
              <div className="mt-3 space-y-3 text-slate-700">
                {renderBlocks(getClauseLines(clause, governingLaw))}
              </div>
            </article>
          ))}
        </div>

        {firmSigner?.signatureUrl && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-950">Agency Signature</h3>
            <img
              src={firmSigner.signatureUrl}
              alt={`${firmSigner.name} signature`}
              className="mt-3 h-20 max-w-full object-contain object-left"
            />
            <p className="mt-2 font-medium text-slate-950">{firmSigner.name}</p>
            <p className="text-sm text-slate-600">{firmSigner.title}</p>
          </section>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Scroll to review the full agreement before signing.
      </p>
    </section>
  )
}
