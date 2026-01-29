/**
 * Shared field group configuration for document type verification
 * Groups extracted fields by category for grouped section rendering
 * Used by: data-entry-modal, ocr-verification-panel, verification-modal
 */

import type { LucideIcon } from 'lucide-react'
import { Building2, User, DollarSign, MapPin, FileText, Hash } from 'lucide-react'

/** Field group configuration for a document type section */
export interface FieldGroup {
  key: string
  label: string
  icon: LucideIcon
  fields: string[]
}

/** Field grouping definitions for different document types */
export const DOC_TYPE_FIELD_GROUPS: Record<string, FieldGroup[]> = {
  W2: [
    {
      key: 'employer',
      label: 'Thông tin công ty',
      icon: Building2,
      fields: ['employerName', 'employerEin', 'employerAddress'],
    },
    {
      key: 'employee',
      label: 'Thông tin nhân viên',
      icon: User,
      fields: ['employeeName', 'employeeAddress', 'employeeSsn'],
    },
    {
      key: 'wages',
      label: 'Lương & Thu nhập',
      icon: DollarSign,
      fields: ['wagesTips', 'socialSecurityWages', 'medicareWages', 'wagesTipsOther'],
    },
    {
      key: 'taxes',
      label: 'Thuế đã khấu trừ',
      icon: FileText,
      fields: ['federalTaxWithheld', 'socialSecurityTax', 'medicareTax', 'socialSecurityTaxWithheld', 'medicareTaxWithheld', 'stateTaxWithheld'],
    },
    {
      key: 'other',
      label: 'Thông tin khác',
      icon: Hash,
      fields: ['taxYear', 'formVariant', 'controlNumber', 'state'],
    },
  ],
  SSN_CARD: [
    {
      key: 'personal',
      label: 'Thông tin cá nhân',
      icon: User,
      fields: ['name', 'ssn'],
    },
  ],
  DRIVER_LICENSE: [
    {
      key: 'personal',
      label: 'Thông tin cá nhân',
      icon: User,
      fields: ['name', 'dateOfBirth'],
    },
    {
      key: 'address',
      label: 'Địa chỉ',
      icon: MapPin,
      fields: ['address'],
    },
    {
      key: 'license',
      label: 'Thông tin bằng lái',
      icon: FileText,
      fields: ['licenseNumber', 'expirationDate'],
    },
  ],
  FORM_1099_INT: [
    {
      key: 'payer',
      label: 'Thông tin ngân hàng',
      icon: Building2,
      fields: ['payerName', 'payerTin', 'payerAddress'],
    },
    {
      key: 'income',
      label: 'Thu nhập lãi suất',
      icon: DollarSign,
      fields: ['interestIncome', 'earlyWithdrawalPenalty', 'usSavingsBondInterest', 'federalTaxWithheld'],
    },
  ],
  FORM_1099_NEC: [
    {
      key: 'payer',
      label: 'Thông tin người trả',
      icon: Building2,
      fields: ['payerName', 'payerTin', 'payerAddress'],
    },
    {
      key: 'income',
      label: 'Thu nhập',
      icon: DollarSign,
      fields: ['nonemployeeCompensation', 'federalTaxWithheld'],
    },
    {
      key: 'state',
      label: 'Thông tin tiểu bang',
      icon: MapPin,
      fields: ['state', 'statePayerStateNo', 'stateIncome'],
    },
  ],
  FORM_1099_DIV: [
    {
      key: 'payer',
      label: 'Thông tin công ty',
      icon: Building2,
      fields: ['payerName', 'payerTin'],
    },
    {
      key: 'dividends',
      label: 'Cổ tức',
      icon: DollarSign,
      fields: ['ordinaryDividends', 'qualifiedDividends', 'capitalGainDistributions', 'federalTaxWithheld'],
    },
  ],
  BANK_STATEMENT: [
    {
      key: 'bank',
      label: 'Thông tin ngân hàng',
      icon: Building2,
      fields: ['bankName', 'routingNumber', 'accountNumber'],
    },
  ],
}
