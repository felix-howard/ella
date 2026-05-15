export interface ContractorAgreementOrganization {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  governingState: string | null
  governingCounty: string | null
  firmPhone: string | null
  firmEmail: string | null
  firmWebsite: string | null
}

export interface ContractorAgreementFirmSigner {
  name: string
  email: string
  title: string
  signatureUrl: string | null
}

export interface ContractorAgreementClause {
  title: string
  lines: string[]
}
