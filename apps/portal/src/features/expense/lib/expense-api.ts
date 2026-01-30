/**
 * Expense Form API Client
 * Public endpoints for Schedule C expense collection
 */
import { ApiError } from '../../../lib/api-client'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// Expense form data types
export interface ExpenseClient {
  name: string
  language: 'VI' | 'EN'
}

export interface ExpenseTotals {
  grossReceipts: string
  returns: string
  costOfGoods: string
  grossIncome: string
  totalExpenses: string
  mileageDeduction: string
  netProfit: string
}

export interface ExpenseData {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED'
  version: number
  businessName: string | null
  businessDesc: string | null
  // Income
  grossReceipts: string | null
  returns: string | null
  costOfGoods: string | null
  otherIncome: string | null
  // Expenses
  advertising: string | null
  carExpense: string | null
  commissions: string | null
  contractLabor: string | null
  depletion: string | null
  depreciation: string | null
  employeeBenefits: string | null
  insurance: string | null
  interestMortgage: string | null
  interestOther: string | null
  legalServices: string | null
  officeExpense: string | null
  pensionPlans: string | null
  rentEquipment: string | null
  rentProperty: string | null
  repairs: string | null
  supplies: string | null
  taxesAndLicenses: string | null
  travel: string | null
  meals: string | null
  utilities: string | null
  wages: string | null
  otherExpenses: string | null
  otherExpensesNotes: string | null
  // Custom expenses (dynamic "Other" list)
  customExpenses: Array<{ name: string; amount: number }> | null
  // Vehicle info
  vehicleMiles: number | null
  vehicleCommuteMiles: number | null
  vehicleOtherMiles: number | null
  vehicleDateInService: string | null
  vehicleUsedForCommute: boolean
  vehicleAnotherAvailable: boolean
  vehicleEvidenceWritten: boolean
}

export interface ExpenseFormData {
  client: ExpenseClient
  taxYear: number
  expense: ExpenseData | null
  prefilledGrossReceipts: string
  totals: ExpenseTotals | null
}

export interface SubmitResponse {
  success: boolean
  version: number
  status: string
  message: string
}

export interface DraftResponse {
  success: boolean
  message: string
}

// Form data input type (for submission)
export interface ExpenseFormInput {
  businessName?: string | null
  businessDesc?: string | null
  grossReceipts?: number | null
  returns?: number | null
  costOfGoods?: number | null
  otherIncome?: number | null
  advertising?: number | null
  carExpense?: number | null
  commissions?: number | null
  contractLabor?: number | null
  depletion?: number | null
  depreciation?: number | null
  employeeBenefits?: number | null
  insurance?: number | null
  interestMortgage?: number | null
  interestOther?: number | null
  legalServices?: number | null
  officeExpense?: number | null
  pensionPlans?: number | null
  rentEquipment?: number | null
  rentProperty?: number | null
  repairs?: number | null
  supplies?: number | null
  taxesAndLicenses?: number | null
  travel?: number | null
  meals?: number | null
  utilities?: number | null
  wages?: number | null
  otherExpenses?: number | null
  otherExpensesNotes?: string | null
  customExpenses?: Array<{ name: string; amount: number }> | null
  vehicleMiles?: number | null
  vehicleCommuteMiles?: number | null
  vehicleOtherMiles?: number | null
  vehicleDateInService?: string | null
  vehicleUsedForCommute?: boolean
  vehicleAnotherAvailable?: boolean
  vehicleEvidenceWritten?: boolean
}

// HTTP request helper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.error || 'UNKNOWN_ERROR',
        data.message || 'Đã có lỗi xảy ra'
      )
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối. Vui lòng thử lại.')
  }
}

// Expense API methods
export const expenseApi = {
  /**
   * Get expense form data via magic link token
   * GET /expense/:token
   */
  getData: (token: string) =>
    request<ExpenseFormData>(`/expense/${token}`),

  /**
   * Submit expense form (creates version history)
   * POST /expense/:token
   */
  submit: (token: string, data: ExpenseFormInput) =>
    request<SubmitResponse>(`/expense/${token}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Save draft (no version history)
   * PATCH /expense/:token/draft
   */
  saveDraft: (token: string, data: ExpenseFormInput) =>
    request<DraftResponse>(`/expense/${token}/draft`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}
