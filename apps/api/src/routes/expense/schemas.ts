/**
 * Public Expense Form Validation Schemas
 * Zod schemas for client-facing expense endpoints
 */
import { z } from 'zod'

// Expense submission schema (client input)
export const expenseSubmitSchema = z.object({
  // Business Information
  businessName: z.string().max(200).optional().nullable(),
  businessDesc: z.string().max(500).optional().nullable(),

  // Income Section
  grossReceipts: z.number().nonnegative().optional().nullable(),
  returns: z.number().nonnegative().optional().nullable(),
  costOfGoods: z.number().nonnegative().optional().nullable(),
  otherIncome: z.number().nonnegative().optional().nullable(),

  // Expenses (Part II)
  advertising: z.number().nonnegative().optional().nullable(),
  carExpense: z.number().nonnegative().optional().nullable(),
  commissions: z.number().nonnegative().optional().nullable(),
  contractLabor: z.number().nonnegative().optional().nullable(),
  depletion: z.number().nonnegative().optional().nullable(),
  depreciation: z.number().nonnegative().optional().nullable(),
  employeeBenefits: z.number().nonnegative().optional().nullable(),
  insurance: z.number().nonnegative().optional().nullable(),
  interestMortgage: z.number().nonnegative().optional().nullable(),
  interestOther: z.number().nonnegative().optional().nullable(),
  legalServices: z.number().nonnegative().optional().nullable(),
  officeExpense: z.number().nonnegative().optional().nullable(),
  pensionPlans: z.number().nonnegative().optional().nullable(),
  rentEquipment: z.number().nonnegative().optional().nullable(),
  rentProperty: z.number().nonnegative().optional().nullable(),
  repairs: z.number().nonnegative().optional().nullable(),
  supplies: z.number().nonnegative().optional().nullable(),
  taxesAndLicenses: z.number().nonnegative().optional().nullable(),
  travel: z.number().nonnegative().optional().nullable(),
  meals: z.number().nonnegative().optional().nullable(),
  utilities: z.number().nonnegative().optional().nullable(),
  wages: z.number().nonnegative().optional().nullable(),
  otherExpenses: z.number().nonnegative().optional().nullable(),
  otherExpensesNotes: z.string().max(1000).optional().nullable(),

  // Vehicle Information
  vehicleMiles: z.number().int().nonnegative().optional().nullable(),
  vehicleCommuteMiles: z.number().int().nonnegative().optional().nullable(),
  vehicleOtherMiles: z.number().int().nonnegative().optional().nullable(),
  vehicleDateInService: z.string().datetime().optional().nullable(),
  vehicleUsedForCommute: z.boolean().optional(),
  vehicleAnotherAvailable: z.boolean().optional(),
  vehicleEvidenceWritten: z.boolean().optional(),
})

export type ExpenseSubmitInput = z.infer<typeof expenseSubmitSchema>

// Draft save schema (same as submit but without version tracking)
export const expenseDraftSchema = expenseSubmitSchema
export type ExpenseDraftInput = z.infer<typeof expenseDraftSchema>
