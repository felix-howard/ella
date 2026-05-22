/**
 * WizardStep4Review - Final review step with bank info and summary
 * Shows all entered data and collects bank account details
 */

import { cn } from '@ella/ui'
import {
  CreditCard,
  User,
  Users,
  Briefcase,
  Receipt,
  FileText,
  Check,
  AlertCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CustomSelect } from '../../ui/custom-select'
import { maskSSN } from '../../../lib/crypto'
import { RELATIONSHIP_OPTIONS } from '../../../lib/intake-form-config'
import { ROUTING_NUMBER_LENGTH, MAX_ACCOUNT_NUMBER_LENGTH, MAX_NOTES_LENGTH } from './wizard-constants'
import type { IntakeAnswers } from './wizard-container'

interface WizardStep4ReviewProps {
  answers: IntakeAnswers
  onChange: (key: string, value: unknown) => void
  filingStatus: string
  taxYear: number
  errors?: Record<string, string>
}

const FILING_STATUS_KEYS: Record<string, string> = {
  SINGLE: 'filingStatus.single',
  MARRIED_FILING_JOINTLY: 'filingStatus.marriedFilingJointly',
  MARRIED_FILING_SEPARATELY: 'filingStatus.marriedFilingSeparately',
  HEAD_OF_HOUSEHOLD: 'filingStatus.headOfHousehold',
  QUALIFYING_WIDOW: 'filingStatus.qualifyingWidow',
}

// Account type options
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'CHECKING', labelKey: 'intakeWizard.review.accountType.checking' },
  { value: 'SAVINGS', labelKey: 'intakeWizard.review.accountType.savings' },
]

