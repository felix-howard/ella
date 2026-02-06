/**
 * Rental Form API Client
 * Public endpoints for Schedule E rental property collection
 */
import { ApiError } from '../../../lib/api-client'
import type { ScheduleEProperty, ScheduleETotals, ScheduleEStatus } from '@ella/shared'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// Rental form data types
export interface RentalClient {
  name: string
  language: 'VI' | 'EN'
}

export interface RentalExpenseData {
  id: string
  status: ScheduleEStatus
  version: number
  properties: ScheduleEProperty[]
}

export interface RentalFormData {
  client: RentalClient
  taxYear: number
  expense: RentalExpenseData | null
  totals: ScheduleETotals | null
}

export interface RentalSubmitResponse {
  success: boolean
  version: number
  status: string
  message: string
}

export interface RentalDraftResponse {
  success: boolean
  message: string
}

// Form data input types
export interface RentalDraftInput {
  properties: Partial<ScheduleEProperty>[]
}

export interface RentalSubmitInput {
  properties: ScheduleEProperty[]
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

// Rental API methods
export const rentalApi = {
  /**
   * Get rental form data via magic link token
   * GET /rental/:token
   */
  getData: (token: string) =>
    request<RentalFormData>(`/rental/${token}`),

  /**
   * Submit rental form (creates version history)
   * POST /rental/:token/submit
   */
  submit: (token: string, data: RentalSubmitInput) =>
    request<RentalSubmitResponse>(`/rental/${token}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Save draft (no version history)
   * PATCH /rental/:token/draft
   */
  saveDraft: (token: string, data: RentalDraftInput) =>
    request<RentalDraftResponse>(`/rental/${token}/draft`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}
