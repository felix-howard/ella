/**
 * Form Utilities
 * Shared utilities for expense form data handling
 */
import type { ExpenseFormInput } from './expense-api'

/**
 * Convert form data object to API input format
 * Used by both useExpenseForm and useAutoSave hooks
 */
export function toApiInput(data: Record<string, unknown>): ExpenseFormInput {
  // Convert date to ISO format if it's a simple YYYY-MM-DD
  let vehicleDateInService = data.vehicleDateInService as string | null
  if (vehicleDateInService && !vehicleDateInService.includes('T')) {
    // Add time component for ISO datetime format
    vehicleDateInService = `${vehicleDateInService}T00:00:00.000Z`
  }

  return {
    businessName: data.businessName as string | null,
    businessDesc: data.businessDesc as string | null,
    grossReceipts: data.grossReceipts as number | null,
    returns: data.returns as number | null,
    costOfGoods: data.costOfGoods as number | null,
    otherIncome: data.otherIncome as number | null,
    advertising: data.advertising as number | null,
    carExpense: data.carExpense as number | null,
    commissions: data.commissions as number | null,
    contractLabor: data.contractLabor as number | null,
    depletion: data.depletion as number | null,
    depreciation: data.depreciation as number | null,
    employeeBenefits: data.employeeBenefits as number | null,
    insurance: data.insurance as number | null,
    interestMortgage: data.interestMortgage as number | null,
    interestOther: data.interestOther as number | null,
    legalServices: data.legalServices as number | null,
    officeExpense: data.officeExpense as number | null,
    pensionPlans: data.pensionPlans as number | null,
    rentEquipment: data.rentEquipment as number | null,
    rentProperty: data.rentProperty as number | null,
    repairs: data.repairs as number | null,
    supplies: data.supplies as number | null,
    taxesAndLicenses: data.taxesAndLicenses as number | null,
    travel: data.travel as number | null,
    meals: data.meals as number | null,
    utilities: data.utilities as number | null,
    wages: data.wages as number | null,
    otherExpenses: data.otherExpenses as number | null,
    otherExpensesNotes: data.otherExpensesNotes as string | null,
    vehicleMiles: data.vehicleMiles as number | null,
    vehicleCommuteMiles: data.vehicleCommuteMiles as number | null,
    vehicleOtherMiles: data.vehicleOtherMiles as number | null,
    vehicleDateInService,
    vehicleUsedForCommute: data.vehicleUsedForCommute as boolean | undefined,
    vehicleAnotherAvailable: data.vehicleAnotherAvailable as boolean | undefined,
    vehicleEvidenceWritten: data.vehicleEvidenceWritten as boolean | undefined,
  }
}

/**
 * Validate date is within acceptable range
 * For vehicleDateInService: must be between 1980 and current year + 1
 */
export function validateDateRange(dateStr: string | null): string | null {
  if (!dateStr) return null

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return 'Ngày không hợp lệ'
  }

  const year = date.getFullYear()
  const currentYear = new Date().getFullYear()

  if (year < 1980) {
    return 'Năm phải từ 1980 trở đi'
  }

  if (year > currentYear + 1) {
    return 'Năm không được vượt quá năm sau'
  }

  return null
}