export function WizardStep4Review({
  answers,
  onChange,
  filingStatus,
  taxYear,
  errors,
}: WizardStep4ReviewProps) {
  const { t } = useTranslation()
  const showSpouse = filingStatus === 'MARRIED_FILING_JOINTLY'
  const hasDependents = (answers.dependentCount || 0) > 0
  const accountTypeOptions = ACCOUNT_TYPE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  // Get selected income items
  const selectedIncome = getSelectedItems(answers, [
    { key: 'hasW2', label: 'W-2' },
    { key: 'has1099NEC', label: '1099-NEC' },
    { key: 'hasSelfEmployment', label: t('intakeWizard.review.selectedIncome.selfEmployment') },
    { key: 'hasInvestments', label: t('intakeWizard.review.selectedIncome.investments') },
    { key: 'hasCrypto', label: 'Crypto' },
    { key: 'hasRetirement', label: t('intakeWizard.review.selectedIncome.retirement') },
    { key: 'hasSocialSecurity', label: 'Social Security' },
    { key: 'hasRentalProperty', label: t('intakeWizard.review.selectedIncome.rentalProperty') },
    { key: 'hasK1Income', label: 'K-1' },
  ])

  // Get selected deduction items
  const selectedDeductions = getSelectedItems(answers, [
    { key: 'hasMortgage', label: 'Mortgage' },
    { key: 'hasPropertyTax', label: 'Property Tax' },
    { key: 'hasMedicalExpenses', label: t('intakeWizard.review.selectedDeductions.medicalExpenses') },
    { key: 'hasCharitableDonations', label: t('intakeWizard.review.selectedDeductions.charitableDonations') },
    { key: 'hasStudentLoanInterest', label: 'Student Loan' },
    { key: 'hasEducatorExpenses', label: 'Educator Expenses' },
    { key: 'hasHSA', label: 'HSA' },
  ])

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{t('intakeWizard.review.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('intakeWizard.review.subtitle')}
        </p>
      </div>

      {/* Bank Info Section */}
      <section className="p-5 bg-primary/5 rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary-light">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <h4 className="text-base font-semibold text-foreground">
            {t('intakeWizard.review.bankInfo')}
          </h4>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Account Type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t('intakeWizard.review.accountTypeLabel')}
            </label>
            <CustomSelect
              value={answers.refundAccountType || ''}
              onChange={(value) => onChange('refundAccountType', value)}
              options={accountTypeOptions}
              placeholder={t('intakeWizard.review.accountTypePlaceholder')}
            />
          </div>

          {/* Routing Number */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Routing Number
              {answers.refundAccountType && (
                <span className="text-error ml-1">*</span>
              )}
            </label>
            <input
              type="text"
              value={answers.refundRoutingNumber || ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, ROUTING_NUMBER_LENGTH)
                onChange('refundRoutingNumber', digits)
              }}
              placeholder={t('intakeWizard.review.routingPlaceholder')}
              maxLength={ROUTING_NUMBER_LENGTH}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                errors?.refundRoutingNumber ? 'border-error' : 'border-border'
              )}
            />
            {errors?.refundRoutingNumber && (
              <p className="text-sm text-error">{errors.refundRoutingNumber}</p>
            )}
            {answers.refundRoutingNumber && !errors?.refundRoutingNumber && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {t('intakeWizard.review.confirmRouting')}
              </p>
            )}
          </div>

          {/* Account Number */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-foreground">
              {t('intakeWizard.review.accountNumber')}
              {answers.refundAccountType && (
                <span className="text-error ml-1">*</span>
              )}
            </label>
            <input
              type="text"
              value={answers.refundBankAccount || ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, MAX_ACCOUNT_NUMBER_LENGTH)
                onChange('refundBankAccount', digits)
              }}
              placeholder={t('intakeWizard.review.accountNumberPlaceholder')}
              maxLength={MAX_ACCOUNT_NUMBER_LENGTH}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                errors?.refundBankAccount ? 'border-error' : 'border-border'
              )}
            />
            {errors?.refundBankAccount && (
              <p className="text-sm text-error">{errors.refundBankAccount}</p>
            )}
          </div>
        </div>

        {!answers.refundAccountType && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('intakeWizard.review.mailCheckHint')}
          </p>
        )}
      </section>

      {/* Summary Section */}
      <section>
        <h4 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {t('intakeWizard.review.summaryTitle')}
        </h4>

        <div className="space-y-4">
          {/* Tax Info Card */}
          <SummaryCard
            title={t('intakeWizard.review.generalInfo')}
            icon={FileText}
            items={[
              { label: t('intakeWizard.review.taxYear'), value: String(taxYear) },
              { label: t('intakeWizard.review.filingStatus'), value: t(FILING_STATUS_KEYS[filingStatus] || filingStatus) },
            ]}
          />

          {/* Taxpayer Card */}
          <SummaryCard
            title={t('intakeWizard.review.taxpayer')}
            icon={User}
            items={[
              { label: 'SSN', value: answers.taxpayerSSN ? maskSSN(answers.taxpayerSSN) : t('intakeWizard.review.notEntered') },
              { label: t('intakeWizard.identity.dob'), value: answers.taxpayerDOB || t('intakeWizard.review.notEntered') },
              { label: t('intakeWizard.identity.occupation'), value: answers.taxpayerOccupation || t('intakeWizard.review.notEntered') },
            ]}
          />

          {/* Spouse Card (conditional) */}
          {showSpouse && (
            <SummaryCard
              title={t('intakeWizard.review.spouse')}
              icon={Users}
              items={[
                { label: 'SSN', value: answers.spouseSSN ? maskSSN(answers.spouseSSN) : t('intakeWizard.review.notEntered') },
                { label: t('intakeWizard.identity.dob'), value: answers.spouseDOB || t('intakeWizard.review.notEntered') },
                { label: t('intakeWizard.identity.occupation'), value: answers.spouseOccupation || t('intakeWizard.review.notEntered') },
              ]}
            />
          )}

          {/* Dependents Card (conditional) */}
          {hasDependents && (
            <SummaryCard
              title={t('intakeWizard.review.dependentsTitle', { count: answers.dependentCount })}
              icon={Users}
              items={
                answers.dependents?.map((dep, i) => ({
                  label: `#${i + 1}`,
                  value: `${dep.firstName} ${dep.lastName} - ${getRelationshipLabel(dep.relationship)}`,
                })) || []
              }
            />
          )}

          {/* Income Card */}
          <SummaryCard
            title={t('intakeWizard.review.income')}
            icon={Briefcase}
            items={
              selectedIncome.length > 0
                ? selectedIncome.map((item) => ({
                    label: '',
                    value: item,
                    isTag: true,
                  }))
                : [{ label: '', value: t('intakeWizard.review.noIncomeSelected'), isEmpty: true }]
            }
            horizontal
          />

          {/* Deductions Card */}
          <SummaryCard
            title={t('intakeWizard.review.deductions')}
            icon={Receipt}
            items={
              selectedDeductions.length > 0
                ? selectedDeductions.map((item) => ({
                    label: '',
                    value: item,
                    isTag: true,
                  }))
                : [{ label: '', value: t('intakeWizard.review.noDeductionsSelected'), isEmpty: true }]
            }
            horizontal
          />
        </div>
      </section>

      {/* Notes Section */}
      <section>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('intakeWizard.review.followUpNotes')}
        </label>
        <textarea
          value={answers.followUpNotes || ''}
          onChange={(e) => onChange('followUpNotes', e.target.value.slice(0, MAX_NOTES_LENGTH))}
          placeholder={t('intakeWizard.review.followUpNotesPlaceholder')}
          rows={3}
          maxLength={MAX_NOTES_LENGTH}
          className={cn(
            'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'border-border resize-none'
          )}
        />
        {(answers.followUpNotes?.length ?? 0) > MAX_NOTES_LENGTH * 0.9 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('intakeWizard.review.characterCount', { count: answers.followUpNotes?.length ?? 0, max: MAX_NOTES_LENGTH })}
          </p>
        )}
      </section>
    </div>
  )
}

// Helper: Get selected items from answers
function getSelectedItems(
  answers: IntakeAnswers,
  items: { key: string; label: string }[]
): string[] {
  return items.filter((item) => answers[item.key] === true).map((item) => item.label)
}

// Helper: Get relationship label
function getRelationshipLabel(value: string): string {
  const option = RELATIONSHIP_OPTIONS.find((r: { value: string; label: string }) => r.value === value)
  return option?.label || value
}

// Summary Card component
interface SummaryCardProps {
  title: string
  icon: React.ElementType
  items: { label: string; value: string; isTag?: boolean; isEmpty?: boolean }[]
  horizontal?: boolean
}

function SummaryCard({ title, icon: Icon, items, horizontal }: SummaryCardProps) {
  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>

      {horizontal ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) =>
            item.isTag ? (
              <span
                key={i}
                className="px-2.5 py-1 text-xs font-medium bg-primary-light text-primary rounded-full flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {item.value}
              </span>
            ) : item.isEmpty ? (
              <span key={i} className="text-sm text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {item.value}
              </span>
            ) : (
              <span key={i} className="text-sm text-muted-foreground">
                {item.value}
              </span>
            )
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              {item.label && (
                <span className="text-muted-foreground">{item.label}</span>
              )}
              <span className={cn('text-foreground', item.label && 'font-medium')}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
