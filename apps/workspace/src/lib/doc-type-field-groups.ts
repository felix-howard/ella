/**
 * Shared field group configuration for document type verification
 * Groups extracted fields by category for grouped section rendering
 * Used by: data-entry-modal, ocr-verification-panel, verification-modal
 */

import type { LucideIcon } from 'lucide-react'
import { Building2, User, DollarSign, MapPin, FileText, Hash, Calculator, CreditCard, Receipt, Users } from 'lucide-react'
import i18n from './i18n'

/** Field group configuration for a document type section */
export interface FieldGroup {
  key: string
  label: string
  icon: LucideIcon
  fields: string[]
}

/** Field grouping definitions (static data with translation keys) */
const DOC_TYPE_FIELD_GROUPS_DATA: Record<string, Array<{ key: string; labelKey: string; icon: LucideIcon; fields: string[] }>> = {
  W2: [
    {
      key: 'employer',
      labelKey: 'fieldGroup.employer',
      icon: Building2,
      fields: ['employerName', 'employerEin', 'employerAddress'],
    },
    {
      key: 'employee',
      labelKey: 'fieldGroup.employee',
      icon: User,
      fields: ['employeeName', 'employeeAddress', 'employeeSsn'],
    },
    {
      key: 'wages',
      labelKey: 'fieldGroup.wages',
      icon: DollarSign,
      fields: ['wagesTips', 'socialSecurityWages', 'medicareWages', 'wagesTipsOther'],
    },
    {
      key: 'taxes',
      labelKey: 'fieldGroup.taxes',
      icon: FileText,
      fields: ['federalTaxWithheld', 'socialSecurityTax', 'medicareTax', 'socialSecurityTaxWithheld', 'medicareTaxWithheld', 'stateTaxWithheld'],
    },
    {
      key: 'other',
      labelKey: 'fieldGroup.other',
      icon: Hash,
      fields: ['taxYear', 'formVariant', 'controlNumber', 'state'],
    },
  ],
  SSN_CARD: [
    {
      key: 'personal',
      labelKey: 'fieldGroup.personal',
      icon: User,
      fields: ['name', 'ssn'],
    },
  ],
  DRIVER_LICENSE: [
    {
      key: 'personal',
      labelKey: 'fieldGroup.personal',
      icon: User,
      fields: ['name', 'dateOfBirth'],
    },
    {
      key: 'address',
      labelKey: 'fieldGroup.address',
      icon: MapPin,
      fields: ['address'],
    },
    {
      key: 'license',
      labelKey: 'fieldGroup.license',
      icon: FileText,
      fields: ['licenseNumber', 'expirationDate'],
    },
  ],
  FORM_1099_INT: [
    {
      key: 'payer',
      labelKey: 'fieldGroup.payerBank',
      icon: Building2,
      fields: ['payerName', 'payerTin', 'payerAddress'],
    },
    {
      key: 'income',
      labelKey: 'fieldGroup.income',
      icon: DollarSign,
      fields: ['interestIncome', 'earlyWithdrawalPenalty', 'usSavingsBondInterest', 'federalTaxWithheld'],
    },
  ],
  FORM_1099_NEC: [
    {
      key: 'payer',
      labelKey: 'fieldGroup.payer',
      icon: Building2,
      fields: ['payerName', 'payerTin', 'payerAddress'],
    },
    {
      key: 'income',
      labelKey: 'fieldGroup.income',
      icon: DollarSign,
      fields: ['nonemployeeCompensation', 'federalTaxWithheld'],
    },
    {
      key: 'state',
      labelKey: 'fieldGroup.state',
      icon: MapPin,
      fields: ['state', 'statePayerStateNo', 'stateIncome'],
    },
  ],
  FORM_1099_DIV: [
    {
      key: 'payer',
      labelKey: 'fieldGroup.payerInfo',
      icon: Building2,
      fields: ['payerName', 'payerTin'],
    },
    {
      key: 'dividends',
      labelKey: 'fieldGroup.dividends',
      icon: DollarSign,
      fields: ['ordinaryDividends', 'qualifiedDividends', 'capitalGainDistributions', 'federalTaxWithheld'],
    },
  ],
  BANK_STATEMENT: [
    {
      key: 'bank',
      labelKey: 'fieldGroup.bank',
      icon: Building2,
      fields: ['bankName', 'routingNumber', 'accountNumber'],
    },
  ],
  FORM_1040: [
    {
      key: 'taxpayer',
      labelKey: 'fieldGroup.taxpayer',
      icon: User,
      fields: ['taxpayerName', 'taxpayerSSN', 'filingStatus'],
    },
    {
      key: 'spouse',
      labelKey: 'fieldGroup.spouse',
      icon: Users,
      fields: ['spouseName', 'spouseSSN'],
    },
    {
      key: 'income',
      labelKey: 'fieldGroup.income',
      icon: DollarSign,
      fields: ['totalWages', 'totalIncome', 'adjustedGrossIncome'],
    },
    {
      key: 'taxDeductions',
      labelKey: 'fieldGroup.taxDeductions',
      icon: Calculator,
      fields: ['taxableIncome', 'standardOrItemizedDeduction', 'totalTax'],
    },
    {
      key: 'credits',
      labelKey: 'fieldGroup.credits',
      icon: CreditCard,
      fields: ['childTaxCredit', 'earnedIncomeCredit', 'adjustmentsToIncome'],
    },
    {
      key: 'payments',
      labelKey: 'fieldGroup.payments',
      icon: Receipt,
      fields: ['totalWithheld', 'totalPayments', 'refundAmount', 'amountOwed'],
    },
    {
      key: 'formInfo',
      labelKey: 'fieldGroup.formInfo',
      icon: FileText,
      fields: ['taxYear', 'formVariant', 'attachedSchedules', 'digitalAssetsAnswer'],
    },
  ],
  SCHEDULE_C: [
    {
      key: 'businessInfo',
      labelKey: 'fieldGroup.businessInfo',
      icon: Building2,
      fields: ['businessName', 'proprietorName', 'principalBusinessCode', 'businessAddress', 'ein', 'accountingMethod'],
    },
    {
      key: 'income',
      labelKey: 'fieldGroup.income',
      icon: DollarSign,
      fields: ['grossReceipts', 'returns', 'grossReceiptsLessReturns', 'costOfGoodsSold', 'grossProfit', 'otherIncome', 'grossIncome'],
    },
    {
      key: 'expenses',
      labelKey: 'fieldGroup.expenses',
      icon: Receipt,
      fields: [
        'advertising', 'carAndTruck', 'commissions', 'contractLabor', 'depletion', 'depreciation',
        'employeeBenefit', 'insurance', 'interestMortgage', 'interestOther', 'legalAndProfessional',
        'officeExpense', 'pensionProfitSharing', 'rentVehicles', 'rentMachinery', 'repairs',
        'supplies', 'taxesLicenses', 'travel', 'mealsDeductible', 'utilities', 'wages',
        'otherExpensesDescription', 'otherExpensesAmount', 'totalExpenses'
      ],
    },
    {
      key: 'netProfit',
      labelKey: 'fieldGroup.netProfit',
      icon: Calculator,
      fields: ['tentativeProfit', 'expensesForHomeUse', 'netProfit'],
    },
    {
      key: 'formInfo',
      labelKey: 'fieldGroup.formInfo',
      icon: FileText,
      fields: ['taxYear', 'materialParticipation', 'startedOrAcquiredInYear'],
    },
  ],
}

/** Field grouping definitions for different document types (with i18n) */
export const DOC_TYPE_FIELD_GROUPS: Record<string, FieldGroup[]> = new Proxy({} as Record<string, FieldGroup[]>, {
  get(_, prop: string) {
    const data = DOC_TYPE_FIELD_GROUPS_DATA[prop]
    if (!data) return undefined
    return data.map(group => ({
      key: group.key,
      label: i18n.t(group.labelKey),
      icon: group.icon,
      fields: group.fields,
    }))
  },
  ownKeys() {
    return Object.keys(DOC_TYPE_FIELD_GROUPS_DATA)
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (prop in DOC_TYPE_FIELD_GROUPS_DATA) {
      return { configurable: true, enumerable: true }
    }
  },
})
