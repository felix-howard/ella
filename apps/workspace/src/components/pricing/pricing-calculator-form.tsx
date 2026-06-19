import type { PayrollMode, PricingCalculatorInput } from '@ella/shared/pricing'
import { PAYROLL } from '@ella/shared/constants'
import { Calculator, ShieldCheck, Store, WalletCards, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Input, SelectField, Switch } from '@ella/ui'
import { clampWholeNumber, formatCurrency } from './pricing-format'

interface PricingCalculatorFormProps {
  input: PricingCalculatorInput
  disabled?: boolean
  onInputChange: (input: PricingCalculatorInput) => void
}

type TopQuantityKey = 'nec1099Count' | 'payrollEmployees' | 'salesTaxShops'
type RateObjectGroup = 'tiers' | 'payroll' | 'cashPlan' | 'auditProtection' | 'oneTime'
type SingleOneTimeKey = Exclude<keyof PricingCalculatorInput['oneTime'], 'businessTaxReturn'>
type OneTimeRow =
  | {
      kind: 'single'
      key: SingleOneTimeKey
      label: string
      hint?: string
    }
  | {
      kind: 'business'
      key: 'businessTaxReturn'
      label: string
      hint?: string
    }

const oneTimeRows: OneTimeRow[] = [
  { kind: 'single', key: 'startLlc', label: 'Start LLC', hint: 'Excludes state filing fee' },
  { kind: 'single', key: 'holdingLlcNew', label: 'Holding LLC (new)' },
  { kind: 'single', key: 'holdingLlcModify', label: 'Re-structure LLC basic' },
  { kind: 'single', key: 'personalTaxReturn', label: 'Personal tax return' },
  { kind: 'business', key: 'businessTaxReturn', label: 'Business tax return' },
]

