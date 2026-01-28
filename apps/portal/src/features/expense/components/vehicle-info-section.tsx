/**
 * VehicleInfoSection Component
 * Conditional section for vehicle information (Part IV of Schedule C)
 * Only shown if car expenses or mileage are claimed
 */
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { VEHICLE_FIELDS } from '../lib/expense-categories'
import { ExpenseField } from './expense-field'

interface VehicleInfoSectionProps {
  formData: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
}

export function VehicleInfoSection({
  formData,
  onChange,
}: VehicleInfoSectionProps) {
  // Determine if vehicle section should be shown
  const hasCarExpenses = useMemo(() => {
    const carExpense = formData.carExpense
    const vehicleMiles = formData.vehicleMiles
    return (
      (carExpense !== null && carExpense !== undefined && carExpense !== 0) ||
      (vehicleMiles !== null && vehicleMiles !== undefined && vehicleMiles !== 0)
    )
  }, [formData.carExpense, formData.vehicleMiles])

  // Don't render if no car expenses
  if (!hasCarExpenses) {
    return null
  }

  // Filter out vehicleMiles since it's handled in CarExpenseSection
  const vehicleInfoFields = VEHICLE_FIELDS.filter(
    f => f.field !== 'vehicleMiles'
  )

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <span aria-hidden="true">📝</span>
          Thông tin xe (Part IV)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Thông tin bổ sung cho IRS nếu bạn khấu trừ chi phí xe
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date in service */}
        <div>
          {vehicleInfoFields
            .filter(f => f.type === 'date')
            .map((field) => (
              <ExpenseField
                key={field.field}
                category={field}
                value={formData[field.field] as string | null}
                onChange={(value) => onChange(field.field, value)}
              />
            ))}
        </div>

        {/* Mileage breakdown */}
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicleInfoFields
            .filter(f => f.type === 'integer')
            .map((field) => (
              <ExpenseField
                key={field.field}
                category={field}
                value={formData[field.field] as number | null}
                onChange={(value) => onChange(field.field, value)}
              />
            ))}
        </div>

        {/* Yes/No questions */}
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-foreground">
            Câu hỏi bổ sung:
          </p>

          {/* vehicleUsedForCommute */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.vehicleUsedForCommute === true}
              onChange={(e) => onChange('vehicleUsedForCommute', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-foreground">
              Xe có được dùng để đi làm (commute) không?
            </span>
          </label>

          {/* vehicleAnotherAvailable */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.vehicleAnotherAvailable === true}
              onChange={(e) => onChange('vehicleAnotherAvailable', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-foreground">
              Bạn có xe khác cho mục đích cá nhân không?
            </span>
          </label>

          {/* vehicleEvidenceWritten */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.vehicleEvidenceWritten === true}
              onChange={(e) => onChange('vehicleEvidenceWritten', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-foreground">
              Bạn có ghi chép bằng văn bản về số dặm kinh doanh không?
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
