/**
 * PropertyDetailsStep Component
 * Step 2/4/6: Enter property address, type, and rental period
 */
import { memo, useCallback, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { ScheduleEProperty, ScheduleEPropertyType, ScheduleEPropertyAddress } from '@ella/shared'
import { PROPERTY_TYPES } from '../lib/rental-categories'
import { StateCombobox } from './state-combobox'

interface PropertyDetailsStepProps {
  property: ScheduleEProperty
  onUpdate: (data: Partial<ScheduleEProperty>) => void
  onNext: () => void
  onBack: () => void
  readOnly?: boolean
}

export const PropertyDetailsStep = memo(function PropertyDetailsStep({
  property,
  onUpdate,
  onNext,
  onBack,
  readOnly = false,
}: PropertyDetailsStepProps) {
  const { t } = useTranslation()

  // Local state for form values
  const [address, setAddress] = useState<ScheduleEPropertyAddress>(property.address)
  const [showStateError, setShowStateError] = useState(false)
  const [propertyType, setPropertyType] = useState<ScheduleEPropertyType>(property.propertyType)
  const [propertyTypeOther, setPropertyTypeOther] = useState(property.propertyTypeOther || '')
  const [monthsRented, setMonthsRented] = useState(String(property.monthsRented || ''))
  const [personalUseDays, setPersonalUseDays] = useState(String(property.personalUseDays || ''))
  const [rentsReceived, setRentsReceived] = useState(String(property.rentsReceived || ''))

  // Sync local state with property changes
  useEffect(() => {
    setAddress(property.address)
    setPropertyType(property.propertyType)
    setPropertyTypeOther(property.propertyTypeOther || '')
    setMonthsRented(String(property.monthsRented || ''))
    setPersonalUseDays(String(property.personalUseDays || ''))
    setRentsReceived(String(property.rentsReceived || ''))
  }, [property])

  // Update handlers
  const handleAddressChange = useCallback((field: keyof ScheduleEPropertyAddress, value: string) => {
    const newAddress = { ...address, [field]: value }
    setAddress(newAddress)
    onUpdate({ address: newAddress })
  }, [address, onUpdate])

  const handlePropertyTypeChange = useCallback((type: ScheduleEPropertyType) => {
    setPropertyType(type)
    onUpdate({ propertyType: type })
    if (type !== 8) {
      setPropertyTypeOther('')
      onUpdate({ propertyTypeOther: undefined })
    }
  }, [onUpdate])

  const handlePropertyTypeOtherChange = useCallback((value: string) => {
    setPropertyTypeOther(value)
    onUpdate({ propertyTypeOther: value })
  }, [onUpdate])

  const handleMonthsChange = useCallback((value: string) => {
    if (/^\d*$/.test(value)) {
      setMonthsRented(value)
      const num = parseInt(value, 10)
      if (!isNaN(num) && num >= 0 && num <= 12) {
        onUpdate({ monthsRented: num })
      } else if (value === '') {
        onUpdate({ monthsRented: 0 })
      }
    }
  }, [onUpdate])

  const handlePersonalDaysChange = useCallback((value: string) => {
    if (/^\d*$/.test(value)) {
      setPersonalUseDays(value)
      const num = parseInt(value, 10)
      if (!isNaN(num) && num >= 0) {
        onUpdate({ personalUseDays: num })
      } else if (value === '') {
        onUpdate({ personalUseDays: 0 })
      }
    }
  }, [onUpdate])

  const handleRentsChange = useCallback((value: string) => {
    // Allow: empty, digits only, or digits with decimal up to 2 places
    if (value === '' || /^\d+$/.test(value) || /^\d+\.\d{0,2}$/.test(value) || /^\d*\.$/.test(value)) {
      setRentsReceived(value)
      const num = parseFloat(value)
      if (!isNaN(num) && num >= 0) {
        onUpdate({ rentsReceived: num })
      } else if (value === '' || value === '.') {
        onUpdate({ rentsReceived: 0 })
      }
    }
  }, [onUpdate])

  // Calculate fair rental days
  const fairRentalDays = (parseInt(monthsRented, 10) || 0) * 30

  // Handle next with validation
  const handleNext = useCallback(() => {
    // Validate state is selected (must be 2 characters)
    if (!address.state || address.state.length !== 2) {
      setShowStateError(true)
      return
    }
    setShowStateError(false)
    onNext()
  }, [address.state, onNext])

  // Clear state error when state is selected
  const handleStateChange = useCallback((value: string) => {
    if (value && value.length === 2) {
      setShowStateError(false)
    }
    handleAddressChange('state', value)
  }, [handleAddressChange])

  return (
    <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {t('rental.propertyDetails', { id: property.id })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('rental.propertyDetailsDescription')}
        </p>
      </div>

      {/* Address section */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-medium text-foreground">{t('rental.address')}</h3>

        {/* Street */}
        <div>
          <label htmlFor="street" className="text-sm text-muted-foreground mb-1 block">
            {t('rental.street')}
          </label>
          <input
            id="street"
            type="text"
            value={address.street}
            onChange={(e) => handleAddressChange('street', e.target.value)}
            disabled={readOnly}
            placeholder={t('rental.streetPlaceholder')}
            className={cn(
              'w-full h-10 px-3 bg-card border border-border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>

        {/* City, State, ZIP */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-5">
            <label htmlFor="city" className="text-sm text-muted-foreground mb-1 block">
              {t('rental.city')}
            </label>
            <input
              id="city"
              type="text"
              value={address.city}
              onChange={(e) => handleAddressChange('city', e.target.value)}
              disabled={readOnly}
              placeholder={t('rental.cityPlaceholder')}
              className={cn(
                'w-full h-10 px-3 bg-card border border-border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>

          <div className="col-span-4">
            <label htmlFor="state" className="text-sm text-muted-foreground mb-1 block">
              {t('rental.state')}
            </label>
            <StateCombobox
              id="state"
              value={address.state}
              onChange={handleStateChange}
              disabled={readOnly}
              placeholder={t('rental.selectState')}
              error={showStateError}
            />
            {showStateError && (
              <p className="text-xs text-destructive mt-1">
                {t('rental.stateRequired')}
              </p>
            )}
          </div>

          <div className="col-span-3">
            <label htmlFor="zip" className="text-sm text-muted-foreground mb-1 block">
              {t('rental.zip')}
            </label>
            <input
              id="zip"
              type="text"
              value={address.zip}
              onChange={(e) => handleAddressChange('zip', e.target.value)}
              disabled={readOnly}
              placeholder="12345"
              maxLength={10}
              className={cn(
                'w-full h-10 px-3 bg-card border border-border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>
        </div>
      </div>

      {/* Property Type section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('rental.propertyType')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {PROPERTY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => !readOnly && handlePropertyTypeChange(type.value)}
              disabled={readOnly}
              className={cn(
                'p-3 text-left rounded-lg border transition-all text-sm',
                'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                propertyType === type.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card'
              )}
              aria-pressed={propertyType === type.value}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Other type input */}
        {propertyType === 8 && (
          <div className="mt-3">
            <input
              type="text"
              value={propertyTypeOther}
              onChange={(e) => handlePropertyTypeOtherChange(e.target.value)}
              disabled={readOnly}
              placeholder={t('rental.propertyTypeOtherPlaceholder')}
              className={cn(
                'w-full h-10 px-3 bg-card border border-border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>
        )}
      </div>

      {/* Rental Period section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('rental.rentalPeriod')}</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Months rented */}
          <div>
            <label htmlFor="monthsRented" className="text-sm text-muted-foreground mb-1 block">
              {t('rental.monthsRented')}
            </label>
            <div className="relative">
              <input
                id="monthsRented"
                type="text"
                inputMode="numeric"
                value={monthsRented}
                onChange={(e) => handleMonthsChange(e.target.value)}
                disabled={readOnly}
                placeholder="0-12"
                maxLength={2}
                className={cn(
                  'w-full h-10 px-3 bg-card border border-border rounded-lg text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
            </div>
            {fairRentalDays > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('rental.fairRentalDays', { days: fairRentalDays })}
              </p>
            )}
          </div>

          {/* Personal use days */}
          <div>
            <label htmlFor="personalUseDays" className="text-sm text-muted-foreground mb-1 block">
              {t('rental.personalUseDays')}
            </label>
            <input
              id="personalUseDays"
              type="text"
              inputMode="numeric"
              value={personalUseDays}
              onChange={(e) => handlePersonalDaysChange(e.target.value)}
              disabled={readOnly}
              placeholder="0"
              className={cn(
                'w-full h-10 px-3 bg-card border border-border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>
        </div>
      </div>

      {/* Rent Received section */}
      <div className="mb-6">
        <label htmlFor="rentsReceived" className="text-sm font-medium text-foreground mb-1 block">
          {t('rental.rentsReceived')}
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          {t('rental.rentsReceivedDescription')}
        </p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <input
            id="rentsReceived"
            type="text"
            inputMode="decimal"
            value={rentsReceived}
            onChange={(e) => handleRentsChange(e.target.value)}
            disabled={readOnly}
            placeholder="0.00"
            className={cn(
              'w-full h-10 pl-7 pr-3 bg-card border border-border rounded-lg text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="mt-auto pt-4 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 gap-2 h-12"
          size="lg"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('rental.back')}
        </Button>
        <Button
          onClick={handleNext}
          disabled={readOnly}
          className="flex-1 gap-2 h-12"
          size="lg"
        >
          {t('rental.next')}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
})

PropertyDetailsStep.displayName = 'PropertyDetailsStep'