const numberInputClass =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export function PricingCalculatorForm({
  input,
  disabled = false,
  onInputChange,
}: PricingCalculatorFormProps) {
  const hasOneTimeSelection = Object.values(input.oneTime).some((quantity) => quantity > 0)
  const [oneTimeManuallyEnabled, setOneTimeManuallyEnabled] = useState(false)
  const oneTimeEnabled = oneTimeManuallyEnabled || hasOneTimeSelection

  const setQuantity = (key: TopQuantityKey, value: string, max = 1000) => {
    onInputChange({ ...input, [key]: clampWholeNumber(value, max) })
  }
  const setRate = <T extends RateObjectGroup>(
    group: T,
    key: keyof PricingCalculatorInput['rates'][T],
    value: string
  ) => {
    onInputChange({
      ...input,
      rates: {
        ...input.rates,
        [group]: {
          ...input.rates[group],
          [key]: clampWholeNumber(value, 1_000_000),
        },
      },
    })
  }
  const handleOneTimeToggle = (enabled: boolean) => {
    setOneTimeManuallyEnabled(enabled)
    if (enabled) return
    onInputChange({
      ...input,
      oneTime: {
        startLlc: 0,
        holdingLlcNew: 0,
        holdingLlcModify: 0,
        personalTaxReturn: 0,
        businessTaxReturn: 0,
      },
    })
  }

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
        <FormSection icon={Calculator} title="Monthly services">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="pricing-nec-count"
              label="1099 NEC workers"
              value={input.nec1099Count}
              hint="0-10 Basic, 11-20 Pro, 21+ VIP"
              max={200}
              onChange={(value) => setQuantity('nec1099Count', value, 200)}
            />
            <NumberField
              id="pricing-payroll-employees"
              label="W-2 payroll employees"
              value={input.payrollEmployees}
              hint="Leave at 0 if no payroll"
              max={200}
              onChange={(value) => setQuantity('payrollEmployees', value, 200)}
            />
          </div>
          <SelectField
            label="Who runs payroll?"
            disabled={disabled}
            value={input.payrollMode}
            onChange={(event) =>
              onInputChange({ ...input, payrollMode: event.target.value as PayrollMode })
            }
            options={[
              {
                value: 'owner-manual',
                label: `Owner runs payroll (${formatCurrency(PAYROLL.ownerManualPerEmp)}/emp)`,
              },
              {
                value: 'ella-staff',
                label: `Ella staff runs payroll (${formatCurrency(PAYROLL.ellaStaffPerEmp)}/emp)`,
              },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RateField
              label="Basic / mo"
              value={input.rates.tiers.basicMonthly}
              onChange={(value) => setRate('tiers', 'basicMonthly', value)}
            />
            <RateField
              label="Pro / mo"
              value={input.rates.tiers.proMonthly}
              onChange={(value) => setRate('tiers', 'proMonthly', value)}
            />
            <RateField
              label="VIP / mo"
              value={input.rates.tiers.vipMonthly}
              onChange={(value) => setRate('tiers', 'vipMonthly', value)}
            />
            <RateField
              label="Payroll base / mo"
              value={input.rates.payroll.baseMonthly}
              onChange={(value) => setRate('payroll', 'baseMonthly', value)}
            />
          </div>
        </FormSection>

        <FormSection icon={WalletCards} title="Cash Plan">
          <SwitchRow
            label="Enable Cash Plan"
            checked={input.cashPlan.enabled}
            onCheckedChange={(enabled) =>
              onInputChange({ ...input, cashPlan: { ...input.cashPlan, enabled } })
            }
          />
          {input.cashPlan.enabled && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  id="pricing-cash-employees"
                  label="Employees enrolled"
                  value={input.cashPlan.employees}
                  max={200}
                  onChange={(value) =>
                    onInputChange({
                      ...input,
                      cashPlan: { ...input.cashPlan, employees: clampWholeNumber(value, 200) },
                    })
                  }
                />
                <NumberField
                  id="pricing-cash-owners"
                  label="Owners / shareholders"
                  value={input.cashPlan.owners}
                  max={99}
                  onChange={(value) =>
                    onInputChange({
                      ...input,
                      cashPlan: { ...input.cashPlan, owners: clampWholeNumber(value, 99) },
                    })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <RateField
                  label="Setup"
                  value={input.rates.cashPlan.setup}
                  onChange={(value) => setRate('cashPlan', 'setup', value)}
                />
                <RateField
                  label="Per employee / mo"
                  value={input.rates.cashPlan.perEmployeeMonthly}
                  onChange={(value) => setRate('cashPlan', 'perEmployeeMonthly', value)}
                />
                <RateField
                  label="Per owner / mo"
                  value={input.rates.cashPlan.perOwnerMonthly}
                  onChange={(value) => setRate('cashPlan', 'perOwnerMonthly', value)}
                />
              </div>
            </>
          )}
        </FormSection>

        <FormSection icon={ShieldCheck} title="Early IRS Detection">
          <SwitchRow
            label="Enable Audit Detection"
            checked={input.auditProtection}
            onCheckedChange={(auditProtection) => onInputChange({ ...input, auditProtection })}
          />
          {input.auditProtection && (
            <div className="grid gap-3 sm:grid-cols-2">
              <RateField
                label="Audit / mo"
                value={input.rates.auditProtection.monthly}
                onChange={(value) => setRate('auditProtection', 'monthly', value)}
              />
              <RateField
                label="Audit setup"
                value={input.rates.auditProtection.setup}
                onChange={(value) => setRate('auditProtection', 'setup', value)}
              />
            </div>
          )}
        </FormSection>

        <FormSection icon={Store} title="One-time services">
          <SwitchRow
            label="Enable One-time services"
            checked={oneTimeEnabled}
            onCheckedChange={handleOneTimeToggle}
          />
          {oneTimeEnabled && (
            <div className="space-y-3">
              {oneTimeRows.map((row) => (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]">
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {row.kind === 'business' ? (
                        <>
                          <RateField
                            compact
                            label="Federal"
                            value={input.rates.oneTime.businessTaxReturnFederal}
                            onChange={(value) =>
                              setRate('oneTime', 'businessTaxReturnFederal', value)
                            }
                          />
                          <RateField
                            compact
                            label="State"
                            value={input.rates.oneTime.businessTaxReturnState}
                            onChange={(value) =>
                              setRate('oneTime', 'businessTaxReturnState', value)
                            }
                          />
                        </>
                      ) : (
                        <RateField
                          compact
                          label="Rate"
                          value={input.rates.oneTime[row.key]}
                          onChange={(value) => setRate('oneTime', row.key, value)}
                        />
                      )}
                      {row.hint && <span>{row.hint}</span>}
                    </div>
                  </div>
                  <NumberField
                    id={`pricing-onetime-${row.key}`}
                    label="Qty"
                    value={input.oneTime[row.key]}
                    max={99}
                    onChange={(value) =>
                      onInputChange({
                        ...input,
                        oneTime: { ...input.oneTime, [row.key]: clampWholeNumber(value, 99) },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection icon={Store} title="Sales tax monitoring">
          <NumberField
            id="pricing-sales-tax-shops"
            label="Shops monitored"
            value={input.salesTaxShops}
            max={200}
            onChange={(value) => setQuantity('salesTaxShops', value, 200)}
          />
          <RateField
            label="Per shop / mo"
            value={input.rates.salesTaxMonitoringMonthly}
            onChange={(value) =>
              onInputChange({
                ...input,
                rates: {
                  ...input.rates,
                  salesTaxMonitoringMonthly: clampWholeNumber(value, 1_000_000),
                },
              })
            }
          />
        </FormSection>
      </fieldset>
    </form>
  )
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  hint,
  max,
  disabled = false,
}: {
  id: string
  label: string
  value: number
  onChange: (value: string) => void
  hint?: string
  max: number
  disabled?: boolean
}) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-foreground">
      {label}
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        inputMode="numeric"
        value={value === 0 ? '' : value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 ${numberInputClass}`}
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

function RateField({
  label,
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (value: string) => void
  compact?: boolean
  disabled?: boolean
}) {
  return (
    <label
      className={
        compact ? 'inline-flex items-center gap-1' : 'block text-xs font-medium text-foreground'
      }
    >
      {label}
      <Input
        aria-label={`${label} rate`}
        type="text"
        inputMode="numeric"
        // Show money fields as "$1,000" for clarity; strip back to digits on
        // change so the parent keeps a plain numeric value.
        value={value === 0 ? '' : formatCurrency(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ''))}
        className={
          compact ? `h-8 w-24 px-2 text-xs ${numberInputClass}` : `mt-1 ${numberInputClass}`
        }
      />
    </label>
  )
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  )
}
