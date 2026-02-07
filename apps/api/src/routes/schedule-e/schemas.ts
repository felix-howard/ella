/**
 * Schedule E Zod Validation Schemas
 * Used for validating rental property form data
 */
import { z } from 'zod'

// Property address schema
const addressSchema = z.object({
  street: z.string().min(1, 'Street is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'State must be 2 characters'),
  zip: z.string().regex(/^[0-9]{5}(-[0-9]{4})?$/, 'Invalid ZIP code format')
    .refine((zip) => !zip.startsWith('00'), 'Invalid ZIP code - cannot start with 00'),
})

// Other expense schema
const otherExpenseSchema = z.object({
  name: z.string().min(1, 'Expense name is required').max(100),
  amount: z.number().min(0, 'Amount must be non-negative'),
})

// IRS property types (excluding 6 = Royalties)
const propertyTypeSchema = z.union([
  z.literal(1), // Single Family Residence
  z.literal(2), // Multi-Family Residence
  z.literal(3), // Vacation/Short-Term Rental
  z.literal(4), // Commercial
  z.literal(5), // Land
  z.literal(7), // Self-Rental
  z.literal(8), // Other
])

// Property ID
const propertyIdSchema = z.enum(['A', 'B', 'C'])

// Single property schema
export const scheduleEPropertySchema = z.object({
  id: propertyIdSchema,
  address: addressSchema,
  propertyType: propertyTypeSchema,
  propertyTypeOther: z.string().max(100).optional().nullable(),

  // Rental period
  monthsRented: z.number().min(0).max(12),
  fairRentalDays: z.number().min(0).max(365),
  personalUseDays: z.number().min(0).max(365),

  // Income
  rentsReceived: z.number().min(0),

  // Expenses (7 IRS fields)
  insurance: z.number().min(0),
  mortgageInterest: z.number().min(0),
  repairs: z.number().min(0),
  taxes: z.number().min(0),
  utilities: z.number().min(0),
  managementFees: z.number().min(0),
  cleaningMaintenance: z.number().min(0),

  // Custom expenses
  otherExpenses: z.array(otherExpenseSchema).max(20).default([]),

  // Calculated totals
  totalExpenses: z.number().min(0),
  netIncome: z.number(),
}).refine(
  (data) => {
    // If propertyType is 8 (Other), propertyTypeOther is required
    if (data.propertyType === 8) {
      return data.propertyTypeOther && data.propertyTypeOther.length > 0
    }
    return true
  },
  {
    message: 'Property type description is required when type is "Other"',
    path: ['propertyTypeOther'],
  }
)

// Full form schema for submit (1-3 properties)
export const scheduleEFormSchema = z.object({
  properties: z.array(scheduleEPropertySchema).min(1).max(3),
})

// Draft schema - all fields optional for partial saves
export const scheduleEDraftSchema = z.object({
  properties: z.array(
    z.object({
      id: propertyIdSchema.optional(),
      address: z.object({
        street: z.string().max(200).optional().default(''),
        city: z.string().max(100).optional().default(''),
        state: z.string().max(2).optional().default(''),
        zip: z.string().max(10).optional().default(''),
      }).optional(),
      propertyType: propertyTypeSchema.optional(),
      propertyTypeOther: z.string().max(100).optional().nullable(),
      monthsRented: z.number().min(0).max(12).optional(),
      fairRentalDays: z.number().min(0).max(365).optional(),
      personalUseDays: z.number().min(0).max(365).optional(),
      rentsReceived: z.number().min(0).optional(),
      insurance: z.number().min(0).optional(),
      mortgageInterest: z.number().min(0).optional(),
      repairs: z.number().min(0).optional(),
      taxes: z.number().min(0).optional(),
      utilities: z.number().min(0).optional(),
      managementFees: z.number().min(0).optional(),
      cleaningMaintenance: z.number().min(0).optional(),
      otherExpenses: z.array(otherExpenseSchema).max(20).optional(),
      totalExpenses: z.number().min(0).optional(),
      netIncome: z.number().optional(),
    })
  ).max(3).optional(),
})

// Type exports
export type ScheduleEPropertyInput = z.infer<typeof scheduleEPropertySchema>
export type ScheduleEFormInput = z.infer<typeof scheduleEFormSchema>
export type ScheduleEDraftInput = z.infer<typeof scheduleEDraftSchema>
