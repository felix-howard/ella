/**
 * Portal API client
 * Simplified HTTP client for magic link portal access
 * Public endpoints only - no auth required
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

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

// Error messages for different status codes
const ERROR_MESSAGES: Record<number, { code: string; vi: string; en: string }> = {
  429: {
    code: 'RATE_LIMITED',
    vi: 'Quá nhiều yêu cầu. Vui lòng đợi một chút.',
    en: 'Too many requests. Please wait.',
  },
  500: {
    code: 'SERVER_ERROR',
    vi: 'Lỗi máy chủ. Vui lòng thử lại.',
    en: 'Server error. Please try again.',
  },
  503: {
    code: 'UNAVAILABLE',
    vi: 'Dịch vụ tạm thời không khả dụng.',
    en: 'Service temporarily unavailable.',
  },
}

function getPortalLanguage(): 'vi' | 'en' {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('ella-language')
    if (saved?.startsWith('en')) return 'en'
    if (saved?.startsWith('vi')) return 'vi'
  }

  if (typeof navigator !== 'undefined' && navigator.language.startsWith('en')) {
    return 'en'
  }

  return 'vi'
}

function getErrorMessage(status: number): string | null {
  const errInfo = ERROR_MESSAGES[status]
  return errInfo ? errInfo[getPortalLanguage()] : null
}

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

    // Handle rate limiting specifically
    if (response.status === 429) {
      const errInfo = ERROR_MESSAGES[429]
      throw new ApiError(429, errInfo.code, getErrorMessage(429) || errInfo.vi)
    }

    const data = await response.json()

    if (!response.ok) {
      // Check for known error status codes
      const errInfo = ERROR_MESSAGES[response.status]
      if (errInfo) {
        throw new ApiError(
          response.status,
          errInfo.code,
          getErrorMessage(response.status) || errInfo.vi
        )
      }
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

// Agreement types
export interface AgreementTemplateSection {
  heading: string
  paragraphs: string[]
}

export type AgreementStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'VOIDED'

export type AgreementClientType = 'INDIVIDUAL' | 'BUSINESS'

export interface AgreementFirmSnapshot {
  name: string
  address: string
  contact: string | null
  signerName: string
  signerTitle: string
  /** Presigned URL for already-drawn firm signature PNG. */
  signaturePresignedUrl: string | null
  /** Formatted human date or null when not yet signed. */
  signedAt: string | null
}

export interface AgreementClientSnapshot {
  nameOrBusiness: string
  address: string
  clientType: AgreementClientType
}

export interface AgreementPublicView {
  status: AgreementStatus
  expiresAt: string | null
  expired: boolean
  templateVersion: string
  templateTitle: string
  templateSections: AgreementTemplateSection[]
  templateHtml: string | null
  /** Formatted (e.g. `$300.00`) when a deposit applies; null otherwise. */
  depositAmount: string | null
  orgName: string
  leadFirstName: string
  /** v2 only. Null for legacy v1 agreements. */
  firmSnapshot: AgreementFirmSnapshot | null
  /** v2 only. Null for legacy v1 agreements. */
  clientSnapshot: AgreementClientSnapshot | null
}

export interface AgreementSignPayload {
  signerName: string
  signerTitle: string
  signaturePngDataUrl: string
  agreementChecked: true
  /** Back-compat fields accepted by older API builds. New clients send signerName/signerTitle. */
  clientAuthRepName?: string
  clientAuthRepTitle?: string
}

export interface AgreementSignResult {
  status: 'SIGNED'
  signedAt: string
  downloadUrl: string
}

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

// Draft return data type
export interface DraftReturnData {
  title: string
  clientName: string
  clientLanguage: 'EN' | 'VI'
  taxYear: number
  version: number
  filename: string
  uploadedAt: string
  pdfUrl: string
}

// Portal data types
export interface PortalClient {
  name: string
  language: 'VI' | 'EN'
}

export interface PortalTaxCase {
  id: string
  taxYear: number
  status: string
  engagementId?: string // Added for multi-year support (Phase 5)
}

export interface ChecklistDoc {
  id: string
  docType: string
  labelVi: string
  status?: string
  reason?: string
}

export interface PortalStats {
  uploaded: number
  verified: number
  missing: number
}

// Per-entity descriptor returned by GET /portal/:token (single-entry array for scope=CASE)
export interface PortalEntity {
  caseId: string
  clientId: string
  name: string
  entityType: 'individual' | 'business'
  businessType?: string | null
  uploadCount: number
  hasChecklist: boolean
  missingCount?: number
  taxYear: number
}

export interface PortalClientGroup {
  id: string
  name: string
}

