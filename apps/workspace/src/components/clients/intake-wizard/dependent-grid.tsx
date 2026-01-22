/**
 * DependentGrid - Repeater component for dependent entries
 * Allows adding/removing dependents with validation
 */

import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { CustomSelect } from '../../ui/custom-select'
import { RELATIONSHIP_OPTIONS } from '../../../lib/intake-form-config'
import { formatSSNInput } from '../../../lib/crypto'
import {
  FORMATTED_SSN_LENGTH,
  MONTHS_IN_YEAR,
  MIN_DOB_YEAR,
  getTodayDateString,
} from './wizard-constants'
import type { DependentData } from './wizard-container'

interface DependentGridProps {
  dependents: DependentData[]
  dependentCount: number
  onChange: (dependents: DependentData[]) => void
  /** Errors map keyed by field name (e.g., dependent_0_ssn) */
  errors?: Record<string, string>
}

// Check if a dependent has all required fields filled
function isDependentComplete(dep: DependentData): boolean {
  return !!(
    dep.firstName?.trim() &&
    dep.lastName?.trim() &&
    dep.ssn?.replace(/\D/g, '').length === 9 &&
    dep.dob &&
    dep.relationship
  )
}

// Counter for unique ID generation to prevent collisions
let idCounter = 0

// Generate unique ID for new dependents
function generateId(): string {
  return `dep_${Date.now()}_${++idCounter}_${Math.random().toString(36).substr(2, 9)}`
}

// Create empty dependent template
function createEmptyDependent(): DependentData {
  return {
    id: generateId(),
    firstName: '',
    lastName: '',
    ssn: '',
    dob: '',
    relationship: '',
    monthsLivedInHome: 12,
  }
}

export function DependentGrid({
  dependents,
  dependentCount,
  onChange,
  errors,
}: DependentGridProps) {
  // Ensure we have the right number of dependent slots
  const currentDependents = [...dependents]
  while (currentDependents.length < dependentCount) {
    currentDependents.push(createEmptyDependent())
  }

  const handleFieldChange = (
    index: number,
    field: keyof DependentData,
    value: string | number
  ) => {
    const updated = [...currentDependents]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated.slice(0, dependentCount))
  }

  const handleRemove = (index: number) => {
    const updated = currentDependents.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleAdd = () => {
    const updated = [...currentDependents, createEmptyDependent()]
    onChange(updated)
  }

  if (dependentCount === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          Thông tin người phụ thuộc ({currentDependents.length}/{dependentCount})
        </h4>
        {currentDependents.length < dependentCount && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        )}
      </div>

      {errors?.dependents && (
        <p className="text-sm text-error">{errors.dependents}</p>
      )}

      <div className="space-y-4" role="list" aria-label="Danh sách người phụ thuộc">
        {currentDependents.slice(0, dependentCount).map((dependent, index) => (
          <DependentRow
            key={dependent.id}
            index={index}
            dependent={dependent}
            onFieldChange={(field, value) => handleFieldChange(index, field, value)}
            onRemove={() => handleRemove(index)}
            showRemove={currentDependents.length > 1}
            isComplete={isDependentComplete(dependent)}
            errors={errors}
          />
        ))}
      </div>
    </div>
  )
}

interface DependentRowProps {
  index: number
  dependent: DependentData
  onFieldChange: (field: keyof DependentData, value: string | number) => void
  onRemove: () => void
  showRemove: boolean
  isComplete: boolean
  errors?: Record<string, string>
}

function DependentRow({
  index,
  dependent,
  onFieldChange,
  onRemove,
  showRemove,
  isComplete,
  errors,
}: DependentRowProps) {
  // Get field-specific error
  const getFieldError = (field: string) => errors?.[`dependent_${index}_${field}`]

  return (
    <div
      className={cn(
        'p-4 rounded-lg border space-y-3',
        isComplete
          ? 'bg-primary/5 border-primary/30'
          : 'bg-muted/30 border-border'
      )}
      role="listitem"
      aria-label={`Người phụ thuộc ${index + 1}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Người phụ thuộc #{index + 1}
        </span>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-muted-foreground hover:text-error hover:bg-error-light rounded-lg transition-colors"
            aria-label="Xóa người phụ thuộc"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            htmlFor={`dep-${index}-firstName`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Tên <span className="text-error">*</span>
          </label>
          <input
            id={`dep-${index}-firstName`}
            type="text"
            value={dependent.firstName}
            onChange={(e) => onFieldChange('firstName', e.target.value)}
            placeholder="Tên"
            aria-invalid={!!getFieldError('firstName')}
            aria-describedby={getFieldError('firstName') ? `dep-${index}-firstName-error` : undefined}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-card text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              getFieldError('firstName') ? 'border-error' : 'border-border'
            )}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`dep-${index}-lastName`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Họ <span className="text-error">*</span>
          </label>
          <input
            id={`dep-${index}-lastName`}
            type="text"
            value={dependent.lastName}
            onChange={(e) => onFieldChange('lastName', e.target.value)}
            placeholder="Họ"
            aria-invalid={!!getFieldError('lastName')}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-card text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              getFieldError('lastName') ? 'border-error' : 'border-border'
            )}
          />
        </div>
      </div>

      {/* SSN and DOB row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            htmlFor={`dep-${index}-ssn`}
            className="block text-xs font-medium text-muted-foreground"
          >
            SSN <span className="text-error">*</span>
          </label>
          <input
            id={`dep-${index}-ssn`}
            type="text"
            value={dependent.ssn}
            onChange={(e) => onFieldChange('ssn', formatSSNInput(e.target.value))}
            placeholder="123-45-6789"
            maxLength={FORMATTED_SSN_LENGTH}
            aria-invalid={!!getFieldError('ssn')}
            aria-describedby={getFieldError('ssn') ? `dep-${index}-ssn-error` : undefined}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-card text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              getFieldError('ssn') ? 'border-error' : 'border-border'
            )}
          />
          {getFieldError('ssn') && (
            <p id={`dep-${index}-ssn-error`} className="text-xs text-error">
              {getFieldError('ssn')}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`dep-${index}-dob`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Ngày sinh <span className="text-error">*</span>
          </label>
          <input
            id={`dep-${index}-dob`}
            type="date"
            value={dependent.dob}
            onChange={(e) => onFieldChange('dob', e.target.value)}
            min={MIN_DOB_YEAR}
            max={getTodayDateString()}
            aria-invalid={!!getFieldError('dob')}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-card text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              getFieldError('dob') ? 'border-error' : 'border-border'
            )}
          />
        </div>
      </div>

      {/* Relationship and Months row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Quan hệ <span className="text-error">*</span>
          </label>
          <CustomSelect
            value={dependent.relationship}
            onChange={(value) => onFieldChange('relationship', value)}
            options={RELATIONSHIP_OPTIONS}
            placeholder="Chọn quan hệ..."
            error={!!getFieldError('relationship')}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`dep-${index}-months`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Số tháng sống chung <span className="text-error">*</span>
          </label>
          <input
            id={`dep-${index}-months`}
            type="number"
            min={0}
            max={MONTHS_IN_YEAR}
            value={dependent.monthsLivedInHome}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0
              onFieldChange('monthsLivedInHome', Math.max(0, Math.min(MONTHS_IN_YEAR, val)))
            }}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-card text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'border-border'
            )}
          />
        </div>
      </div>
    </div>
  )
}
