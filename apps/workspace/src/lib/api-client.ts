/**
 * API client for Ella Workspace
 * Centralized HTTP client with type-safe request handling
 * Features: timeout, retry logic, env validation
 */

// Environment validation
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// Validate API URL format
if (typeof API_BASE_URL !== 'string' || !API_BASE_URL.startsWith('http')) {
  console.error('[API Client] Invalid VITE_API_URL. Using default: http://localhost:3002')
}

// Configuration
const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay for exponential backoff

// Auth token getter (set by ClerkAuthProvider)
let getAuthToken: (() => Promise<string | null>) | null = null

/**
 * Set the auth token getter function (called by ClerkAuthProvider)
 */
export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter
}

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

  // Get auth token if available
  let authHeaders: Record<string, string> = {}
  if (getAuthToken) {
    const token = await getAuthToken()
    if (token) {
      authHeaders = { Authorization: `Bearer ${token}` }
    }
  }

  // Merge auth headers with existing headers
  const headersWithAuth = {
    ...fetchOptions.headers,
    ...authHeaders,
  }

  let lastError: ApiError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await attemptRequest<T>(url, { ...fetchOptions, headers: headersWithAuth }, timeout)
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
    list: (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: 'activity' | 'stale' | 'name' }) =>
      request<PaginatedResponse<ClientWithActions>>('/clients', { params }),

    // Search for existing client by phone (for returning client detection)
    searchByPhone: async (phone: string) => {
      // Normalize phone by removing non-digits
      const normalizedPhone = phone.replace(/\D/g, '')
      if (normalizedPhone.length < 10) return null
      const result = await request<PaginatedResponse<ClientWithActions>>('/clients', {
        params: { search: normalizedPhone, limit: 1 },
      })
      return result.data?.[0] ?? null
    },

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

    // Cascade cleanup when parent answer changes to false
    cascadeCleanup: (id: string, data: { changedKey: string; caseId?: string }) =>
      request<{ success: boolean; deletedAnswers: string[]; deletedItems: number }>(
        `/clients/${id}/cascade-cleanup`,
        { method: 'POST', body: JSON.stringify(data) }
      ),

    // Update client profile (intakeAnswers + filingStatus)
    updateProfile: (id: string, data: UpdateProfileInput) =>
      request<UpdateProfileResponse>(`/clients/${id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
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

    // Add manual checklist item
    addChecklistItem: (id: string, data: { docType: string; reason?: string; expectedCount?: number }) =>
      request<{ data: ChecklistItem }>(`/cases/${id}/checklist/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Skip checklist item
    skipChecklistItem: (caseId: string, itemId: string, reason: string) =>
      request<{ data: ChecklistItem }>(`/cases/${caseId}/checklist/items/${itemId}/skip`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),

    // Unskip checklist item (restore from NOT_REQUIRED)
    unskipChecklistItem: (caseId: string, itemId: string) =>
      request<{ data: ChecklistItem }>(`/cases/${caseId}/checklist/items/${itemId}/unskip`, {
        method: 'PATCH',
      }),

    // Update checklist item notes
    updateChecklistItemNotes: (caseId: string, itemId: string, notes: string) =>
      request<{ data: ChecklistItem }>(`/cases/${caseId}/checklist/items/${itemId}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }),

    getImages: (id: string, params?: { status?: string }) =>
      request<ImagesResponse>(`/cases/${id}/images`, { params }),

    getDocs: (id: string) => request<DocsResponse>(`/cases/${id}/docs`),

    getImageSignedUrl: (imageId: string) =>
      request<SignedUrlResponse>(`/cases/images/${imageId}/signed-url`),

    // Status action endpoints (Computed Status System)
    sendToReview: (id: string) =>
      request<{ success: boolean }>(`/cases/${id}/send-to-review`, {
        method: 'POST',
      }),

    markFiled: (id: string) =>
      request<{ success: boolean }>(`/cases/${id}/mark-filed`, {
        method: 'POST',
      }),

    reopen: (id: string) =>
      request<{ success: boolean }>(`/cases/${id}/reopen`, {
        method: 'POST',
      }),
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

    // Trigger OCR extraction using Gemini AI
    triggerOcr: (id: string) =>
      request<OcrTriggerResponse>(`/docs/${id}/ocr`, {
        method: 'POST',
        timeout: 60000, // 60s timeout for AI processing
      }),

    // Phase 02: Field-level verification & entry tracking
    verifyField: (id: string, data: { field: string; status: FieldVerificationStatus; value?: string }) =>
      request<{ success: boolean; fieldVerifications: Record<string, string> }>(`/docs/${id}/verify-field`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    markCopied: (id: string, field: string) =>
      request<{ success: boolean; copiedFields: Record<string, boolean> }>(`/docs/${id}/mark-copied`, {
        method: 'POST',
        body: JSON.stringify({ field }),
      }),

    completeEntry: (id: string) =>
      request<{ success: boolean; message: string }>(`/docs/${id}/complete-entry`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  },

  // Raw Images
  images: {
    // Update classification for an image (approve/reject/change type)
    updateClassification: (id: string, data: { docType: string; action: 'approve' | 'reject' }) =>
      request<{ success: boolean; status: string }>(`/images/${id}/classification`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // Re-trigger AI classification for an image
    reclassify: (id: string) =>
      request<{ success: boolean; message: string; status: string }>(`/images/${id}/reclassify`, {
        method: 'POST',
      }),

    // Phase 02: Request document re-upload with optional SMS
    requestReupload: (id: string, data: { reason: string; fields: string[]; sendSms: boolean }) =>
      request<{ success: boolean; message: string; smsSent: boolean; smsError?: string }>(
        `/images/${id}/request-reupload`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    // Rename image file (display name only)
    rename: (id: string, filename: string) =>
      request<{ success: boolean; id: string; filename: string }>(`/images/${id}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ filename }),
      }),

    // Delete a raw image (for duplicates)
    delete: (id: string) =>
      request<{ success: boolean }>(`/images/${id}`, {
        method: 'DELETE',
      }),

    // Force classification on duplicate image (bypass duplicate check)
    classifyAnyway: (id: string) =>
      request<{ success: boolean; message: string }>(`/images/${id}/classify-anyway`, {
        method: 'POST',
      }),

    // Change document category (for drag-drop between categories)
    changeCategory: (id: string, category: DocCategory) =>
      request<{ success: boolean; id: string; category: DocCategory }>(`/images/${id}/category`, {
        method: 'PATCH',
        body: JSON.stringify({ category }),
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

    // Get unread count for a specific case
    getUnreadCount: (caseId: string) =>
      request<{ caseId: string; unreadCount: number }>(`/messages/${caseId}/unread`),
  },

  // Voice Calls
  voice: {
    // Get voice token for Twilio SDK
    getToken: () =>
      request<VoiceTokenResponse>('/voice/token', {
        method: 'POST',
      }),

    // Check voice availability
    getStatus: () =>
      request<VoiceStatusResponse>('/voice/status'),

    // Create call record (before initiating call via SDK)
    createCall: (data: { caseId: string; toPhone: string }) =>
      request<CreateCallResponse>('/voice/calls', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Update call message with Twilio CallSid (after device.connect() succeeds)
    updateCallSid: (messageId: string, callSid: string) =>
      request<UpdateCallSidResponse>(`/voice/calls/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ callSid }),
      }),

    // Fetch recording audio as Blob (requires auth)
    fetchRecordingAudio: async (recordingSid: string): Promise<Blob> => {
      const url = `${API_BASE_URL}/voice/recordings/${recordingSid}/audio`
      const headers: Record<string, string> = {}

      if (getAuthToken) {
        const token = await getAuthToken()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        throw new ApiError(response.status, 'AUDIO_FETCH_FAILED', 'Failed to fetch recording')
      }

      return response.blob()
    },

    // Lookup caller info for incoming call UI
    lookupCaller: (phone: string) =>
      request<CallerLookupResponse>(`/voice/caller/${encodeURIComponent(phone)}`),

    // Register presence (called when Device.on('registered') fires)
    registerPresence: () =>
      request<PresenceResponse>('/voice/presence/register', {
        method: 'POST',
      }),

    // Unregister presence (called when Device.on('unregistered') fires or tab closes)
    unregisterPresence: () =>
      request<PresenceResponse>('/voice/presence/unregister', {
        method: 'POST',
        retries: 0, // Don't retry on tab close
      }),

    // Heartbeat to keep presence alive (called periodically)
    heartbeat: () =>
      request<HeartbeatResponse>('/voice/presence/heartbeat', {
        method: 'POST',
        retries: 0,
      }),
  },

  // Admin - Configuration management
  admin: {
    // Intake Questions
    intakeQuestions: {
      list: (params?: { taxType?: TaxType; section?: string; isActive?: boolean }) =>
        request<{ data: IntakeQuestion[] }>('/admin/intake-questions', { params }),

      get: (id: string) => request<IntakeQuestion>(`/admin/intake-questions/${id}`),

      create: (data: CreateIntakeQuestionInput) =>
        request<IntakeQuestion>('/admin/intake-questions', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      update: (id: string, data: UpdateIntakeQuestionInput) =>
        request<IntakeQuestion>(`/admin/intake-questions/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      delete: (id: string) =>
        request<{ success: boolean }>(`/admin/intake-questions/${id}`, {
          method: 'DELETE',
        }),
    },

    // Checklist Templates
    checklistTemplates: {
      list: (params?: { taxType?: TaxType; category?: string }) =>
        request<{ data: ChecklistTemplate[] }>('/admin/checklist-templates', { params }),

      get: (id: string) => request<ChecklistTemplate>(`/admin/checklist-templates/${id}`),

      create: (data: CreateChecklistTemplateInput) =>
        request<ChecklistTemplate>('/admin/checklist-templates', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      update: (id: string, data: UpdateChecklistTemplateInput) =>
        request<ChecklistTemplate>(`/admin/checklist-templates/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      delete: (id: string) =>
        request<{ success: boolean }>(`/admin/checklist-templates/${id}`, {
          method: 'DELETE',
        }),
    },

    // Doc Type Library
    docTypeLibrary: {
      list: (params?: { category?: string; isActive?: boolean; search?: string }) =>
        request<{ data: DocTypeLibraryItem[] }>('/admin/doc-type-library', { params }),

      get: (id: string) => request<DocTypeLibraryItem>(`/admin/doc-type-library/${id}`),

      create: (data: CreateDocTypeLibraryInput) =>
        request<DocTypeLibraryItem>('/admin/doc-type-library', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      update: (id: string, data: UpdateDocTypeLibraryInput) =>
        request<DocTypeLibraryItem>(`/admin/doc-type-library/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      delete: (id: string) =>
        request<{ success: boolean }>(`/admin/doc-type-library/${id}`, {
          method: 'DELETE',
        }),
    },

    // Message Templates
    messageTemplates: {
      list: (params?: { category?: MessageTemplateCategory; isActive?: boolean }) =>
        request<{ data: MessageTemplate[] }>('/admin/message-templates', { params }),

      get: (id: string) => request<MessageTemplate>(`/admin/message-templates/${id}`),

      create: (data: CreateMessageTemplateInput) =>
        request<MessageTemplate>('/admin/message-templates', {
          method: 'POST',
          body: JSON.stringify(data),
        }),

      update: (id: string, data: UpdateMessageTemplateInput) =>
        request<MessageTemplate>(`/admin/message-templates/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),

      delete: (id: string) =>
        request<{ success: boolean }>(`/admin/message-templates/${id}`, {
          method: 'DELETE',
        }),
    },

    // Utility endpoints
    getSections: () => request<{ data: string[] }>('/admin/sections'),
    getCategories: () => request<{ data: string[] }>('/admin/categories'),
  },

  // TaxEngagement - Multi-year client support
  engagements: {
    // List engagements with filters
    list: (params?: { clientId?: string; taxYear?: number; status?: EngagementStatus; page?: number; limit?: number }) =>
      request<PaginatedResponse<TaxEngagement>>('/engagements', { params }),

    // Get engagement details
    get: (id: string) =>
      request<{ data: TaxEngagementDetail }>(`/engagements/${id}`),

    // Create new engagement (with optional copy from previous)
    create: (data: CreateEngagementInput) =>
      request<{ data: TaxEngagement }>('/engagements', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Update engagement profile
    update: (id: string, data: UpdateEngagementInput) =>
      request<{ data: TaxEngagement }>(`/engagements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    // Preview what would be copied from an engagement
    copyPreview: (id: string) =>
      request<{ data: EngagementCopyPreview }>(`/engagements/${id}/copy-preview`),

    // Delete engagement (only if no tax cases)
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/engagements/${id}`, {
        method: 'DELETE',
      }),
  },

  // Client intake questions (public endpoint for forms)
  getIntakeQuestions: (taxTypes: TaxType[]) =>
    request<{ data: IntakeQuestion[] }>('/clients/intake-questions', {
      params: { taxTypes: taxTypes.join(',') },
    }),

  // Schedule C - Staff endpoints for expense form management
  scheduleC: {
    // Get Schedule C data for a case
    get: (caseId: string) =>
      request<ScheduleCResponse>(`/schedule-c/${caseId}`),

    // Send expense form to client
    send: (caseId: string) =>
      request<ScheduleCSendResponse>(`/schedule-c/${caseId}/send`, {
        method: 'POST',
      }),

    // Lock form to prevent client edits
    lock: (caseId: string) =>
      request<ScheduleCLockResponse>(`/schedule-c/${caseId}/lock`, {
        method: 'PATCH',
      }),

    // Unlock a locked form
    unlock: (caseId: string) =>
      request<ScheduleCUnlockResponse>(`/schedule-c/${caseId}/unlock`, {
        method: 'PATCH',
      }),

    // Resend form link (extend TTL)
    resend: (caseId: string) =>
      request<ScheduleCResendResponse>(`/schedule-c/${caseId}/resend`, {
        method: 'POST',
      }),
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

// Phase 02: Field verification status
export type FieldVerificationStatus = 'verified' | 'edited' | 'unreadable'

// OCR trigger response
export interface OcrTriggerResponse {
  digitalDoc: DigitalDoc
  ocrResult?: {
    success: boolean
    confidence: number
    isValid: boolean
    fieldLabels: Record<string, string>
    processingTimeMs?: number
  }
  aiConfigured?: boolean
  message: string
}

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

// Action counts for client list view
export interface ActionCounts {
  /** ChecklistItem.status = MISSING */
  missingDocs: number
  /** DigitalDoc.status = EXTRACTED (needs verification) */
  toVerify: number
  /** DigitalDoc.status = VERIFIED && entryCompleted = false */
  toEnter: number
  /** Days since lastActivityAt (null if < threshold) */
  staleDays: number | null
  /** Has unread messages */
  hasNewActivity: boolean
}

// Client with computed status and action counts for list view
export interface ClientWithActions {
  id: string
  name: string
  phone: string
  email: string | null
  language: 'VI' | 'EN'
  createdAt: string
  updatedAt: string
  computedStatus: TaxCaseStatus | null
  actionCounts: ActionCounts | null
  latestCase: {
    id: string
    taxYear: number
    taxTypes: string[]
    isInReview: boolean
    isFiled: boolean
    lastActivityAt: string
  } | null
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
  // Full intake answers JSON from dynamic intake form
  // Supports: booleans, numbers, strings, arrays (dependents), and nested objects
  intakeAnswers?: Record<string, unknown>
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
  /** Manual flag: case sent for review */
  isInReview?: boolean
  /** Manual flag: case has been filed */
  isFiled?: boolean
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
  /** Manual flag: case sent for review */
  isInReview?: boolean
  /** Manual flag: case has been filed */
  isFiled?: boolean
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
  expectedCount: number
  receivedCount: number
  notes: string | null
  template: ChecklistTemplate
  rawImages?: RawImage[]
  digitalDocs?: DigitalDoc[]
  // Staff override fields
  isManuallyAdded: boolean
  addedById: string | null
  addedBy?: { id: string; name: string } | null
  addedReason: string | null
  skippedAt: string | null
  skippedById: string | null
  skippedBy?: { id: string; name: string } | null
  skippedReason: string | null
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

// Document category enum (matches DocCategory in Prisma schema)
export type DocCategory = 'IDENTITY' | 'INCOME' | 'EXPENSE' | 'ASSET' | 'EDUCATION' | 'HEALTHCARE' | 'OTHER'

// Image & Document types
export interface RawImage {
  id: string
  caseId: string
  filename: string
  r2Key: string
  status: string
  classifiedType: string | null
  category: DocCategory | null
  displayName: string | null
  aiConfidence: number | null
  imageGroupId: string | null
  createdAt: string
  updatedAt: string
  checklistItem?: { template: ChecklistTemplate } | null
  imageGroup?: ImageGroup | null
  // Phase 01: Re-upload request tracking
  reuploadRequested?: boolean
  reuploadRequestedAt?: string | null
  reuploadReason?: string | null
  reuploadFields?: string[] | null
}

// Image group for duplicate detection
export interface ImageGroup {
  id: string
  caseId: string
  docType: string
  bestImageId: string | null
  images: { id: string; filename: string }[]
  createdAt: string
  updatedAt: string
}

export interface DigitalDoc {
  id: string
  caseId: string
  rawImageId: string
  docType: string
  status: string
  extractedData: Record<string, unknown>
  aiConfidence?: number | null
  createdAt: string
  updatedAt: string
  rawImage?: { id: string; filename: string; r2Key: string }
  // Phase 02: Field-level verification & entry tracking
  fieldVerifications?: Record<string, FieldVerificationStatus>
  copiedFields?: Record<string, boolean>
  entryCompleted?: boolean
  entryCompletedAt?: string
}

export interface ImagesResponse {
  images: RawImage[]
}

export interface DocsResponse {
  docs: DigitalDoc[]
}

export interface SignedUrlResponse {
  id: string
  filename: string
  url: string
  expiresIn: number
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
  metadata?: Record<string, unknown> // JSON field for action-specific data
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
  channel: 'SMS' | 'PORTAL' | 'SYSTEM' | 'CALL'
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  attachmentUrls?: string[]
  createdAt: string
  // Call-specific fields (only for CALL channel)
  callSid?: string
  recordingUrl?: string
  recordingDuration?: number
  callStatus?: string
}

// Input types
export interface CreateClientInput {
  name: string
  phone: string
  email?: string
  language?: Language
  profile: {
    taxYear: number
    taxTypes?: TaxType[] // Optional - defaults to ['FORM_1040'] on backend
    filingStatus?: string
    // Legacy fields for backward compatibility
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
    // Full intake answers JSON (supports arrays/objects for dependents, etc.)
    intakeAnswers?: Record<string, unknown>
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

// Update client profile (intakeAnswers + filingStatus)
export interface UpdateProfileInput {
  filingStatus?: string
  intakeAnswers?: Record<string, unknown>
}

// Response from profile update (includes checklist refresh status)
export interface UpdateProfileResponse {
  profile: ClientProfile
  checklistRefreshed: boolean
  cascadeCleanup: {
    triggeredBy: string[]
  }
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

// Admin types - Intake Questions
export type FieldType = 'BOOLEAN' | 'SELECT' | 'NUMBER' | 'NUMBER_INPUT' | 'CURRENCY' | 'TEXT'

export interface IntakeQuestion {
  id: string
  questionKey: string
  taxTypes: TaxType[]
  labelVi: string
  labelEn: string
  hintVi: string | null
  hintEn: string | null
  fieldType: FieldType
  options: string | null // JSON string
  condition: string | null // JSON string
  section: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateIntakeQuestionInput {
  questionKey: string
  taxTypes: TaxType[]
  labelVi: string
  labelEn: string
  hintVi?: string
  hintEn?: string
  fieldType: FieldType
  options?: string
  condition?: string
  section: string
  sortOrder?: number
  isActive?: boolean
}

export type UpdateIntakeQuestionInput = Partial<CreateIntakeQuestionInput>

// Admin types - Checklist Templates
export interface ChecklistTemplate {
  id: string
  taxType: TaxType
  docType: string
  labelVi: string
  labelEn: string
  descriptionVi: string | null
  descriptionEn: string | null
  hintVi: string | null
  hintEn: string | null
  isRequired: boolean
  condition: string | null // JSON string
  category: string
  expectedCount: number
  sortOrder: number
  createdAt: string
  updatedAt: string
  docTypeLibrary?: {
    code: string
    labelVi: string
    labelEn: string
  } | null
}

export interface CreateChecklistTemplateInput {
  taxType: TaxType
  docType: string
  labelVi: string
  labelEn: string
  descriptionVi?: string
  descriptionEn?: string
  hintVi?: string
  hintEn?: string
  isRequired?: boolean
  condition?: string
  category: string
  expectedCount?: number
  sortOrder?: number
}

export interface UpdateChecklistTemplateInput {
  labelVi?: string
  labelEn?: string
  descriptionVi?: string
  descriptionEn?: string
  hintVi?: string
  hintEn?: string
  isRequired?: boolean
  condition?: string
  category?: string
  expectedCount?: number
  sortOrder?: number
}

// Admin types - Doc Type Library
export interface DocTypeLibraryItem {
  id: string
  code: string
  labelVi: string
  labelEn: string
  descriptionVi: string | null
  descriptionEn: string | null
  category: string
  aliases: string[]
  keywords: string[]
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateDocTypeLibraryInput {
  code: string
  labelVi: string
  labelEn: string
  descriptionVi?: string
  descriptionEn?: string
  category: string
  aliases?: string[]
  keywords?: string[]
  sortOrder?: number
  isActive?: boolean
}

export type UpdateDocTypeLibraryInput = Partial<Omit<CreateDocTypeLibraryInput, 'code'>>

// Admin types - Message Templates
export type MessageTemplateCategory = 'WELCOME' | 'REMINDER' | 'MISSING' | 'BLURRY' | 'COMPLETE' | 'GENERAL'

export interface MessageTemplate {
  id: string
  category: MessageTemplateCategory
  title: string
  content: string
  placeholders: string[]
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateMessageTemplateInput {
  category: MessageTemplateCategory
  title: string
  content: string
  placeholders?: string[]
  sortOrder?: number
  isActive?: boolean
}

export type UpdateMessageTemplateInput = Partial<CreateMessageTemplateInput>

// Voice API types
export interface VoiceTokenResponse {
  token: string
  expiresIn: number
  identity: string
}

export interface VoiceStatusResponse {
  available: boolean
  features: {
    outbound: boolean
    recording: boolean
  }
}

export interface CreateCallResponse {
  messageId: string
  conversationId: string
  toPhone: string
  clientName: string
}

export interface UpdateCallSidResponse {
  success: boolean
  messageId: string
  callSid: string
}

// Caller lookup response for incoming calls
export interface CallerLookupResponse {
  phone: string
  conversation: {
    id: string
    caseId: string | null
    clientName: string
  } | null
  lastContactStaffId: string | null
}

// Presence registration response
export interface PresenceResponse {
  success: boolean
  deviceId?: string
}

// Heartbeat response
export interface HeartbeatResponse {
  success: boolean
  reason?: string
}

// TaxEngagement types for multi-year client support
export type EngagementStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETE' | 'ARCHIVED'

export interface TaxEngagement {
  id: string
  clientId: string
  taxYear: number
  status: EngagementStatus
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
  intakeAnswers: Record<string, unknown>
  createdAt: string
  updatedAt: string
  client?: { id: string; name: string; phone: string }
  _count?: { taxCases: number }
}

export interface TaxEngagementDetail extends TaxEngagement {
  client: Client
  taxCases: TaxCaseSummary[]
}

export interface EngagementCopyPreview {
  taxYear: number
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

export interface CreateEngagementInput {
  clientId: string
  taxYear: number
  copyFromEngagementId?: string
  filingStatus?: string
  intakeAnswers?: Record<string, unknown>
}

export interface UpdateEngagementInput {
  filingStatus?: string
  status?: EngagementStatus
  hasW2?: boolean
  hasBankAccount?: boolean
  hasInvestments?: boolean
  hasKidsUnder17?: boolean
  numKidsUnder17?: number
  paysDaycare?: boolean
  hasKids17to24?: boolean
  hasSelfEmployment?: boolean
  hasRentalProperty?: boolean
  businessName?: string | null
  ein?: string | null
  hasEmployees?: boolean
  hasContractors?: boolean
  has1099K?: boolean
  intakeAnswers?: Record<string, unknown>
}

// Schedule C types for expense form management
export type ScheduleCStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED'

export interface ScheduleCExpense {
  id: string
  taxCaseId: string
  status: ScheduleCStatus
  version: number
  // Business Info
  businessName: string | null
  businessDesc: string | null
  // Income
  grossReceipts: string | null
  returns: string | null
  costOfGoods: string | null
  otherIncome: string | null
  // Expenses (all as strings for decimal display)
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
  // Vehicle info
  vehicleMiles: number | null
  vehicleCommuteMiles: number | null
  vehicleOtherMiles: number | null
  vehicleDateInService: string | null
  vehicleUsedForCommute: boolean
  vehicleAnotherAvailable: boolean
  vehicleEvidenceWritten: boolean
  // Version history
  versionHistory: VersionHistoryEntry[] | null
  // Timestamps
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  lockedAt: string | null
  lockedById: string | null
}

export interface VersionHistoryEntry {
  version: number
  submittedAt: string
  changes: string[]
  data: Partial<Record<string, string | number | null>>
}

export interface ScheduleCMagicLink {
  id: string
  token: string
  isActive: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  usageCount: number
}

export interface ScheduleCTotals {
  grossReceipts: string
  returns: string
  costOfGoods: string
  grossIncome: string
  totalExpenses: string
  mileageDeduction: string
  netProfit: string
}

export interface ScheduleCResponse {
  expense: ScheduleCExpense | null
  magicLink: ScheduleCMagicLink | null
  totals: ScheduleCTotals | null
}

export interface ScheduleCSendResponse {
  success: boolean
  magicLink: string
  messageSent: boolean
  expiresAt: string
  expenseId: string
  prefilledGrossReceipts: string
}

export interface ScheduleCLockResponse {
  success: boolean
  status: 'LOCKED'
  lockedAt: string
}

export interface ScheduleCUnlockResponse {
  success: boolean
  status: 'SUBMITTED'
}

export interface ScheduleCResendResponse {
  success: boolean
  expiresAt: string
  messageSent: boolean
}
