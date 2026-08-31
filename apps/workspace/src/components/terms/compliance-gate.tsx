import { ContractorAgreementGate } from '../contractor-agreements'
import { AccountExecutiveAgreementGate } from '../account-executive-agreements'
import { TermsGate } from './terms-gate'

interface ComplianceGateProps {
  children: React.ReactNode
}

export function ComplianceGate({ children }: ComplianceGateProps) {
  return (
    <TermsGate>
      <ContractorAgreementGate>
        <AccountExecutiveAgreementGate>{children}</AccountExecutiveAgreementGate>
      </ContractorAgreementGate>
    </TermsGate>
  )
}
