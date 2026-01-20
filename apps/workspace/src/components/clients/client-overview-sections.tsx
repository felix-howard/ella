/**
 * ClientOverviewSections - Displays all intake form data in collapsible sections
 * Groups answers by category and shows only answered questions
 */

import { useState, useMemo } from 'react'
import { ChevronDown, Copy, Check } from 'lucide-react'
import { cn } from '@ella/ui'
import { copyToClipboard } from '../../lib/formatters'
import {
  UI_TEXT,
  FILING_STATUS_LABELS,
  LANGUAGE_LABELS,
} from '../../lib/constants'
import type { ClientDetail } from '../../lib/api-client'

// Section configuration with Vietnamese labels
const SECTION_CONFIG: Record<string, { title: string; icon?: string }> = {
  personal_info: { title: 'Thông tin cá nhân' },
  tax_info: { title: 'Thông tin thuế' },
  client_status: { title: 'Trạng thái khách hàng' },
  prior_year: { title: 'Năm trước & Extension' },
  life_changes: { title: 'Thay đổi trong năm' },
  income: { title: 'Nguồn thu nhập' },
  dependents: { title: 'Người phụ thuộc' },
  health: { title: 'Bảo hiểm sức khỏe' },
  deductions: { title: 'Khấu trừ' },
  credits: { title: 'Tín dụng thuế' },
  foreign: { title: 'Thu nhập nước ngoài' },
  business: { title: 'Thông tin doanh nghiệp' },
  filing: { title: 'Giao nhận tờ khai' },
  entity_info: { title: 'Thông tin pháp nhân' },
  ownership: { title: 'Cấu trúc sở hữu' },
  expenses: { title: 'Chi phí kinh doanh' },
  assets: { title: 'Tài sản' },
  state: { title: 'Thuế tiểu bang' },
}