export interface PortalData {
  scope: 'CASE' | 'GROUP'
  client: PortalClient
  entities: PortalEntity[]
  // Legacy CASE-scope fields (back-compat with single-entity portals)
  taxCase?: PortalTaxCase | null
  checklist?: {
    received: ChecklistDoc[]
    blurry: ChecklistDoc[]
    missing: ChecklistDoc[]
  }
  stats?: PortalStats
  // GROUP-scope fields
  taxYear?: number
  clientGroup?: PortalClientGroup | null
}

// Per-entity uploaded file row returned by GET /portal/:token?caseId=
export type UploadedFileStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'CLASSIFIED'
  | 'LINKED'
  | 'BLURRY'
  | 'UNCLASSIFIED'
  | 'DUPLICATE'

export interface UploadedFile {
  id: string
  safeLabel: string
  status: UploadedFileStatus
  createdAt: string
  sequenceNumber: number
}

export interface UploadResponse {
  uploaded: number
  images: UploadedFile[]
  message: string
}

// Portal API methods
export const portalApi = {
  // Get portal data via magic link token
  getData: (token: string) => request<PortalData>(`/portal/${token}`),

  // Upload files with progress tracking using XMLHttpRequest
  uploadWithProgress: async (
    token: string,
    files: File[],
    onProgress: (progress: number) => void,
    targetCaseId?: string
  ): Promise<UploadResponse> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (targetCaseId) formData.append('targetCaseId', targetCaseId)

      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            reject(new ApiError(xhr.status, 'PARSE_ERROR', 'Invalid response'))
          }
        } else if (xhr.status === 429) {
          const errInfo = ERROR_MESSAGES[429]
          reject(new ApiError(429, errInfo.code, getErrorMessage(429) || errInfo.vi))
        } else {
          const errInfo = ERROR_MESSAGES[xhr.status]
          if (errInfo) {
            reject(
              new ApiError(xhr.status, errInfo.code, getErrorMessage(xhr.status) || errInfo.vi)
            )
          } else {
            try {
              const data = JSON.parse(xhr.responseText)
              reject(
                new ApiError(
                  xhr.status,
                  data.error || 'UPLOAD_ERROR',
                  data.message || 'Không thể tải lên. Vui lòng thử lại.'
                )
              )
            } catch {
              reject(
                new ApiError(xhr.status, 'UPLOAD_ERROR', 'Không thể tải lên. Vui lòng thử lại.')
              )
            }
          }
        }
      }

      xhr.onerror = () => {
        reject(new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối. Vui lòng thử lại.'))
      }

      xhr.open('POST', `${API_BASE_URL}/portal/${token}/upload`)
      xhr.send(formData)
    })
  },

  // Upload files via magic link (legacy - no progress)
  upload: async (token: string, files: File[], targetCaseId?: string): Promise<UploadResponse> => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    if (targetCaseId) formData.append('targetCaseId', targetCaseId)

    const response = await fetch(`${API_BASE_URL}/portal/${token}/upload`, {
      method: 'POST',
      body: formData,
    })

    // Handle rate limiting for uploads
    if (response.status === 429) {
      const errInfo = ERROR_MESSAGES[429]
      throw new ApiError(429, errInfo.code, getErrorMessage(429) || errInfo.vi)
    }

    const data = await response.json()

    if (!response.ok) {
      // Check for known error status codes
      const errInfo = ERROR_MESSAGES[response.status]
      if (errInfo) {
        throw new ApiError(
          response.status,
          errInfo.code,
          getErrorMessage(response.status) || errInfo.vi
        )
      }
      throw new ApiError(
        response.status,
        data.error || 'UPLOAD_ERROR',
        data.message || 'Không thể tải lên. Vui lòng thử lại.'
      )
    }

    return data as UploadResponse
  },

  // Get uploaded files for one entity (per-case list) via short-circuit query
  getEntityUploads: (token: string, caseId: string) =>
    request<{ uploads: UploadedFile[] }>(`/portal/${token}?caseId=${encodeURIComponent(caseId)}`),

  // Get draft return data for portal viewing
  getDraft: (token: string) => request<DraftReturnData>(`/portal/draft/${token}`),

  // Track when client views the draft
  trackDraftView: async (token: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/portal/draft/${token}/viewed`, {
      method: 'POST',
    })
  },

  // Load agreement by public token
  getAgreement: async (token: string): Promise<AgreementPublicView> => {
    const envelope = await request<ApiEnvelope<AgreementPublicView>>(`/public/agreements/${token}`)
    return envelope.data
  },

  // Submit agreement signature
  signAgreement: async (
    token: string,
    payload: AgreementSignPayload
  ): Promise<AgreementSignResult> => {
    const envelope = await request<ApiEnvelope<AgreementSignResult>>(
      `/public/agreements/${token}/sign`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
    return envelope.data
  },
}
