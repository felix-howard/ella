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

// Filing status labels
const FILING_STATUS_LABELS: Record<string, string> = {
  SINGLE: 'Độc thân',
  MARRIED_FILING_JOINTLY: 'Vợ chồng khai chung',
  MARRIED_FILING_SEPARATELY: 'Vợ chồng khai riêng',
  HEAD_OF_HOUSEHOLD: 'Chủ hộ',
  QUALIFYING_WIDOW: 'Góa phụ có con',
}

// Account type options
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'CHECKING', label: 'Checking (Tài khoản vãng lai)' },
  { value: 'SAVINGS', label: 'Savings (Tài khoản tiết kiệm)' },
]

export function WizardStep4Review({
  answers,
  onChange,
  filingStatus,
  taxYear,
  errors,
}: WizardStep4ReviewProps) {
  const showSpouse = filingStatus === 'MARRIED_FILING_JOINTLY'
  const hasDependents = (answers.dependentCount || 0) > 0

  // Get selected income items
  const selectedIncome = getSelectedItems(answers, [
    { key: 'hasW2', label: 'W-2' },
    { key: 'has1099NEC', label: '1099-NEC' },
    { key: 'hasSelfEmployment', label: 'Tự kinh doanh' },
    { key: 'hasInvestments', label: 'Đầu tư' },
    { key: 'hasCrypto', label: 'Crypto' },
    { key: 'hasRetirement', label: 'Hưu trí' },
    { key: 'hasSocialSecurity', label: 'Social Security' },
    { key: 'hasRentalProperty', label: 'Cho thuê BĐS' },
    { key: 'hasK1Income', label: 'K-1' },
  ])

  // Get selected deduction items
  const selectedDeductions = getSelectedItems(answers, [
    { key: 'hasMortgage', label: 'Mortgage' },
    { key: 'hasPropertyTax', label: 'Property Tax' },
    { key: 'hasMedicalExpenses', label: 'Chi phí y tế' },
    { key: 'hasCharitableDonations', label: 'Từ thiện' },
    { key: 'hasStudentLoanInterest', label: 'Student Loan' },
    { key: 'hasEducatorExpenses', label: 'Educator Expenses' },
    { key: 'hasHSA', label: 'HSA' },
  ])

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Xem lại & Hoàn tất</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Kiểm tra thông tin và nhập thông tin ngân hàng để nhận refund
        </p>
      </div>

      {/* Bank Info Section */}
      <section className="p-5 bg-primary/5 rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary-light">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <h4 className="text-base font-semibold text-foreground">
            Thông tin ngân hàng (nhận refund)
          </h4>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Account Type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Loại tài khoản
            </label>
            <CustomSelect
              value={answers.refundAccountType || ''}
              onChange={(value) => onChange('refundAccountType', value)}
              options={ACCOUNT_TYPE_OPTIONS}
              placeholder="Chọn loại tài khoản..."
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
              placeholder="9 chữ số"
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
                Vui lòng xác nhận routing number với ngân hàng của bạn
              </p>
            )}
          </div>

          {/* Account Number */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-foreground">
              Số tài khoản
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
              placeholder="Số tài khoản ngân hàng"
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
            Để trống nếu muốn nhận check qua đường bưu điện
          </p>
        )}
      </section>

      {/* Summary Section */}
      <section>
        <h4 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Tóm tắt thông tin
        </h4>

        <div className="space-y-4">
          {/* Tax Info Card */}
          <SummaryCard
            title="Thông tin chung"
            icon={FileText}
            items={[
              { label: 'Năm thuế', value: String(taxYear) },
              { label: 'Tình trạng', value: FILING_STATUS_LABELS[filingStatus] || filingStatus },
            ]}
          />

          {/* Taxpayer Card */}
          <SummaryCard
            title="Người khai thuế"
            icon={User}
            items={[
              { label: 'SSN', value: answers.taxpayerSSN ? maskSSN(answers.taxpayerSSN) : 'Chưa nhập' },
              { label: 'Ngày sinh', value: answers.taxpayerDOB || 'Chưa nhập' },
              { label: 'Nghề nghiệp', value: answers.taxpayerOccupation || 'Chưa nhập' },
            ]}
          />

          {/* Spouse Card (conditional) */}
          {showSpouse && (
            <SummaryCard
              title="Vợ/Chồng"
              icon={Users}
              items={[
                { label: 'SSN', value: answers.spouseSSN ? maskSSN(answers.spouseSSN) : 'Chưa nhập' },
                { label: 'Ngày sinh', value: answers.spouseDOB || 'Chưa nhập' },
                { label: 'Nghề nghiệp', value: answers.spouseOccupation || 'Chưa nhập' },
              ]}
            />
          )}

          {/* Dependents Card (conditional) */}
          {hasDependents && (
            <SummaryCard
              title={`Người phụ thuộc (${answers.dependentCount})`}
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
            title="Thu nhập"
            icon={Briefcase}
            items={
              selectedIncome.length > 0
                ? selectedIncome.map((item) => ({
                    label: '',
                    value: item,
                    isTag: true,
                  }))
                : [{ label: '', value: 'Không có thu nhập nào được chọn', isEmpty: true }]
            }
            horizontal
          />

          {/* Deductions Card */}
          <SummaryCard
            title="Khấu trừ"
            icon={Receipt}
            items={
              selectedDeductions.length > 0
                ? selectedDeductions.map((item) => ({
                    label: '',
                    value: item,
                    isTag: true,
                  }))
                : [{ label: '', value: 'Không có khấu trừ nào được chọn', isEmpty: true }]
            }
            horizontal
          />
        </div>
      </section>

      {/* Notes Section */}
      <section>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Ghi chú thêm (tùy chọn)
        </label>
        <textarea
          value={answers.followUpNotes || ''}
          onChange={(e) => onChange('followUpNotes', e.target.value.slice(0, MAX_NOTES_LENGTH))}
          placeholder="Thông tin bổ sung hoặc câu hỏi cho CPA..."
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
            {answers.followUpNotes?.length ?? 0}/{MAX_NOTES_LENGTH} ký tự
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
  const option = RELATIONSHIP_OPTIONS.find((r) => r.value === value)
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