// Field display configuration with Vietnamese labels and section mapping
const FIELD_CONFIG: Record<string, { label: string; section: string; format?: 'boolean' | 'currency' | 'number' | 'text' | 'select' }> = {
  // Client Status
  isNewClient: { label: 'Khách hàng mới', section: 'client_status', format: 'boolean' },
  hasIrsNotice: { label: 'Có thông báo từ IRS', section: 'client_status', format: 'boolean' },
  hasIdentityTheft: { label: 'Có vấn đề Identity Theft', section: 'client_status', format: 'boolean' },

  // Prior Year
  hasExtensionFiled: { label: 'Đã nộp Extension', section: 'prior_year', format: 'boolean' },
  estimatedTaxPaid: { label: 'Đã trả Estimated Tax', section: 'prior_year', format: 'boolean' },
  estimatedTaxAmountTotal: { label: 'Tổng Estimated Tax đã trả', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ1: { label: 'Estimated Tax Q1', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ2: { label: 'Estimated Tax Q2', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ3: { label: 'Estimated Tax Q3', section: 'prior_year', format: 'currency' },
  estimatedTaxPaidQ4: { label: 'Estimated Tax Q4', section: 'prior_year', format: 'currency' },
  priorYearAGI: { label: 'AGI năm trước', section: 'prior_year', format: 'currency' },

  // Life Changes
  hasAddressChange: { label: 'Đổi địa chỉ', section: 'life_changes', format: 'boolean' },
  hasMaritalChange: { label: 'Thay đổi tình trạng hôn nhân', section: 'life_changes', format: 'boolean' },
  hasNewChild: { label: 'Có con mới', section: 'life_changes', format: 'boolean' },
  hasBoughtSoldHome: { label: 'Mua/Bán nhà', section: 'life_changes', format: 'boolean' },
  hasStartedBusiness: { label: 'Bắt đầu kinh doanh', section: 'life_changes', format: 'boolean' },

  // Income - Employment
  hasW2: { label: 'Có W2', section: 'income', format: 'boolean' },
  w2Count: { label: 'Số lượng W2', section: 'income', format: 'number' },
  hasW2G: { label: 'Có W2-G (Gambling)', section: 'income', format: 'boolean' },
  hasTipsIncome: { label: 'Có thu nhập Tips', section: 'income', format: 'boolean' },
  has1099NEC: { label: 'Có 1099-NEC', section: 'income', format: 'boolean' },
  num1099Types: { label: 'Số loại 1099', section: 'income', format: 'number' },
  hasJuryDutyPay: { label: 'Có tiền Jury Duty', section: 'income', format: 'boolean' },

  // Income - Self Employment
  hasSelfEmployment: { label: 'Tự kinh doanh', section: 'income', format: 'boolean' },

  // Income - Banking & Investments
  hasBankAccount: { label: 'Có tài khoản ngân hàng', section: 'income', format: 'boolean' },
  hasInvestments: { label: 'Có đầu tư', section: 'income', format: 'boolean' },
  hasCrypto: { label: 'Có Crypto', section: 'income', format: 'boolean' },

  // Income - Retirement & Benefits
  hasRetirement: { label: 'Có thu nhập hưu trí', section: 'income', format: 'boolean' },
  hasSocialSecurity: { label: 'Có Social Security', section: 'income', format: 'boolean' },
  hasUnemployment: { label: 'Có Unemployment', section: 'income', format: 'boolean' },
  hasAlimony: { label: 'Có Alimony', section: 'income', format: 'boolean' },

  // Income - Rental & K-1
  hasRentalProperty: { label: 'Có bất động sản cho thuê', section: 'income', format: 'boolean' },
  rentalPropertyCount: { label: 'Số bất động sản', section: 'income', format: 'number' },
  rentalMonthsRented: { label: 'Số tháng cho thuê', section: 'income', format: 'number' },
  rentalPersonalUseDays: { label: 'Số ngày sử dụng cá nhân', section: 'income', format: 'number' },
  hasK1Income: { label: 'Có K-1 Income', section: 'income', format: 'boolean' },
  k1Count: { label: 'Số K-1', section: 'income', format: 'number' },

  // Home Sale
  homeSaleGrossProceeds: { label: 'Tiền bán nhà (Gross)', section: 'income', format: 'currency' },
  homeSaleGain: { label: 'Lợi nhuận bán nhà', section: 'income', format: 'currency' },
  monthsLivedInHome: { label: 'Số tháng sống trong nhà', section: 'income', format: 'number' },
  homeOfficeSqFt: { label: 'Diện tích Home Office (sqft)', section: 'income', format: 'number' },
  homeOfficeMethod: { label: 'Phương pháp Home Office', section: 'income', format: 'select' },

  // Dependents
  hasKidsUnder17: { label: 'Con dưới 17 tuổi', section: 'dependents', format: 'boolean' },
  numKidsUnder17: { label: 'Số con dưới 17 tuổi', section: 'dependents', format: 'number' },
  numDependentsCTC: { label: 'Số người phụ thuộc CTC', section: 'dependents', format: 'number' },
  paysDaycare: { label: 'Trả tiền Daycare', section: 'dependents', format: 'boolean' },
  daycareAmount: { label: 'Số tiền Daycare', section: 'dependents', format: 'currency' },
  childcareProviderName: { label: 'Tên nhà cung cấp Childcare', section: 'dependents', format: 'text' },
  childcareProviderEIN: { label: 'EIN nhà cung cấp Childcare', section: 'dependents', format: 'text' },
  hasKids17to24: { label: 'Con 17-24 tuổi', section: 'dependents', format: 'boolean' },
  hasOtherDependents: { label: 'Người phụ thuộc khác', section: 'dependents', format: 'boolean' },

  // Health Insurance
  hasMarketplaceCoverage: { label: 'Có Marketplace Coverage', section: 'health', format: 'boolean' },
  hasHSA: { label: 'Có HSA', section: 'health', format: 'boolean' },

  // Deductions
  hasMortgage: { label: 'Có Mortgage', section: 'deductions', format: 'boolean' },
  helocInterestPurpose: { label: 'Mục đích HELOC', section: 'deductions', format: 'select' },
  hasPropertyTax: { label: 'Có Property Tax', section: 'deductions', format: 'boolean' },
  hasCharitableDonations: { label: 'Có từ thiện', section: 'deductions', format: 'boolean' },
  noncashDonationValue: { label: 'Giá trị đóng góp phi tiền mặt', section: 'deductions', format: 'currency' },
  hasMedicalExpenses: { label: 'Có chi phí y tế', section: 'deductions', format: 'boolean' },
  medicalMileage: { label: 'Medical Mileage', section: 'deductions', format: 'number' },
  hasStudentLoanInterest: { label: 'Có Student Loan Interest', section: 'deductions', format: 'boolean' },
  hasEducatorExpenses: { label: 'Có Educator Expenses', section: 'deductions', format: 'boolean' },
  hasCasualtyLoss: { label: 'Có Casualty Loss', section: 'deductions', format: 'boolean' },

  // Credits
  hasEnergyCredits: { label: 'Có Energy Credits', section: 'credits', format: 'boolean' },
  energyCreditInvoice: { label: 'Có hóa đơn Energy Credit', section: 'credits', format: 'boolean' },
  hasEVCredit: { label: 'Có EV Credit', section: 'credits', format: 'boolean' },
  hasAdoptionExpenses: { label: 'Có Adoption Expenses', section: 'credits', format: 'boolean' },
  hasRDCredit: { label: 'Có R&D Credit', section: 'credits', format: 'boolean' },

  // Foreign
  hasForeignAccounts: { label: 'Có tài khoản nước ngoài', section: 'foreign', format: 'boolean' },
  fbarMaxBalance: { label: 'FBAR Max Balance', section: 'foreign', format: 'currency' },
  hasForeignIncome: { label: 'Có thu nhập nước ngoài', section: 'foreign', format: 'boolean' },
  hasForeignTaxPaid: { label: 'Đã trả thuế nước ngoài', section: 'foreign', format: 'boolean' },
  feieResidencyStartDate: { label: 'FEIE Residency Start', section: 'foreign', format: 'text' },
  feieResidencyEndDate: { label: 'FEIE Residency End', section: 'foreign', format: 'text' },
  foreignGiftValue: { label: 'Giá trị quà từ nước ngoài', section: 'foreign', format: 'currency' },

  // Business
  businessName: { label: 'Tên doanh nghiệp', section: 'business', format: 'text' },
  ein: { label: 'EIN', section: 'business', format: 'text' },
  hasEmployees: { label: 'Có nhân viên', section: 'business', format: 'boolean' },
  hasContractors: { label: 'Có contractors', section: 'business', format: 'boolean' },
  has1099K: { label: 'Có 1099-K', section: 'business', format: 'boolean' },
  hasHomeOffice: { label: 'Có Home Office', section: 'business', format: 'boolean' },
  hasBusinessVehicle: { label: 'Có xe kinh doanh', section: 'business', format: 'boolean' },

  // Entity Info (1120S/1065)
  entityName: { label: 'Tên pháp nhân', section: 'entity_info', format: 'text' },
  entityEIN: { label: 'EIN pháp nhân', section: 'entity_info', format: 'text' },
  stateOfFormation: { label: 'Tiểu bang thành lập', section: 'entity_info', format: 'text' },
  accountingMethod: { label: 'Phương pháp kế toán', section: 'entity_info', format: 'select' },
  returnType: { label: 'Loại tờ khai', section: 'entity_info', format: 'select' },

  // Ownership
  hasOwnershipChanges: { label: 'Có thay đổi sở hữu', section: 'ownership', format: 'boolean' },
  hasNonresidentOwners: { label: 'Có chủ sở hữu non-resident', section: 'ownership', format: 'boolean' },
  hasDistributions: { label: 'Có distributions', section: 'ownership', format: 'boolean' },
  hasOwnerLoans: { label: 'Có owner loans', section: 'ownership', format: 'boolean' },

  // Expenses
  hasGrossReceipts: { label: 'Có Gross Receipts', section: 'expenses', format: 'boolean' },
  businessHas1099K: { label: 'Business có 1099-K', section: 'expenses', format: 'boolean' },
  businessHas1099NEC: { label: 'Business có 1099-NEC', section: 'expenses', format: 'boolean' },
  hasInterestIncome: { label: 'Có Interest Income', section: 'expenses', format: 'boolean' },
  businessHasRentalIncome: { label: 'Business có Rental Income', section: 'expenses', format: 'boolean' },
  hasInventory: { label: 'Có Inventory', section: 'expenses', format: 'boolean' },
  businessHasEmployees: { label: 'Business có nhân viên', section: 'expenses', format: 'boolean' },
  businessHasContractors: { label: 'Business có contractors', section: 'expenses', format: 'boolean' },
  hasOfficerCompensation: { label: 'Có Officer Compensation', section: 'expenses', format: 'boolean' },
  officerCompensationAmount: { label: 'Số tiền Officer Compensation', section: 'expenses', format: 'currency' },
  hasGuaranteedPayments: { label: 'Có Guaranteed Payments', section: 'expenses', format: 'boolean' },
  guaranteedPaymentsAmount: { label: 'Số tiền Guaranteed Payments', section: 'expenses', format: 'currency' },
  hasRetirementPlan: { label: 'Có Retirement Plan', section: 'expenses', format: 'boolean' },
  hasHealthInsuranceOwners: { label: 'Có Health Insurance cho owners', section: 'expenses', format: 'boolean' },

  // Assets
  hasAssetPurchases: { label: 'Có mua tài sản', section: 'assets', format: 'boolean' },
  hasAssetDisposals: { label: 'Có bán tài sản', section: 'assets', format: 'boolean' },
  hasDepreciation: { label: 'Có khấu hao', section: 'assets', format: 'boolean' },
  hasVehicles: { label: 'Có vehicles', section: 'assets', format: 'boolean' },

  // State
  statesWithNexus: { label: 'Tiểu bang có nexus', section: 'state', format: 'text' },
  hasMultistateIncome: { label: 'Có thu nhập đa tiểu bang', section: 'state', format: 'boolean' },
  businessHasForeignActivity: { label: 'Business có hoạt động nước ngoài', section: 'state', format: 'boolean' },
  hasForeignOwners: { label: 'Có chủ sở hữu nước ngoài', section: 'state', format: 'boolean' },
  shareholderBasisTracking: { label: 'Có theo dõi Shareholder Basis', section: 'state', format: 'boolean' },
  partnerCapitalMethod: { label: 'Phương pháp Partner Capital', section: 'state', format: 'select' },

  // Filing
  deliveryPreference: { label: 'Preference giao nhận', section: 'filing', format: 'select' },
  followUpNotes: { label: 'Ghi chú follow-up', section: 'filing', format: 'text' },
  refundBankAccount: { label: 'Tài khoản nhận refund', section: 'filing', format: 'text' },
  refundRoutingNumber: { label: 'Routing Number', section: 'filing', format: 'text' },

  // Tax Info
  taxYear: { label: 'Năm thuế', section: 'tax_info', format: 'number' },
  filingStatus: { label: 'Tình trạng khai thuế', section: 'tax_info', format: 'select' },
  refundMethod: { label: 'Phương thức nhận refund', section: 'tax_info', format: 'select' },
}

// Select option labels
const SELECT_LABELS: Record<string, Record<string, string>> = {
  homeOfficeMethod: {
    SIMPLIFIED: 'Simplified',
    REGULAR: 'Regular',
  },
  helocInterestPurpose: {
    HOME_IMPROVEMENT: 'Home Improvement',
    OTHER: 'Other',
  },
  accountingMethod: {
    CASH: 'Cash',
    ACCRUAL: 'Accrual',
    OTHER: 'Other',
  },
  returnType: {
    ORIGINAL: 'Original',
    AMENDED: 'Amended',
    FINAL: 'Final',
  },
  deliveryPreference: {
    EMAIL: 'Email',
    MAIL: 'Mail',
    PICKUP: 'Pick up',
  },
  refundMethod: {
    DIRECT_DEPOSIT: 'Direct Deposit',
    CHECK: 'Check',
    APPLY_NEXT_YEAR: 'Apply to Next Year',
  },
  partnerCapitalMethod: {
    TAX: 'Tax',
    GAAP: 'GAAP',
    '704B': '704(b)',
  },
}

interface ClientOverviewSectionsProps {
  client: ClientDetail
}

export function ClientOverviewSections({ client }: ClientOverviewSectionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  // All sections expanded by default - initialize with all section keys
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(Object.keys(SECTION_CONFIG))
  })

  const profile = client.profile
  const intakeAnswers = profile?.intakeAnswers || {}
  const latestCase = client.taxCases?.[0]

  // Handle copy to clipboard
  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Format value for display
  const formatValue = (
    key: string,
    value: boolean | number | string | undefined,
    format?: string
  ): string => {
    if (value === undefined || value === null) return '—'

    switch (format) {
      case 'boolean':
        return value ? 'Có' : 'Không'
      case 'currency':
        return typeof value === 'number'
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            }).format(value)
          : String(value)
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value)
      case 'select':
        // Look up display label for select values
        const selectLabels = SELECT_LABELS[key]
        if (selectLabels && typeof value === 'string') {
          return selectLabels[value] || value
        }
        // Check filing status
        if (key === 'filingStatus' && typeof value === 'string') {
          return FILING_STATUS_LABELS[value as keyof typeof FILING_STATUS_LABELS] || value
        }
        return String(value)
      default:
        return String(value)
    }
  }

  // Group intake answers by section
  const sectionData = useMemo(() => {
    const sections: Record<string, Array<{ key: string; label: string; value: string; rawValue: unknown }>> = {}

    // Add personal info section (from client directly)
    sections.personal_info = [
      { key: 'name', label: UI_TEXT.form.clientName, value: client.name, rawValue: client.name },
      { key: 'phone', label: UI_TEXT.form.phone, value: client.phone, rawValue: client.phone },
    ]
    if (client.email) {
      sections.personal_info.push({ key: 'email', label: UI_TEXT.form.email, value: client.email, rawValue: client.email })
    }
    sections.personal_info.push({
      key: 'language',
      label: UI_TEXT.form.language,
      value: LANGUAGE_LABELS[client.language],
      rawValue: client.language,
    })
    if (profile?.filingStatus) {
      sections.personal_info.push({
        key: 'filingStatus',
        label: UI_TEXT.form.filingStatus,
        value: FILING_STATUS_LABELS[profile.filingStatus as keyof typeof FILING_STATUS_LABELS] || profile.filingStatus,
        rawValue: profile.filingStatus,
      })
    }

    // Add tax info section (from tax case)
    sections.tax_info = []
    if (latestCase) {
      sections.tax_info.push({
        key: 'taxYear',
        label: UI_TEXT.form.taxYear,
        value: String(latestCase.taxYear),
        rawValue: latestCase.taxYear,
      })
      sections.tax_info.push({
        key: 'taxTypes',
        label: UI_TEXT.form.taxTypes,
        value: latestCase.taxTypes?.join(', ') || '—',
        rawValue: latestCase.taxTypes,
      })
    }

    // Add legacy profile fields that might not be in intakeAnswers
    const legacyFields = [
      'hasW2', 'hasBankAccount', 'hasInvestments', 'hasKidsUnder17',
      'numKidsUnder17', 'paysDaycare', 'hasKids17to24', 'hasSelfEmployment',
      'hasRentalProperty', 'businessName', 'ein', 'hasEmployees',
      'hasContractors', 'has1099K',
    ]

    // Process intake answers
    for (const [key, value] of Object.entries(intakeAnswers)) {
      const config = FIELD_CONFIG[key]
      if (!config) continue

      const formattedValue = formatValue(key, value, config.format)
      if (!sections[config.section]) {
        sections[config.section] = []
      }
      sections[config.section].push({
        key,
        label: config.label,
        value: formattedValue,
        rawValue: value,
      })
    }

    // Add legacy profile fields if not already in intakeAnswers
    if (profile) {
      for (const field of legacyFields) {
        const value = profile[field as keyof typeof profile]
        const config = FIELD_CONFIG[field]
        if (!config || value === undefined || value === null) continue
        // Skip if already added from intakeAnswers
        if (intakeAnswers[field] !== undefined) continue

        const formattedValue = formatValue(field, value as boolean | number | string, config.format)
        if (!sections[config.section]) {
          sections[config.section] = []
        }
        sections[config.section].push({
          key: field,
          label: config.label,
          value: formattedValue,
          rawValue: value,
        })
      }
    }

    return sections
  }, [client, profile, intakeAnswers, latestCase])

  // Section order for display
  const sectionOrder = [
    'personal_info',
    'tax_info',
    'client_status',
    'prior_year',
    'life_changes',
    'income',
    'dependents',
    'health',
    'deductions',
    'credits',
    'foreign',
    'business',
    'filing',
    'entity_info',
    'ownership',
    'expenses',
    'assets',
    'state',
  ]

  // Filter sections that have data
  const sectionsWithData = sectionOrder.filter(
    (sectionKey) => sectionData[sectionKey] && sectionData[sectionKey].length > 0
  )

  return (
    <div className="columns-1 lg:columns-2 gap-4">
      {sectionsWithData.map((sectionKey) => {
        const items = sectionData[sectionKey]!
        const config = SECTION_CONFIG[sectionKey]
        const isExpanded = expandedSections.has(sectionKey)

        return (
          <div
            key={sectionKey}
            className="bg-card rounded-xl border border-border overflow-hidden break-inside-avoid mb-4"
          >
            {/* Section Header */}
            <button
              type="button"
              onClick={() => toggleSection(sectionKey)}
              className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-primary">
                  {config?.title || sectionKey}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </button>

            {/* Section Content */}
            {isExpanded && (
              <div className="p-4 pt-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <InfoRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      onCopy={
                        typeof item.rawValue === 'string' && item.rawValue.length > 0
                          ? () => handleCopy(String(item.rawValue), item.key)
                          : undefined
                      }
                      copied={copiedField === item.key}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Info row component with optional copy button
interface InfoRowProps {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
}

function InfoRow({ label, value, onCopy, copied }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
