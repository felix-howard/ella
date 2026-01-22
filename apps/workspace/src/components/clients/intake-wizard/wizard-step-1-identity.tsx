/**
 * WizardStep1Identity - Identity information step
 * Taxpayer, spouse (conditional on MFJ), and dependents
 */

import { cn } from '@ella/ui'
import { User, Users, Baby } from 'lucide-react'
import { CustomSelect } from '../../ui/custom-select'
import { US_STATES_OPTIONS } from '../../../lib/intake-form-config'
import { formatSSNInput } from '../../../lib/crypto'
import { DependentGrid } from './dependent-grid'
import {
  FORMATTED_SSN_LENGTH,
  IP_PIN_LENGTH,
  MAX_DEPENDENTS,
  MIN_DOB_YEAR,
  MAX_OCCUPATION_LENGTH,
  MAX_DL_NUMBER_LENGTH,
  getTodayDateString,
} from './wizard-constants'
import type { IntakeAnswers, DependentData } from './wizard-container'

interface WizardStep1IdentityProps {
  answers: IntakeAnswers
  onChange: (key: string, value: unknown) => void
  filingStatus: string
  errors?: Record<string, string>
}

export function WizardStep1Identity({
  answers,
  onChange,
  filingStatus,
  errors,
}: WizardStep1IdentityProps) {
  // Show spouse section only for MFJ
  const showSpouseSection = filingStatus === 'MARRIED_FILING_JOINTLY'
  const dependentCount = answers.dependentCount || 0

  // Handle dependent count change
  const handleDependentCountChange = (count: number) => {
    onChange('dependentCount', count)
    // Trim dependents array if count reduced
    if (answers.dependents && answers.dependents.length > count) {
      onChange('dependents', answers.dependents.slice(0, count))
    }
  }

  // Handle dependents array change
  const handleDependentsChange = (dependents: DependentData[]) => {
    onChange('dependents', dependents)
  }

  return (
    <div className="space-y-6">
      {/* Section: Taxpayer Info */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary-light">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Thông tin người khai thuế
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* SSN */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Số An sinh Xã hội (SSN)
            </label>
            <input
              type="text"
              value={answers.taxpayerSSN || ''}
              onChange={(e) => onChange('taxpayerSSN', formatSSNInput(e.target.value))}
              placeholder="123-45-6789"
              maxLength={FORMATTED_SSN_LENGTH}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                errors?.taxpayerSSN ? 'border-error' : 'border-border'
              )}
            />
            {errors?.taxpayerSSN && (
              <p className="text-sm text-error">{errors.taxpayerSSN}</p>
            )}
          </div>

          {/* DOB */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Ngày sinh
            </label>
            <input
              type="date"
              value={answers.taxpayerDOB || ''}
              onChange={(e) => onChange('taxpayerDOB', e.target.value)}
              min={MIN_DOB_YEAR}
              max={getTodayDateString()}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'border-border'
              )}
            />
          </div>

          {/* Occupation */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-sm font-medium text-foreground">
              Nghề nghiệp
            </label>
            <input
              type="text"
              value={answers.taxpayerOccupation || ''}
              onChange={(e) => onChange('taxpayerOccupation', e.target.value.slice(0, MAX_OCCUPATION_LENGTH))}
              placeholder="VD: Kỹ sư phần mềm"
              maxLength={MAX_OCCUPATION_LENGTH}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'border-border'
              )}
            />
          </div>

          {/* Driver's License Number */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Số bằng lái xe
            </label>
            <input
              type="text"
              value={answers.taxpayerDLNumber || ''}
              onChange={(e) => onChange('taxpayerDLNumber', e.target.value.slice(0, MAX_DL_NUMBER_LENGTH))}
              placeholder="Số trên bằng lái"
              maxLength={MAX_DL_NUMBER_LENGTH}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'border-border'
              )}
            />
          </div>

          {/* DL State */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Tiểu bang cấp bằng lái
            </label>
            <CustomSelect
              value={answers.taxpayerDLState || ''}
              onChange={(value) => onChange('taxpayerDLState', value)}
              options={US_STATES_OPTIONS}
              placeholder="Chọn tiểu bang..."
            />
          </div>

          {/* DL Issue Date */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Ngày cấp bằng lái
            </label>
            <input
              type="date"
              value={answers.taxpayerDLIssueDate || ''}
              onChange={(e) => onChange('taxpayerDLIssueDate', e.target.value)}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'border-border'
              )}
            />
          </div>

          {/* DL Exp Date */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Ngày hết hạn bằng lái
            </label>
            <input
              type="date"
              value={answers.taxpayerDLExpDate || ''}
              onChange={(e) => onChange('taxpayerDLExpDate', e.target.value)}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'border-border'
              )}
            />
          </div>

          {/* IP PIN */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              IP PIN (6 số)
              <span className="ml-1 text-xs text-muted-foreground">(nếu có)</span>
            </label>
            <input
              type="text"
              value={answers.taxpayerIPPIN || ''}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, IP_PIN_LENGTH)
                onChange('taxpayerIPPIN', digits)
              }}
              placeholder="6 chữ số"
              maxLength={IP_PIN_LENGTH}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'border-border'
              )}
            />
          </div>
        </div>
      </section>

      {/* Section: Spouse Info (conditional) */}
      {showSpouseSection && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-accent-light">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Thông tin vợ/chồng
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Spouse SSN */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                SSN vợ/chồng
              </label>
              <input
                type="text"
                value={answers.spouseSSN || ''}
                onChange={(e) => onChange('spouseSSN', formatSSNInput(e.target.value))}
                placeholder="123-45-6789"
                maxLength={FORMATTED_SSN_LENGTH}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  errors?.spouseSSN ? 'border-error' : 'border-border'
                )}
              />
              {errors?.spouseSSN && (
                <p className="text-sm text-error">{errors.spouseSSN}</p>
              )}
            </div>

            {/* Spouse DOB */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Ngày sinh vợ/chồng
              </label>
              <input
                type="date"
                value={answers.spouseDOB || ''}
                onChange={(e) => onChange('spouseDOB', e.target.value)}
                min={MIN_DOB_YEAR}
                max={getTodayDateString()}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </div>

            {/* Spouse Occupation */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-foreground">
                Nghề nghiệp vợ/chồng
              </label>
              <input
                type="text"
                value={answers.spouseOccupation || ''}
                onChange={(e) => onChange('spouseOccupation', e.target.value.slice(0, MAX_OCCUPATION_LENGTH))}
                placeholder="VD: Y tá"
                maxLength={MAX_OCCUPATION_LENGTH}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </div>

            {/* Spouse DL Number */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Số bằng lái vợ/chồng
              </label>
              <input
                type="text"
                value={answers.spouseDLNumber || ''}
                onChange={(e) => onChange('spouseDLNumber', e.target.value.slice(0, MAX_DL_NUMBER_LENGTH))}
                placeholder="Số trên bằng lái"
                maxLength={MAX_DL_NUMBER_LENGTH}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </div>

            {/* Spouse DL State */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Tiểu bang cấp (vợ/chồng)
              </label>
              <CustomSelect
                value={answers.spouseDLState || ''}
                onChange={(value) => onChange('spouseDLState', value)}
                options={US_STATES_OPTIONS}
                placeholder="Chọn tiểu bang..."
              />
            </div>

            {/* Spouse DL Issue Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Ngày cấp (vợ/chồng)
              </label>
              <input
                type="date"
                value={answers.spouseDLIssueDate || ''}
                onChange={(e) => onChange('spouseDLIssueDate', e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </div>

            {/* Spouse DL Exp Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Ngày hết hạn (vợ/chồng)
              </label>
              <input
                type="date"
                value={answers.spouseDLExpDate || ''}
                onChange={(e) => onChange('spouseDLExpDate', e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </div>

            {/* Spouse IP PIN */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                IP PIN vợ/chồng
                <span className="ml-1 text-xs text-muted-foreground">(nếu có)</span>
              </label>
              <input
                type="text"
                value={answers.spouseIPPIN || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, IP_PIN_LENGTH)
                  onChange('spouseIPPIN', digits)
                }}
                placeholder="6 chữ số"
                maxLength={IP_PIN_LENGTH}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </div>
          </div>
        </section>
      )}

      {/* Section: Dependents */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-warning/10">
            <Baby className="w-5 h-5 text-warning" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Người phụ thuộc
          </h3>
        </div>

        {/* Dependent Count */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Số người phụ thuộc
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleDependentCountChange(Math.max(0, dependentCount - 1))}
              disabled={dependentCount === 0}
              className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
            <span className="w-12 text-center text-lg font-semibold text-foreground">
              {dependentCount}
            </span>
            <button
              type="button"
              onClick={() => handleDependentCountChange(Math.min(MAX_DEPENDENTS, dependentCount + 1))}
              disabled={dependentCount >= MAX_DEPENDENTS}
              className="w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        {/* Dependent Grid */}
        {dependentCount > 0 && (
          <DependentGrid
            dependents={answers.dependents || []}
            dependentCount={dependentCount}
            onChange={handleDependentsChange}
            errors={errors}
          />
        )}

        {dependentCount === 0 && (
          <p className="text-sm text-muted-foreground">
            Không có người phụ thuộc. Tăng số lượng nếu bạn có con hoặc người phụ thuộc khác.
          </p>
        )}
      </section>
    </div>
  )
}
