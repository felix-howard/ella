/**
 * API client for Ella Workspace
 * Centralized HTTP client with type-safe request handling
 * Features: timeout, retry logic, env validation
 */

// Environment validation
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Validate API URL format
if (typeof API_BASE_URL !== 'string' || !API_BASE_URL.startsWith('http')) {
  console.error('[API Client] Invalid VITE_API_URL. Using default: http://localhost:3001')
}

// Configuration
const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay for exponential backoff

// API error class for consistent error handling
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Generic response type for paginated lists
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Request options type
interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
  timeout?: number
  retries?: number // Number of retries (0 = no retry)
}

// Check if error is retryable (network errors, 5xx, 429)
function isRetryable(error: ApiError): boolean {
  if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return true
  if (error.status >= 500 && error.status < 600) return true
  if (error.status === 429) return true // Rate limited
  return false
}

// Sleep helper for retry delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Build URL with query params
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value))
      }
    })
  }
  return url.toString()
}

// Single request attempt with timeout
async function attemptRequest<T>(url: string, fetchOptions: RequestInit, timeout: number): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    })

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new ApiError(response.status, 'PARSE_ERROR', 'Failed to parse response')
    }

    if (!response.ok) {
      const errorData = data as { error?: string; message?: string }
      throw new ApiError(
        response.status,
        errorData.error || 'UNKNOWN_ERROR',
        errorData.message || 'An unknown error occurred'
      )
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', 'Request timed out')
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error occurred')
  } finally {
    clearTimeout(timeoutId)
  }
}

// Core fetch wrapper with error handling, timeout, and retry logic
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, ...fetchOptions } = options
  const url = buildUrl(path, params)

  let lastError: ApiError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await attemptRequest<T>(url, fetchOptions, timeout)
    } catch (error) {
      lastError = error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', 'Unknown error')

      // Don't retry if not retryable or last attempt
      if (!isRetryable(lastError) || attempt === retries) {
        throw lastError
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt)
      await sleep(delay)
    }
  }

  throw lastError || new ApiError(0, 'UNKNOWN', 'Request failed')
}

