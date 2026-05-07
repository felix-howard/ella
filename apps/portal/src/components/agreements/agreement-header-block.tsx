/**
 * HTML version of the PDF parties block, shown above the agreement body so
 * the client sees the same "entered into as of {Date} by and between" header
 * they'll see in the final PDF. Date renders as "[Date]" until the client
 * signs (matches PDF preview behavior).
 */
import type { AgreementFirmSnapshot, AgreementClientSnapshot } from '../../lib/api-client'

interface AgreementHeaderBlockProps {
  firm: AgreementFirmSnapshot
  client: AgreementClientSnapshot
}

export function AgreementHeaderBlock({ firm, client }: AgreementHeaderBlockProps) {
  const date = firm.signedAt ?? '[Date]'
  return (
    <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 sm:p-5 text-[0.9375rem] leading-relaxed text-foreground/90 space-y-2">
      <p>
        {'This Confidentiality and Non-Disclosure Agreement ("Agreement") is entered into as of '}
        <span className="font-semibold text-foreground">{date}</span>
        {' by and between:'}
      </p>
      <p>
        <span className="font-semibold text-foreground">{firm.name}</span>
        {', located at '}
        <span className="font-semibold text-foreground">{firm.address}</span>
        {' ("Firm"),'}
      </p>
      <p className="text-muted-foreground">and</p>
      <p>
        <span className="font-semibold text-foreground">{client.nameOrBusiness}</span>
        {', located at '}
        <span className="font-semibold text-foreground">{client.address}</span>
        {' ("Client").'}
      </p>
      <p className="text-muted-foreground italic">
        {'The Firm and Client may be referred to individually as a "Party" and collectively as the "Parties."'}
      </p>
    </div>
  )
}
