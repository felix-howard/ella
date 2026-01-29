/**
 * Schedule C API Validation Schemas
 * Zod schemas for staff endpoints (schedule-c routes)
 */
import { z } from 'zod'

// Schedule C expense input schema (for creating/updating)
export const scheduleCExpenseSchema = z.object({
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

export type ScheduleCExpenseInput = z.infer<typeof scheduleCExpenseSchema>

// Response schema for Schedule C data
export const scheduleCResponseSchema = z.object({
  expense: z.object({
    id: z.string(),
    taxCaseId: z.string(),
    status: z.enum(['DRAFT', 'SUBMITTED', 'LOCKED']),
    version: z.number(),
    businessName: z.string().nullable(),
    businessDesc: z.string().nullable(),
    // ... all fields
    createdAt: z.string(),
    updatedAt: z.string(),
    submittedAt: z.string().nullable(),
    lockedAt: z.string().nullable(),
  }).nullable(),
  magicLink: z.object({
    id: z.string(),
    token: z.string(),
    isActive: z.boolean(),
    expiresAt: z.string().nullable(),
    lastUsedAt: z.string().nullable(),
    usageCount: z.number(),
  }).nullable(),
  totals: z.object({
    grossReceipts: z.string(),
    returns: z.string(),
    costOfGoods: z.string(),
    grossIncome: z.string(),
    totalExpenses: z.string(),
    mileageDeduction: z.string(),
    netProfit: z.string(),
  }).nullable(),
})

// Send form response
export const sendFormResponseSchema = z.object({
  success: z.boolean(),
  magicLink: z.string(),
  messageSent: z.boolean(),
  expiresAt: z.string(),
})

// Lock form response
export const lockFormResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(['LOCKED']),
  lockedAt: z.string(),
})

// Resend form response
export const resendFormResponseSchema = z.object({
  success: z.boolean(),
  expiresAt: z.string(),
  messageSent: z.boolean(),
})