// API methods organized by resource
export const api = {
  // Clients
  clients: {
    list: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
      request<PaginatedResponse<Client>>('/clients', { params }),

    get: (id: string) => request<ClientDetail>(`/clients/${id}`),

    create: (data: CreateClientInput) =>
      request<CreateClientResponse>('/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateClientInput) =>
      request<Client>(`/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/clients/${id}`, {
        method: 'DELETE',
      }),

    resendSms: (id: string) =>
      request<{ success: boolean; error: string | null; smsEnabled: boolean }>(
        `/clients/${id}/resend-sms`,
        { method: 'POST' }
      ),
  },

  // Tax Cases
  cases: {
    list: (params?: { page?: number; limit?: number; status?: string; taxYear?: number; clientId?: string }) =>
      request<PaginatedResponse<TaxCase>>('/cases', { params }),

    get: (id: string) => request<TaxCaseDetail>(`/cases/${id}`),

    create: (data: CreateCaseInput) =>
      request<TaxCase>('/cases', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateCaseInput) =>
      request<TaxCase>(`/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    getChecklist: (id: string) =>
      request<ChecklistResponse>(`/cases/${id}/checklist`),

    getImages: (id: string, params?: { status?: string }) =>
      request<ImagesResponse>(`/cases/${id}/images`, { params }),

    getDocs: (id: string) => request<DocsResponse>(`/cases/${id}/docs`),
  },

  // Actions
  actions: {
    list: (params?: { type?: string; priority?: string; assignedToId?: string; isCompleted?: boolean }) =>
      request<ActionsGroupedResponse>('/actions', { params }),

    complete: (id: string) =>
      request<Action>(`/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: true }),
      }),
  },

  // Documents
  docs: {
    get: (id: string) => request<DigitalDoc>(`/docs/${id}`),

    verifyAction: (id: string, data: { action: 'verify' | 'reject'; notes?: string }) =>
      request<{ success: boolean; message: string }>(`/docs/${id}/verify-action`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Messages
  messages: {
    list: (caseId: string) => request<MessagesResponse>(`/messages/${caseId}`),

    send: (data: SendMessageInput) =>
      request<SendMessageResponse>('/messages/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Unified inbox - list all conversations
    listConversations: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
      request<ConversationsResponse>('/messages/conversations', { params }),
  },
}

// Type definitions
export type TaxCaseStatus =
  | 'INTAKE'
  | 'WAITING_DOCS'
  | 'IN_PROGRESS'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_COMPLETE'
  | 'REVIEW'
  | 'FILED'

export type TaxType = 'FORM_1040' | 'FORM_1120S' | 'FORM_1065'

export type Language = 'VI' | 'EN'

export type ActionType =
  | 'VERIFY_DOCS'
  | 'AI_FAILED'
  | 'BLURRY_DETECTED'
  | 'READY_FOR_ENTRY'
  | 'REMINDER_DUE'
  | 'CLIENT_REPLIED'

export type ActionPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

export type ChecklistItemStatus = 'MISSING' | 'HAS_RAW' | 'HAS_DIGITAL' | 'VERIFIED' | 'NOT_REQUIRED'

// Client types
export interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  language: Language
  createdAt: string
  updatedAt: string
  taxCases?: { status: TaxCaseStatus; taxYear: number }[]
}

export interface ClientProfile {
  id: string
  filingStatus: string | null
  hasW2: boolean
  hasBankAccount: boolean
  hasInvestments: boolean
  hasKidsUnder17: boolean
  numKidsUnder17: number
  paysDaycare: boolean
  hasKids17to24: boolean
  hasSelfEmployment: boolean
  hasRentalProperty: boolean
  businessName: string | null
  ein: string | null
  hasEmployees: boolean
  hasContractors: boolean
  has1099K: boolean
}

export interface ClientDetail extends Client {
  profile: ClientProfile | null
  taxCases: TaxCaseSummary[]
  portalUrl: string | null
  smsEnabled: boolean
}

export interface TaxCaseSummary {
  id: string
  taxYear: number
  taxTypes: TaxType[]
  status: TaxCaseStatus
  createdAt: string
  updatedAt: string
  _count: {
    rawImages: number
    digitalDocs: number
    checklistItems: number
  }
}

// Tax Case types
export interface TaxCase {
  id: string
  clientId: string
  taxYear: number
  taxTypes: TaxType[]
  status: TaxCaseStatus
  createdAt: string
  updatedAt: string
  client?: { id: string; name: string; phone: string }
  _count?: {
    rawImages: number
    digitalDocs: number
    checklistItems: number
  }
}

export interface TaxCaseDetail extends TaxCase {
  client: Client
  checklistItems: ChecklistItem[]
  rawImages: RawImage[]
  digitalDocs: DigitalDoc[]
  stats: {
    totalChecklist: number
    completedChecklist: number
    pendingVerification: number
    blurryCount: number
  }
}

// Checklist types
export interface ChecklistTemplate {
  id: string
  docType: string
  labelVi: string
  labelEn: string
  sortOrder: number
}

export interface ChecklistItem {
  id: string
  caseId: string
  templateId: string
  status: ChecklistItemStatus
  template: ChecklistTemplate
  rawImages?: RawImage[]
  digitalDocs?: DigitalDoc[]
}

export interface ChecklistResponse {
  items: ChecklistItem[]
  summary: {
    missing: number
    hasRaw: number
    hasDigital: number
    verified: number
    total: number
  }
}

// Image & Document types
export interface RawImage {
  id: string
  caseId: string
  filename: string
  r2Key: string
  status: string
  createdAt: string
  updatedAt: string
  checklistItem?: { template: ChecklistTemplate } | null
}

export interface DigitalDoc {
  id: string
  caseId: string
  rawImageId: string
  docType: string
  status: string
  extractedData: Record<string, unknown>
  createdAt: string
  updatedAt: string
  rawImage?: { id: string; filename: string; r2Key: string }
}

export interface ImagesResponse {
  images: RawImage[]
}

export interface DocsResponse {
  docs: DigitalDoc[]
}

// Action types
export interface Action {
  id: string
  caseId: string
  type: ActionType
  priority: ActionPriority
  title: string
  description: string | null
  isCompleted: boolean
  assignedToId: string | null
  createdAt: string
  taxCase?: {
    id: string
    client: { id: string; name: string }
  }
}

// Actions grouped by priority (API response)
export interface ActionsGroupedResponse {
  urgent: Action[]
  high: Action[]
  normal: Action[]
  low: Action[]
  stats: {
    total: number
    urgent: number
    high: number
    normal: number
    low: number
  }
}

// Message types
export interface Message {
  id: string
  conversationId: string
  channel: 'SMS' | 'PORTAL' | 'SYSTEM'
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  createdAt: string
}

// Input types
export interface CreateClientInput {
  name: string
  phone: string
  email?: string
  language?: Language
  profile: {
    taxTypes: TaxType[]
    taxYear: number
    filingStatus?: string
    hasW2?: boolean
    hasBankAccount?: boolean
    hasInvestments?: boolean
    hasKidsUnder17?: boolean
    numKidsUnder17?: number
    paysDaycare?: boolean
    hasKids17to24?: boolean
    hasSelfEmployment?: boolean
    hasRentalProperty?: boolean
    businessName?: string
    ein?: string
    hasEmployees?: boolean
    hasContractors?: boolean
    has1099K?: boolean
  }
}

export interface CreateClientResponse {
  client: Client
  taxCase: { id: string; taxYear: number; status: TaxCaseStatus }
  magicLink: string
}

export interface UpdateClientInput {
  name?: string
  phone?: string
  email?: string | null
  language?: Language
}

export interface CreateCaseInput {
  clientId: string
  taxYear: number
  taxTypes: TaxType[]
}

export interface UpdateCaseInput {
  status?: TaxCaseStatus
}

export interface SendMessageInput {
  caseId: string
  content: string
  channel?: 'SMS' | 'PORTAL'
}

// Messages response types
export interface MessagesResponse {
  conversation: {
    id: string
    caseId: string
    unreadCount: number
    lastMessageAt: string | null
    createdAt: string
    updatedAt: string
  }
  messages: Message[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface SendMessageResponse {
  message: Message
  sent: boolean
  smsEnabled: boolean
  error?: string
}

// Conversation type for unified inbox
export interface Conversation {
  id: string
  caseId: string
  unreadCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    phone: string
    language: Language
  }
  taxCase: {
    id: string
    taxYear: number
    status: TaxCaseStatus
  }
  lastMessage: {
    id: string
    content: string
    channel: 'SMS' | 'PORTAL' | 'SYSTEM'
    direction: 'INBOUND' | 'OUTBOUND'
    createdAt: string
  } | null
}

export interface ConversationsResponse {
  conversations: Conversation[]
  totalUnread: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
