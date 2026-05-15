import { ContractorAgreementGate } from '../contractor-agreements'
import { TermsGate } from './terms-gate'

interface ComplianceGateProps {
  children: React.ReactNode
}

export function ComplianceGate({ children }: ComplianceGateProps) {
  return (
    <TermsGate>
      <ContractorAgreementGate>{children}</ContractorAgreementGate>
    </TermsGate>
  )
}
