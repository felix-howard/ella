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
      <ol key={`list-${blocks.length}`} className="list-decimal space-y-1 pl-8">
        {listItems}
      </ol>
    )
    listItems = []
  }

  lines.forEach((line) => {
    const listMatch = line.match(/^(\d+)\.\s(.+)/)
    if (listMatch) {
      listItems.push(
        <li key={line} value={Number(listMatch[1])} className="pl-2">
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
        className="max-h-[28rem] overflow-y-auto overscroll-contain rounded-md border border-border bg-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary sm:max-h-[32rem] sm:p-5"
        role="document"
        tabIndex={0}
      >
        <article className="mx-auto min-h-[52rem] max-w-[46rem] bg-white px-6 py-8 font-serif text-[13px] leading-[1.45] text-black shadow-sm sm:px-10 sm:py-12 sm:text-[14px]">
          <header className="border-b border-neutral-300 pb-4 text-center">
            <h2 className="text-[18px] font-bold leading-tight sm:text-[22px]">
              Independent Contractor Agreement
            </h2>
            <p className="mt-2 font-bold">
              Non-Compete, Non-Solicitation, Confidentiality, Compliance & Commission Agreement
            </p>
          </header>

          <div className="mt-5 space-y-2">
            <p>
              <strong>Effective Date:</strong> {effectiveDate}
            </p>
            <p>
              <strong>Contractor:</strong> {contractorName}
            </p>
            <p>
              <strong>Agency:</strong> {organizationName}
            </p>
            {governingLaw && (
              <p>
                <strong>Governing Law:</strong> {governingLaw}
              </p>
            )}
          </div>

          <p className="mt-5">
            This Independent Contractor Agreement ("Agreement") is entered into as of{' '}
            <strong>{effectiveDate}</strong>, by and between <strong>{agencyParty}</strong>, and{' '}
            <strong>{contractorName} ("Contractor")</strong>.
          </p>
          <p className="mt-2">
            Agency and Contractor may be referred to individually as a "Party" and collectively as
            the "Parties."
          </p>

          <div className="mt-5 space-y-4">
            {clauses.map((clause) => (
              <section key={clause.title}>
                <h3 className="text-[15px] font-bold leading-snug sm:text-[16px]">
                  {clause.title}
                </h3>
                <div className="mt-2 space-y-2">
                  {renderBlocks(getClauseLines(clause, governingLaw))}
                </div>
              </section>
            ))}
          </div>

          {firmSigner?.signatureUrl && (
            <section className="mt-8 border-t border-neutral-300 pt-4">
              <h3 className="text-[15px] font-bold">Agency Signature</h3>
              <img
                src={firmSigner.signatureUrl}
                alt={`${firmSigner.name} signature`}
                className="mt-3 h-16 max-w-full object-contain object-left"
              />
              <p className="mt-2 font-bold">{firmSigner.name}</p>
              <p>{firmSigner.title}</p>
            </section>
          )}
        </article>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Review the agreement before signing.
      </p>
    </section>
  )
}
